import { spawn } from 'node:child_process';

const root = process.cwd();
const proxyBaseUrl = process.env.MODEL_PROXY_BASE_URL || 'http://127.0.0.1:18800/v1';
const healthUrl = proxyBaseUrl.replace(/\/v1\/?$/, '/health');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProxy(timeoutMs = 15000) {
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

let proxy = null;
try {
  try {
    await waitForProxy(1500);
  } catch {
    proxy = startProxy();
    await waitForProxy();
  }

  const { agentRegistry } = await import('../agents/registry.mjs');

  const results = [];

  for (const agent of agentRegistry.listAgents()) {
    const result = await agentRegistry.healthCheck(agent.id);
    results.push({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      ok: result.ok,
      status: result.status,
      checkedAt: result.checkedAt,
      evidence: result.evidence || null,
      error: result.error || null
    });
  }

  console.log(JSON.stringify({ agents: results }, null, 2));

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    process.exitCode = 1;
  }
} finally {
  if (proxy && !proxy.killed) proxy.kill();
}
