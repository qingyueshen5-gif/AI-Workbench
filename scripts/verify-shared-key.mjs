import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const root = process.cwd();
const proxyPort = 18882;
const proxyBaseUrl = `http://127.0.0.1:${proxyPort}/v1`;
const proxyHealthUrl = `http://127.0.0.1:${proxyPort}/health`;
const sharedKey = 'aiw-shared-managed-test-key';
const verificationDir = join(root, 'verification', 'shared-key');
const summaryFile = join(verificationDir, 'summary.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function startMockUpstream() {
  const seen = [];
  const server = createServer(async (request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk.toString('utf8'); });
    request.on('end', () => {
      seen.push({
        method: request.method,
        url: request.url,
        authorization: String(request.headers.authorization || ''),
        body
      });
      if (request.url === '/v1/chat/completions' && request.method === 'POST') {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({
          id: 'chatcmpl-shared-key-verify',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: '共享 key 验收通过。' },
            finish_reason: 'stop'
          }]
        }));
        return;
      }
      response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: { message: 'not found' } }));
    });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
        close: () => new Promise((resolveClose) => server.close(resolveClose)),
        seen
      });
    });
  });
}

async function waitForHealth(timeoutMs = 10000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(proxyHealthUrl);
      const payload = await response.json();
      if (response.ok && payload.defaultProvider === 'deepseek') return payload;
      lastError = new Error(payload?.status || `HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(300);
  }
  throw lastError || new Error('shared-key proxy health check timed out');
}

async function chat() {
  const response = await fetch(`${proxyBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer aiw.verify.local',
      'x-aiw-employee': 'verify-shared-key'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '请回复共享 key 验收通过。' }],
      stream: false
    })
  });
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, payload?.error?.message || `HTTP ${response.status}`);
  return payload;
}

function redact(value) {
  return JSON.stringify(value).replaceAll(sharedKey, '<leaked-shared-key>');
}

const mock = await startMockUpstream();
const runtimeRoot = join(tmpdir(), `aiw-shared-key-${process.pid}`);
const logFile = join(runtimeRoot, 'logs', 'model-proxy-calls.jsonl');
const env = {
  ...process.env,
  MODEL_PROXY_PORT: String(proxyPort),
  MODEL_PROXY_DISABLE_LOCAL_ENV: '1',
  MODEL_PROXY_DEEPSEEK_BASE_URL: mock.baseUrl,
  AI_WORKBENCH_RUNTIME_DIR: runtimeRoot,
  AIW_SHARED_DEEPSEEK_API_KEY: sharedKey
};
delete env.DEEPSEEK_API_KEY;
delete env.MODEL_PROXY_SHARED_API_KEY;

const proxy = spawn(process.execPath, ['model-proxy.mjs'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
  env
});

let proxyOutput = '';
proxy.stdout.on('data', (chunk) => { proxyOutput += chunk.toString('utf8'); });
proxy.stderr.on('data', (chunk) => { proxyOutput += chunk.toString('utf8'); });

try {
  const health = await waitForHealth();
  assert(health.ok, 'shared managed key did not make model proxy healthy');
  assert(health.providers?.deepseek?.configured, 'deepseek provider is not configured');
  assert(health.providers?.deepseek?.credentialSource === 'shared_managed', 'health did not report shared managed credential source');
  assert(!JSON.stringify(health).includes(sharedKey), 'health response leaked shared key');

  const payload = await chat();
  assert(payload.choices?.[0]?.message?.content?.trim(), 'shared-key chat returned empty content');
  assert(mock.seen.some((entry) => entry.authorization === `Bearer ${sharedKey}`), 'proxy did not forward the shared key to upstream');

  const logText = existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
  assert(!logText.includes(sharedKey), 'model proxy logs leaked shared key');
  assert(!proxyOutput.includes(sharedKey), 'model proxy process output leaked shared key');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    proxy: {
      port: proxyPort,
      health: {
        ok: health.ok,
        status: health.status,
        defaultProvider: health.defaultProvider,
        credentialSource: health.providers?.deepseek?.credentialSource
      }
    },
    upstream: {
      receivedCalls: mock.seen.length,
      receivedSharedAuthorization: mock.seen.some((entry) => entry.authorization === `Bearer ${sharedKey}`)
    },
    leakageScan: {
      health: !redact(health).includes('<leaked-shared-key>'),
      logs: !logText.includes(sharedKey),
      processOutput: !proxyOutput.includes(sharedKey)
    }
  };
  writeJson(summaryFile, summary);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  proxy.kill();
  await mock.close();
}
