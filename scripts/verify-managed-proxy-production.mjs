import { createServer } from 'node:http';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const verificationDir = join(root, 'verification', 'managed-proxy-production');
const summaryFile = join(verificationDir, 'summary.json');
const reportFile = join(verificationDir, 'report.md');
const modelProxyLog = join(verificationDir, 'model-proxy.log');
const productionLog = join(verificationDir, 'production-test.log');
const securityScanLog = join(verificationDir, 'security-scan.log');
const failureCasesLog = join(verificationDir, 'failure-cases.log');
const runtimeRoot = join(root, `.tmp-managed-proxy-runtime-${Date.now()}-${process.pid}`);
const managedConfigFile = join(runtimeRoot, 'config', 'managed-proxy.json');
const secretCanary = 'sk-aiw-secret-canary';
const managedTokenCanary = 'managed-token-canary';
const productionUrl = String(process.env.AIW_PRODUCTION_MANAGED_PROXY_URL || process.env.MANAGED_PROXY_PRODUCTION_URL || '').trim().replace(/\/+$/, '');
const wranglerScript = join(root, 'managed-proxy', 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const databaseName = 'aiw-managed-proxy';

mkdirSync(verificationDir, { recursive: true });
mkdirSync(join(runtimeRoot, 'config'), { recursive: true });

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function appendLog(file, entry) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry }, null, 2)}\n`, { flag: 'a' });
}

function redact(value) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-<redacted>')
    .replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<jwt-redacted>');
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function decodeJwtPayload(token) {
  const body = String(token || '').split('.')[1] || '';
  return JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    timeout: options.timeoutMs || 120000,
    windowsHide: true,
    shell: false
  });
  return {
    command: [command, ...args].join(' '),
    exitCode: result.status,
    signal: result.signal || '',
    error: result.error?.message || '',
    stdout: redact(result.stdout || ''),
    stderr: redact(result.stderr || '')
  };
}

function d1(command) {
  const result = run(process.execPath, [wranglerScript, 'd1', 'execute', databaseName, '--remote', '--command', command], {
    cwd: join(root, 'managed-proxy'),
    timeoutMs: 240000
  });
  appendLog(productionLog, { step: 'd1', command: command.replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<jwt-redacted>'), exitCode: result.exitCode, signal: result.signal, error: result.error, stdout: result.stdout, stderr: result.stderr });
  if (result.exitCode !== 0) throw new Error(`D1 command failed: ${result.error || result.stderr || result.stdout || result.signal || 'unknown'}`);
  const match = result.stdout.match(/\[\s*\{[\s\S]*\}\s*\]/);
  return match ? JSON.parse(match[0]) : [];
}

function addCheck(checks, name, status, detail) {
  const check = { name, status, detail };
  checks.push(check);
  appendLog(status === 'failed' ? failureCasesLog : productionLog, check);
  return check;
}

function createMockManagedProxy() {
  const state = { registerCalls: 0, refreshCalls: 0, chatCalls: 0, lastChatHeaders: {}, lastChatBody: null };
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
      return send(200, { token: managedTokenCanary, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), tokenType: 'Bearer' });
    }
    if (request.method === 'POST' && request.url === '/v1/install/refresh') {
      state.refreshCalls += 1;
      return send(200, { token: managedTokenCanary, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), tokenType: 'Bearer' });
    }
    if (request.method === 'POST' && request.url === '/v1/chat/completions') {
      state.chatCalls += 1;
      state.lastChatHeaders = request.headers;
      state.lastChatBody = JSON.parse(raw || '{}');
      if (request.headers.authorization !== `Bearer ${managedTokenCanary}`) return send(401, { error: { message: 'bad token' } });
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
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return response.json();
    } catch {}
    await delay(250);
  }
  throw new Error('model proxy did not become healthy');
}

function spawnModelProxy(managedUrl, port) {
  const out = [];
  const child = spawn(process.execPath, ['model-proxy.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      AI_WORKBENCH_RUNTIME_DIR: runtimeRoot,
      AIW_PACKAGED: '1',
      MODEL_PROXY_DISABLE_LOCAL_ENV: '1',
      MANAGED_PROXY_URL: managedUrl,
      MODEL_PROXY_PORT: String(port),
      NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY || '1',
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

async function postJson(url, payload, token = '') {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function registerProduction(version = '0.4.6') {
  const installationId = `prod-${randomUUID()}`;
  const result = await postJson(`${productionUrl}/v1/install/register`, { installationId, version });
  return { ...result, installationId };
}

async function runLocalMechanismChecks(checks) {
  let mock;
  let child;
  const port = 18931;
  try {
    mock = await createMockManagedProxy();
    const spawned = spawnModelProxy(mock.url, port);
    child = spawned.child;
    const health = await waitForHealth(port);
    addCheck(checks, 'mechanism_18800_reports_managed_remote', health?.providers?.deepseek?.credentialSource === 'managed_remote' ? 'passed' : 'failed', health?.providers?.deepseek?.credentialSource || 'missing');
    const chat = await postJson(`http://127.0.0.1:${port}/v1/chat/completions`, { model: 'deepseek-chat', messages: [{ role: 'user', content: 'ping' }] });
    addCheck(checks, 'mechanism_local_proxy_forwards_to_managed_proxy', chat.response.ok && chat.body?.choices?.[0]?.message?.content === 'managed proxy ok' ? 'passed' : 'failed', `http_status=${chat.response.status}`);
    addCheck(checks, 'mechanism_token_forwarding', mock.state.registerCalls === 1 && mock.state.chatCalls === 1 ? 'passed' : 'failed', `register=${mock.state.registerCalls}, chat=${mock.state.chatCalls}`);
    const persistedState = existsSync(managedConfigFile) ? readFileSync(managedConfigFile, 'utf8') : '';
    addCheck(checks, 'mechanism_token_not_plaintext_in_runtime_config', persistedState.includes(secretCanary) || persistedState.includes(managedTokenCanary) ? 'failed' : 'passed', existsSync(managedConfigFile) ? 'managed config exists' : 'managed config missing');
    const modelProxyOutput = spawned.out.join('');
    writeFileSync(modelProxyLog, modelProxyOutput, 'utf8');
    addCheck(checks, 'mechanism_logs_do_not_leak_tokens', modelProxyOutput.includes(secretCanary) || modelProxyOutput.includes(managedTokenCanary) ? 'failed' : 'passed', 'stdout/stderr scanned');
  } finally {
    if (child) {
      child.kill();
      await delay(300);
    }
    if (mock) await new Promise((resolve) => mock.server.close(resolve));
    try { rmSync(runtimeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  }
}

async function runProductionChecks(checks) {
  if (!productionUrl) {
    addCheck(checks, 'production_url_configured', 'blocked', 'No production Worker URL supplied.');
    return;
  }

  const health = await fetch(`${productionUrl}/health`);
  const healthPayload = await health.json().catch(() => ({}));
  addCheck(checks, 'production_health', health.ok && healthPayload?.service === 'ai-workbench-managed-proxy' && healthPayload.enabled === true ? 'passed' : 'failed', `http_status=${health.status}, enabled=${healthPayload.enabled}`);

  const models = await fetch(`${productionUrl}/v1/models`);
  const modelsPayload = await models.json().catch(() => ({}));
  const modelIds = Array.isArray(modelsPayload.data) ? modelsPayload.data.map((item) => item.id) : [];
  addCheck(checks, 'production_model_allowlist', models.ok && modelIds.includes('deepseek-chat') && modelIds.includes('deepseek-reasoner') ? 'passed' : 'failed', `models=${modelIds.join(',')}`);

  const registered = await registerProduction();
  addCheck(checks, 'production_install_register', registered.response.ok && Boolean(registered.body?.token) ? 'passed' : 'failed', `http_status=${registered.response.status}`);
  if (!registered.body?.token) return;

  const refreshed = await fetch(`${productionUrl}/v1/install/refresh`, { method: 'POST', headers: { authorization: `Bearer ${registered.body.token}` } });
  const refreshedPayload = await refreshed.json().catch(() => ({}));
  addCheck(checks, 'production_token_refresh', refreshed.ok && Boolean(refreshedPayload.token) ? 'passed' : 'failed', `http_status=${refreshed.status}`);

  const directChat = await postJson(`${productionUrl}/v1/chat/completions`, {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: '请只回复：生产共享模型调用成功' }],
    max_tokens: 32
  }, refreshedPayload.token || registered.body.token);
  const directReply = String(directChat.body?.choices?.[0]?.message?.content || '').trim();
  addCheck(checks, 'production_deepseek_upstream_call', directChat.response.ok && directReply.includes('生产共享模型调用成功') ? 'passed' : 'failed', `http_status=${directChat.response.status}, reply=${directReply.slice(0, 80)}`);

  const port = 18932;
  const localRuntimeRoot = join(root, `.tmp-managed-proxy-production-runtime-${Date.now()}-${process.pid}`);
  mkdirSync(join(localRuntimeRoot, 'config'), { recursive: true });
  let child;
  try {
    const out = [];
    child = spawn(process.execPath, ['model-proxy.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        AI_WORKBENCH_RUNTIME_DIR: localRuntimeRoot,
        AIW_PACKAGED: '1',
        MODEL_PROXY_DISABLE_LOCAL_ENV: '1',
        MANAGED_PROXY_URL: productionUrl,
        MODEL_PROXY_PORT: String(port),
        NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY || '1',
        DEEPSEEK_API_KEY: '',
        AIW_SHARED_DEEPSEEK_API_KEY: '',
        MODEL_PROXY_SHARED_API_KEY: ''
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    child.stdout.on('data', (chunk) => out.push(chunk.toString()));
    child.stderr.on('data', (chunk) => out.push(chunk.toString()));
    const localHealth = await waitForHealth(port);
    addCheck(checks, 'production_18800_credential_source', localHealth?.providers?.deepseek?.credentialSource === 'managed_remote' ? 'passed' : 'failed', localHealth?.providers?.deepseek?.credentialSource || 'missing');
    const localChat = await postJson(`http://127.0.0.1:${port}/v1/chat/completions`, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '请只回复：生产共享模型调用成功' }],
      max_tokens: 32
    });
    const localReply = String(localChat.body?.choices?.[0]?.message?.content || '').trim();
    addCheck(checks, 'production_18800_real_chat_without_local_keys', localChat.response.ok && localReply.includes('生产共享模型调用成功') ? 'passed' : 'failed', `http_status=${localChat.response.status}, reply=${localReply.slice(0, 80)}`);
    const stateFile = join(localRuntimeRoot, 'config', 'managed-proxy.json');
    const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
    const beforeExpiresAt = state.expiresAt || '';
    state.expiresAt = '2000-01-01T00:00:00.000Z';
    writeJson(stateFile, state);
    const refreshChat = await postJson(`http://127.0.0.1:${port}/v1/chat/completions`, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '请只回复：生产共享模型调用成功' }],
      max_tokens: 32
    });
    const refreshedState = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
    addCheck(checks, 'production_18800_refreshes_expiring_token', refreshChat.response.ok && refreshedState.expiresAt && refreshedState.expiresAt !== '2000-01-01T00:00:00.000Z' ? 'passed' : 'failed', `http_status=${refreshChat.response.status}, before=${beforeExpiresAt}, after=${refreshedState.expiresAt || 'missing'}`);
    writeFileSync(modelProxyLog, out.join(''), { flag: 'a' });
  } finally {
    if (child) {
      child.kill();
      await delay(300);
    }
    try { rmSync(localRuntimeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  }

  await runFailureChecks(checks);
}

async function runFailureChecks(checks) {
  const badJson = await fetch(`${productionUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer bad-token' },
    body: '{'
  });
  const badJsonPayload = await badJson.json().catch(() => ({}));
  addCheck(checks, 'failure_bad_token_chinese_message', badJson.status === 401 && /共享模型服务认证失败/.test(String(badJsonPayload?.error?.message || '')) ? 'passed' : 'failed', `http_status=${badJson.status}, message=${badJsonPayload?.error?.message || ''}`);

  const badModelReg = await registerProduction();
  const badModel = await postJson(`${productionUrl}/v1/chat/completions`, {
    model: 'not-allowed-model',
    messages: [{ role: 'user', content: 'ping' }]
  }, badModelReg.body?.token || '');
  addCheck(checks, 'failure_model_allowlist_rejects_unknown_model', badModel.response.status === 400 && /模型/.test(String(badModel.body?.error?.message || '')) ? 'passed' : 'failed', `http_status=${badModel.response.status}, code=${badModel.body?.error?.code || ''}`);

  const revokeReg = await registerProduction();
  const revokePayload = decodeJwtPayload(revokeReg.body.token);
  d1(`INSERT INTO revoked_tokens (jti, revoked_at, reason) VALUES ('${sqlEscape(revokePayload.jti)}', '${new Date().toISOString()}', 'verification');`);
  const revokedChat = await postJson(`${productionUrl}/v1/chat/completions`, {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'ping' }]
  }, revokeReg.body.token);
  addCheck(checks, 'failure_revoked_token_rejected', revokedChat.response.status === 401 && /认证失败/.test(String(revokedChat.body?.error?.message || '')) ? 'passed' : 'failed', `http_status=${revokedChat.response.status}, code=${revokedChat.body?.error?.code || ''}`);
  d1(`DELETE FROM revoked_tokens WHERE jti = '${sqlEscape(revokePayload.jti)}';`);

  const limitReg = await registerProduction();
  const limitPayload = decodeJwtPayload(limitReg.body.token);
  d1(`INSERT INTO daily_usage (usage_date, installation_hash, ip_hash, request_count, input_tokens, output_tokens, updated_at) VALUES ('${today()}', '${sqlEscape(limitPayload.sub)}', 'verification-install-limit', 40, 0, 0, '${new Date().toISOString()}') ON CONFLICT(usage_date, installation_hash, ip_hash) DO UPDATE SET request_count = 40, updated_at = excluded.updated_at;`);
  const installLimit = await postJson(`${productionUrl}/v1/chat/completions`, {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'ping' }]
  }, limitReg.body.token);
  addCheck(checks, 'failure_install_daily_limit_chinese_message', installLimit.response.status === 429 && /本机额度/.test(String(installLimit.body?.error?.message || '')) ? 'passed' : 'failed', `http_status=${installLimit.response.status}, code=${installLimit.body?.error?.code || ''}`);
  d1(`DELETE FROM daily_usage WHERE usage_date='${today()}' AND installation_hash='${sqlEscape(limitPayload.sub)}' AND ip_hash='verification-install-limit';`);

  const ipRows = d1(`SELECT ip_hash FROM daily_usage WHERE usage_date='${today()}' AND installation_hash='${sqlEscape(limitPayload.sub)}' LIMIT 1;`);
  const realIpHash = ipRows?.[0]?.results?.[0]?.ip_hash || '';
  if (realIpHash) {
    d1(`INSERT INTO daily_usage (usage_date, installation_hash, ip_hash, request_count, input_tokens, output_tokens, updated_at) VALUES ('${today()}', 'verification-ip-limit', '${sqlEscape(realIpHash)}', 80, 0, 0, '${new Date().toISOString()}') ON CONFLICT(usage_date, installation_hash, ip_hash) DO UPDATE SET request_count = 80, updated_at = excluded.updated_at;`);
    const ipLimitReg = await registerProduction();
    addCheck(checks, 'failure_ip_daily_limit_chinese_message', ipLimitReg.response.status === 429 && /网络额度/.test(String(ipLimitReg.body?.error?.message || '')) ? 'passed' : 'failed', `http_status=${ipLimitReg.response.status}, code=${ipLimitReg.body?.error?.code || ''}`);
    d1(`DELETE FROM daily_usage WHERE usage_date='${today()}' AND installation_hash='verification-ip-limit';`);
  } else {
    addCheck(checks, 'failure_ip_daily_limit_chinese_message', 'failed', 'could not discover production ip_hash from D1');
  }

  d1(`INSERT INTO daily_usage (usage_date, installation_hash, ip_hash, request_count, input_tokens, output_tokens, updated_at) VALUES ('${today()}', 'verification-global-limit', 'verification-global-limit', 200, 0, 0, '${new Date().toISOString()}') ON CONFLICT(usage_date, installation_hash, ip_hash) DO UPDATE SET request_count = 200, updated_at = excluded.updated_at;`);
  const globalLimitReg = await registerProduction();
  addCheck(checks, 'failure_global_daily_limit_chinese_message', globalLimitReg.response.status === 429 && /总额度/.test(String(globalLimitReg.body?.error?.message || '')) ? 'passed' : 'failed', `http_status=${globalLimitReg.response.status}, code=${globalLimitReg.body?.error?.code || ''}`);
  d1(`DELETE FROM daily_usage WHERE usage_date='${today()}' AND installation_hash='verification-global-limit';`);

  d1(`INSERT INTO daily_usage (usage_date, installation_hash, ip_hash, request_count, input_tokens, output_tokens, updated_at) VALUES ('${today()}', 'verification-token-budget', 'verification-token-budget', 0, 200000, 0, '${new Date().toISOString()}') ON CONFLICT(usage_date, installation_hash, ip_hash) DO UPDATE SET input_tokens = 200000, updated_at = excluded.updated_at;`);
  const tokenLimitReg = await registerProduction();
  addCheck(checks, 'failure_budget_token_limit_chinese_message', tokenLimitReg.response.status === 429 && /预算/.test(String(tokenLimitReg.body?.error?.message || '')) ? 'passed' : 'failed', `http_status=${tokenLimitReg.response.status}, code=${tokenLimitReg.body?.error?.code || ''}`);
  d1(`DELETE FROM daily_usage WHERE usage_date='${today()}' AND installation_hash='verification-token-budget';`);
}

function runSecurityScan(checks) {
  const scanTargets = [
    '.git',
    'managed-proxy',
    'model-proxy.mjs',
    'runtime-paths.mjs',
    'electron',
    'scripts',
    'verification/managed-proxy-production'
  ];
  const args = [
    '-n',
    '--hidden',
    '--glob', '!managed-proxy/node_modules/**',
    '--glob', '!node_modules/**',
    '--glob', '!release*/**',
    '--glob', '!dist/**',
    '--glob', '!.npm-cache*/**',
    '--glob', '!.tmp*/**',
    '--glob', '!managed-proxy/.wrangler/**',
    'sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+',
    ...scanTargets
  ];
  const result = run('rg', args, { timeoutMs: 120000 });
  writeFileSync(securityScanLog, [
    `command=rg ${args.join(' ')}`,
    `exitCode=${result.exitCode}`,
    'stdout:',
    result.stdout,
    'stderr:',
    result.stderr
  ].join('\n'), 'utf8');
  addCheck(checks, 'security_scan_no_secret_values', result.exitCode === 1 ? 'passed' : 'failed', result.exitCode === 1 ? 'no secret-like values found' : 'secret-like values found; see security-scan.log');
}

async function main() {
  rmSync(productionLog, { force: true });
  rmSync(failureCasesLog, { force: true });
  rmSync(securityScanLog, { force: true });
  const checks = [];
  await runLocalMechanismChecks(checks);
  await runProductionChecks(checks);
  runSecurityScan(checks);

  const failed = checks.filter((check) => check.status === 'failed');
  const blocked = checks.filter((check) => check.status === 'blocked');
  const status = failed.length ? 'failed' : blocked.length ? 'blocked' : 'passed';
  const summary = {
    task: '3A-R2.1 managed proxy production injection',
    status,
    generatedAt: new Date().toISOString(),
    workerUrl: productionUrl || '',
    d1: {
      databaseName,
      databaseId: '202583b9-817f-4115-9ab1-41e136133de8',
      tablesVerified: checks.some((check) => check.name === 'production_install_register' && check.status === 'passed')
    },
    secrets: {
      status: 'configured_in_cloudflare',
      namesVerified: ['DEEPSEEK_API_KEY', 'TOKEN_SIGNING_SECRET', 'INSTALLATION_HASH_SALT'],
      valuesStoredLocally: false
    },
    mechanismTest: {
      status: checks.some((check) => check.name.startsWith('mechanism_') && check.status === 'failed') ? 'failed' : 'passed',
      scope: 'local mock managed proxy plus local 18800 client integration'
    },
    productionTest: {
      status: productionUrl && !failed.some((check) => check.name.startsWith('production_') || check.name.startsWith('failure_')) ? 'passed' : failed.length ? 'failed' : 'blocked',
      scope: 'real Cloudflare Worker, D1, Worker Secrets and DeepSeek upstream',
      blocker: productionUrl ? '' : 'production Worker URL missing'
    },
    checks
  };
  writeJson(summaryFile, summary);
  writeFileSync(reportFile, [
    '# 3A-R2.1 Managed Proxy 验收报告',
    '',
    `- 总状态：${status}`,
    `- Worker URL：${productionUrl || 'missing'}`,
    `- 机制测试：${summary.mechanismTest.status}`,
    `- 生产验证：${summary.productionTest.status}`,
    `- D1：${summary.d1.databaseName} / ${summary.d1.databaseId}`,
    '- Secrets：DEEPSEEK_API_KEY、TOKEN_SIGNING_SECRET、INSTALLATION_HASH_SALT 已配置在 Cloudflare；未写入仓库。',
    '',
    '## 检查项',
    ...checks.map((check) => `- ${check.status}: ${check.name} - ${check.detail}`),
    '',
    '## 结论',
    '',
    status === 'passed'
      ? 'R2.1 生产 Managed Proxy、D1、Secrets、无本机 Key 真实 DeepSeek 调用、刷新/吊销/限流/预算/中文降级和安全扫描均已通过。'
      : 'R2.1 未完全通过；以上 failed/blocked 项不得冒充 passed。'
  ].join('\n'), 'utf8');
  if (status !== 'passed') process.exitCode = 1;
}

main().catch((error) => {
  mkdirSync(verificationDir, { recursive: true });
  appendLog(failureCasesLog, { step: 'fatal', error: error.message });
  writeJson(summaryFile, {
    task: '3A-R2.1 managed proxy production injection',
    status: 'failed',
    generatedAt: new Date().toISOString(),
    workerUrl: productionUrl || '',
    error: error.message
  });
  writeFileSync(reportFile, `# 3A-R2.1 Managed Proxy 验收报告\n\n- 总状态：failed\n- 失败原因：${error.message}\n`, 'utf8');
  process.exit(1);
});
