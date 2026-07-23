import { createServer } from 'node:http';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const verificationDir = join(root, 'verification', 'managed-proxy-production');
const summaryFile = join(verificationDir, 'summary.json');
const reportFile = join(verificationDir, 'report.md');
const modelProxyLog = join(verificationDir, 'model-proxy.log');
const runtimeRoot = join(root, `.tmp-managed-proxy-runtime-${Date.now()}-${process.pid}`);
const managedConfigFile = join(runtimeRoot, 'config', 'managed-proxy.json');
const secretCanary = 'sk-aiw-secret-canary';
const managedTokenCanary = 'managed-token-canary';

mkdirSync(verificationDir, { recursive: true });
mkdirSync(join(runtimeRoot, 'config'), { recursive: true });

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createMockManagedProxy() {
  const state = {
    registerCalls: 0,
    refreshCalls: 0,
    chatCalls: 0,
    lastChatHeaders: {},
    lastChatBody: null
  };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    const send = (status, payload) => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(payload));
    };
    if (request.method === 'POST' && request.url === '/v1/install/register') {
      state.registerCalls += 1;
      const body = JSON.parse(raw || '{}');
      if (!body.installationId || !body.version) return send(400, { error: { message: 'bad registration' } });
      return send(200, {
        token: managedTokenCanary,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        tokenType: 'Bearer'
      });
    }
    if (request.method === 'POST' && request.url === '/v1/install/refresh') {
      state.refreshCalls += 1;
      return send(200, {
        token: managedTokenCanary,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        tokenType: 'Bearer'
      });
    }
    if (request.method === 'POST' && request.url === '/v1/chat/completions') {
      state.chatCalls += 1;
      state.lastChatHeaders = request.headers;
      state.lastChatBody = JSON.parse(raw || '{}');
      if (request.headers.authorization !== `Bearer ${managedTokenCanary}`) {
        return send(401, { error: { message: 'bad token' } });
      }
      return send(200, {
        id: 'chatcmpl-managed-mock',
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: 'managed proxy ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
      });
    }
    send(404, { error: { message: 'not found' } });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, state, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function waitForHealth(port) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return response.json();
    } catch {}
    await delay(200);
  }
  throw new Error('model proxy did not become healthy');
}

function spawnModelProxy(managedUrl, port) {
  const out = [];
  const child = spawn(process.execPath, ['model-proxy.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      AIW_RUNTIME_ROOT: runtimeRoot,
      AI_WORKBENCH_RUNTIME_DIR: runtimeRoot,
      AIW_PACKAGED: '1',
      MODEL_PROXY_DISABLE_LOCAL_ENV: '1',
      MANAGED_PROXY_URL: managedUrl,
      MODEL_PROXY_PORT: String(port),
      DEEPSEEK_API_KEY: '',
      AIW_SHARED_DEEPSEEK_API_KEY: '',
      MODEL_PROXY_SHARED_API_KEY: secretCanary
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  child.stdout.on('data', (chunk) => out.push(chunk.toString()));
  child.stderr.on('data', (chunk) => out.push(chunk.toString()));
  return { child, out };
}

async function runProductionChecks(productionUrl) {
  const baseUrl = productionUrl.replace(/\/+$/, '');
  const checks = [];
  const installationId = `prod-${randomUUID()}`;
  try {
    const health = await fetch(`${baseUrl}/health`);
    const healthPayload = await health.json().catch(() => ({}));
    checks.push({
      name: 'production_health',
      status: health.ok && healthPayload?.service === 'ai-workbench-managed-proxy' ? 'passed' : 'failed',
      detail: `http_status=${health.status}`
    });
    const registered = await fetch(`${baseUrl}/v1/install/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId, version: '0.4.6' })
    });
    const registeredPayload = await registered.json().catch(() => ({}));
    checks.push({
      name: 'production_install_register',
      status: registered.ok && Boolean(registeredPayload?.token) ? 'passed' : 'failed',
      detail: `http_status=${registered.status}`
    });
    if (registered.ok && registeredPayload?.token) {
      const chat = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${registeredPayload.token}`
        },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'ping' }], max_tokens: 16 })
      });
      const chatPayload = await chat.json().catch(() => ({}));
      checks.push({
        name: 'production_deepseek_upstream_call',
        status: chat.ok && Array.isArray(chatPayload?.choices) ? 'passed' : 'failed',
        detail: `http_status=${chat.status}, code=${chatPayload?.error?.code || 'none'}`
      });
    }
  } catch (error) {
    checks.push({
      name: 'production_network_call',
      status: 'failed',
      detail: error.message
    });
  }
  return checks;
}

async function main() {
  const checks = [];
  let mock;
  let child;
  const port = 18931;
  try {
    mock = await createMockManagedProxy();
    const spawned = spawnModelProxy(mock.url, port);
    child = spawned.child;
    const health = await waitForHealth(port);
    checks.push({
      name: 'local_18800_reports_managed_remote',
      status: health?.providers?.deepseek?.credentialSource === 'managed_remote' ? 'passed' : 'failed',
      detail: health?.providers?.deepseek?.credentialSource || 'missing'
    });
    const chat = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'ping' }] })
    });
    const chatPayload = await chat.json();
    checks.push({
      name: 'local_proxy_forwards_through_managed_proxy',
      status: chat.ok && chatPayload?.choices?.[0]?.message?.content === 'managed proxy ok' ? 'passed' : 'failed',
      detail: `http_status=${chat.status}, body=${JSON.stringify(chatPayload).slice(0, 240)}`
    });
    checks.push({
      name: 'managed_registration_and_token_forwarding',
      status: mock.state.registerCalls === 1 && mock.state.chatCalls === 1 && mock.state.lastChatHeaders.authorization === `Bearer ${managedTokenCanary}` ? 'passed' : 'failed',
      detail: `register=${mock.state.registerCalls}, chat=${mock.state.chatCalls}`
    });
    const persistedState = existsSync(managedConfigFile) ? readFileSync(managedConfigFile, 'utf8') : '';
    checks.push({
      name: 'managed_token_persisted_without_plain_secret',
      status: persistedState.includes(secretCanary) || persistedState.includes(managedTokenCanary) ? 'failed' : 'passed',
      detail: existsSync(managedConfigFile) ? 'managed config exists' : 'managed config missing'
    });
    const modelProxyOutput = spawned.out.join('');
    writeFileSync(modelProxyLog, modelProxyOutput, 'utf8');
    checks.push({
      name: 'logs_do_not_leak_shared_or_managed_tokens',
      status: modelProxyOutput.includes(secretCanary) || modelProxyOutput.includes(managedTokenCanary) ? 'failed' : 'passed',
      detail: 'stdout/stderr scanned'
    });
  } finally {
    if (child) {
      child.kill();
      await delay(300);
    }
    if (mock) await new Promise((resolve) => mock.server.close(resolve));
    try {
      rmSync(runtimeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {}
  }

  const productionUrl = String(process.env.AIW_PRODUCTION_MANAGED_PROXY_URL || process.env.MANAGED_PROXY_PRODUCTION_URL || '').trim();
  if (productionUrl) {
    checks.push(...await runProductionChecks(productionUrl));
  } else {
    checks.push({
      name: 'cloudflare_worker_production_deployment',
      status: 'blocked',
      detail: 'No production Cloudflare Worker URL or secrets were supplied in this run.'
    });
  }

  const failed = checks.filter((check) => check.status === 'failed');
  const blocked = checks.filter((check) => check.status === 'blocked');
  const status = failed.length ? 'failed' : blocked.length ? 'blocked' : 'passed';
  const summary = {
    task: '3A-R2.1 managed proxy production injection',
    status,
    generatedAt: new Date().toISOString(),
    mechanismTest: {
      status: failed.length ? 'failed' : 'passed',
      scope: 'local mock managed proxy plus local 18800 client integration'
    },
    productionTest: {
      status: productionUrl ? (failed.some((check) => check.name.startsWith('production_')) ? 'failed' : 'passed') : 'blocked',
      scope: 'real Cloudflare Worker, D1, Worker Secrets and DeepSeek upstream',
      blocker: productionUrl ? '' : 'Cloudflare account, D1 database id, Worker secrets and production URL were not available to this local run.'
    },
    checks
  };
  writeJson(summaryFile, summary);
  writeFileSync(reportFile, [
    '# 3A-R2.1 Managed Proxy 验收报告',
    '',
    `- 总状态：${status}`,
    `- 机制测试：${summary.mechanismTest.status}`,
    `- 生产验证：${summary.productionTest.status}`,
    '',
    '## 检查项',
    ...checks.map((check) => `- ${check.status}: ${check.name} - ${check.detail}`),
    '',
    '## 结论',
    '',
    blocked.length
      ? '本地远程托管代理机制已通过 mock 验证；真实 Cloudflare Worker / D1 / Secret / DeepSeek 上游生产注入未执行，状态保持 blocked。'
      : '本地机制和生产 URL 调用均已完成；生产状态以 summary.json 的 production_* 检查项为准。'
  ].join('\n'), 'utf8');
  if (status === 'failed') process.exitCode = 1;
}

main().catch((error) => {
  mkdirSync(verificationDir, { recursive: true });
  writeJson(summaryFile, {
    task: '3A-R2.1 managed proxy production injection',
    status: 'failed',
    generatedAt: new Date().toISOString(),
    error: error.message
  });
  writeFileSync(reportFile, `# 3A-R2.1 Managed Proxy 验收报告\n\n- 总状态：failed\n- 失败原因：${error.message}\n`, 'utf8');
  process.exit(1);
});
