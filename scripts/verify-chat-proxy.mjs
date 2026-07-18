import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const apiPort = 18788;
const proxyPort = 18881;
const baseUrl = `http://127.0.0.1:${apiPort}`;
const proxyBaseUrl = `http://127.0.0.1:${proxyPort}/v1`;
const logFile = join(root, 'data', 'model-proxy-calls.jsonl');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApi(timeoutMs = 15000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/data`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw lastError || new Error('API did not start');
}

function recentLogs() {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-30)
    .map((line) => JSON.parse(line));
}

const proxy = spawn(process.execPath, ['model-proxy.mjs'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
  env: { ...process.env, MODEL_PROXY_PORT: String(proxyPort) }
});

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
  env: { ...process.env, PORT: String(apiPort), MODEL_PROXY_BASE_URL: proxyBaseUrl }
});

try {
  await waitForApi();
  const response = await fetch(`${baseUrl}/api/chat-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '请用一句中文回复：聊天框代理链路验收通过。',
      conversationId: ''
    })
  });
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, payload.error || `HTTP ${response.status}`);
  const conversation = payload.data?.conversations?.find((item) => item.id === payload.data?.activeConversationId);
  const reply = [...(conversation?.messages || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
  assert(reply.trim(), 'chat response did not include an assistant reply');
  const logs = recentLogs();
  assert(logs.some((entry) => ['deepseek', 'workbench'].includes(entry.employee) && entry.statusCode >= 200 && entry.statusCode < 300), 'chat did not produce a successful model proxy log');
  console.log(JSON.stringify({
    ok: true,
    routedAgentId: payload.routedAgentId,
    reply: reply.slice(0, 300),
    recentProxyLogs: logs.slice(-5)
  }, null, 2));
} finally {
  proxy.kill();
  server.kill();
}
