import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAgentRegistry } from '../agents/registry.mjs';

const root = process.cwd();
const proxyBaseUrl = process.env.MODEL_PROXY_BASE_URL || 'http://127.0.0.1:18800/v1';
const healthUrl = proxyBaseUrl.replace(/\/v1\/?$/, '/health');
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

function startProxy() {
  return spawn(process.execPath, ['model-proxy.mjs'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: process.env
  });
}

function proxyLogs() {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

let proxy = null;
try {
  try {
    await waitForHealth(1500);
  } catch {
    proxy = startProxy();
    await waitForHealth();
  }
  const registry = await createAgentRegistry();
  const logCountBefore = proxyLogs().length;
  const result = await registry.invoke('hermes', {
    id: 'verify-hermes-proxy',
    title: '验证 Hermes 本机代理链路',
    userGoal: '请只用一句中文回答：Hermes 已通过本机模型代理完成验证。'
  }, {
    cwd: root,
    toolsets: 'terminal',
    timeoutMs: 180000,
    model: 'deepseek-chat'
  });
  const verification = registry.verify('hermes', result);
  assert(result.status === 'done', result.error?.message || 'Hermes task did not finish');
  assert(verification.ok, verification.message || 'Hermes result did not pass adapter verification');
  const newLogs = proxyLogs().slice(logCountBefore);
  assert(newLogs.some((entry) => entry.employee === 'hermes' && entry.path === '/chat/completions' && entry.statusCode >= 200 && entry.statusCode < 300), 'Hermes did not produce a successful chat completion through the model proxy');
  console.log(JSON.stringify({
    ok: true,
    status: result.status,
    verification,
    output: String(result.output?.result?.text || '').slice(0, 500),
    evidence: {
      commandRun: result.evidence?.commandRun,
      exitCode: result.evidence?.exitCode,
      durationMs: result.evidence?.durationMs
    },
    proxyLogs: newLogs.filter((entry) => entry.employee === 'hermes').slice(-5)
  }, null, 2));
} finally {
  if (proxy && !proxy.killed) proxy.kill();
}
