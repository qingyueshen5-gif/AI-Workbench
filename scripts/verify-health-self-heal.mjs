import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 19883;
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', (chunk) => {
  output += chunk;
});
server.stderr.on('data', (chunk) => {
  output += chunk;
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, method = 'GET', payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.json();
  return { response, body };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const { response } = await request('/api/health/status');
      if (response.ok) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error(`API server did not start.\n${output}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function noTechnicalLeak(text) {
  const value = String(text || '').toLowerCase();
  return !['econnrefused', 'timeout', 'permission denied', 'eacces', 'traceback'].some((term) => value.includes(term));
}

async function main() {
  await waitForServer();

  const network = await request('/api/health/self-heal', 'POST', {
    issue: {
      issueType: 'network',
      message: 'ECONNREFUSED',
      recoverAt: 2
    },
    maxRetries: 3,
    retryDelayMs: 1
  });
  assert(network.response.ok, 'network self-heal request failed');
  assert(network.body.ok === true && network.body.healed === true, 'network scenario should auto recover');
  assert(network.body.userVisible === false, 'network recovered scenario should not show user error');

  const permission = await request('/api/health/self-heal', 'POST', {
    issue: {
      issueType: 'permission',
      message: 'Permission denied on C:\\Users\\user\\AppData\\Local\\hermes\\logs\\.__agent.lock',
      code: 'EACCES'
    }
  });
  assert(permission.response.ok, 'permission self-heal request failed');
  assert(permission.body.userVisible === true, 'permission scenario should degrade with user action');
  assert(noTechnicalLeak(permission.body.userMessage), 'permission user message leaked technical terms');
  assert(
    permission.body.suggestedActions.some((action) => action.isClickable && action.action === '点这里获取权限'),
    'permission scenario should provide clickable permission action'
  );

  const missingEnv = await request('/api/health/self-heal', 'POST', {
    issue: {
      issueType: 'missing_env',
      envKey: 'DEEPSEEK_API_KEY'
    }
  });
  assert(missingEnv.response.ok, 'missing env self-heal request failed');
  assert(missingEnv.body.userMessage.includes('缺少 DEEPSEEK_API_KEY 配置'), 'missing env message should mention quick setup');
  assert(
    missingEnv.body.suggestedActions.some((action) => action.isClickable && action.action === '点这里配置 DEEPSEEK_API_KEY'),
    'missing env scenario should provide clickable setup action'
  );

  console.log(JSON.stringify({
    networkDisconnectedThenRecovered: network.body,
    permissionDeniedGracefulFallback: permission.body,
    missingApiKeyDetectedBeforeCall: missingEnv.body
  }, null, 2));
}

try {
  await main();
} finally {
  server.kill();
}
