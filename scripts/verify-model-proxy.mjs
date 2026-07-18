import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const proxyUrl = process.env.MODEL_PROXY_BASE_URL || 'http://127.0.0.1:18800/v1';
const healthUrl = proxyUrl.replace(/\/v1\/?$/, '/health');
const logFile = join(root, 'data', 'model-proxy-calls.jsonl');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 15000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(healthUrl);
      const payload = await response.json();
      if (response.ok && payload.ok) return payload;
      lastError = new Error(payload?.status || `HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw lastError || new Error('model proxy health check timed out');
}

function startProxyIfNeeded() {
  const child = spawn(process.execPath, ['model-proxy.mjs'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: process.env
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString('utf8');
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString('utf8');
  });
  return { child, output: () => output };
}

async function chat(employee, content, headers = {}) {
  const response = await fetch(`${proxyUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer aiw.${employee}.local`,
      'x-aiw-employee': employee,
      ...headers
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content }],
      stream: false
    })
  });
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${employee} proxy chat failed: ${payload?.error?.message || response.status}`);
  const text = payload?.choices?.[0]?.message?.content || '';
  assert(text.trim(), `${employee} proxy chat returned empty content`);
  return { payload, text };
}

function latestLogs() {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-20)
    .map((line) => JSON.parse(line));
}

function assertNoRealKeyInEmployeeConfig() {
  const files = [
    'agents/adapters/deepseek.mjs',
    'agents/adapters/hermes.mjs',
    '.hermes-runtime/config.yaml',
    '.hermes-runtime/.env'
  ];
  for (const file of files) {
    const path = join(root, file);
    if (!existsSync(path) || !statSync(path).isFile()) continue;
    const text = readFileSync(path, 'utf8');
    assert(!/sk-[A-Za-z0-9]{12,}/.test(text), `${file} contains a real-looking API key`);
  }
  const hermesConfig = join(root, '.hermes-runtime/config.yaml');
  if (existsSync(hermesConfig)) {
    const text = readFileSync(hermesConfig, 'utf8');
    assert(text.includes('http://127.0.0.1:18800/v1'), 'Hermes config is not pointed at the local model proxy');
    assert(text.includes('aiw.hermes.local'), 'Hermes config does not use the local placeholder token');
  }
}

let started = null;
try {
  try {
    await waitForHealth(1500);
  } catch {
    started = startProxyIfNeeded();
    await waitForHealth();
  }

  const health = await waitForHealth();
  assert(health.loopbackOnly === true, 'model proxy must be loopback-only');

  const chatResult = await chat('verify', '用中文回复：代理验收OK');
  const retryResult = await chat('retry-check', '用中文回复：重试验收OK', {
    'x-aiw-simulate-network-fail-once': '1'
  });
  const logs = latestLogs();
  assert(logs.some((entry) => entry.employee === 'verify' && entry.statusCode >= 200 && entry.statusCode < 300), 'verify employee call was not logged');
  assert(logs.some((entry) => entry.employee === 'retry-check' && entry.attempts >= 2 && entry.statusCode >= 200 && entry.statusCode < 300), 'proxy retry was not logged as successful');

  assertNoRealKeyInEmployeeConfig();

  console.log(JSON.stringify({
    ok: true,
    health,
    chat: chatResult.text.trim().slice(0, 120),
    retry: retryResult.text.trim().slice(0, 120),
    recentProxyLogs: logs.slice(-5)
  }, null, 2));
} finally {
  if (started?.child && !started.child.killed) started.child.kill();
}
