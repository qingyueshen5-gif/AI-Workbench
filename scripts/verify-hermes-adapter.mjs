import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 19880;
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
      const { response } = await request('/api/data');
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

async function main() {
  await waitForServer();

  const taskCreated = await request('/api/tasks', 'POST', {
    userGoal: '让 Hermes 读取 F:/AI-Workbench/CURRENT_TASK.md 并总结当前待办列表',
    title: 'Hermes 读取 CURRENT_TASK.md',
    assignedAgentId: 'hermes',
    evidenceRequired: ['hermes_command', 'stdout', 'exit_code']
  });
  assert(taskCreated.response.status === 201, `Task create failed: ${taskCreated.body.error || taskCreated.response.status}`);

  const invoked = await request('/api/agents/hermes/invoke', 'POST', {
    taskId: taskCreated.body.task.id,
    timeoutMs: 180000
  });
  assert(invoked.response.ok, `Hermes invoke failed: ${invoked.body.error || invoked.response.status}`);

  const result = invoked.body.invoke_result;
  const evidence = result?.evidence || {};
  const text = result?.result?.text || '';
  assert(invoked.body.verification?.ok, 'Hermes result did not pass adapter verification');
  assert(evidence.commandRun?.includes('hermes chat'), 'Missing Hermes command evidence');
  assert(evidence.commandRun?.includes('--provider custom'), 'Hermes command did not use provider custom');
  assert(evidence.commandRun?.includes('-m deepseek-chat'), 'Hermes command did not use deepseek-chat');
  assert(evidence.commandRun?.includes('--toolsets memory,terminal'), 'Hermes command did not use memory,terminal toolsets');
  assert(evidence.exitCode === 0, `Hermes exited with ${evidence.exitCode}`);
  assert(evidence.durationMs > 0, 'Missing durationMs evidence');
  assert(
    /Hermes setup|API keys|部署方案|CURRENT_TASK|待办|当前任务/.test(text),
    'Hermes output does not look like it read CURRENT_TASK.md and summarized todos'
  );
  assert(Array.isArray(result.suggestions), 'Hermes suggestions must be an array');

  console.log(JSON.stringify({
    task: invoked.body.task,
    run: invoked.body.run,
    invoke_result: result,
    verification: invoked.body.verification
  }, null, 2));
}

try {
  await main();
} finally {
  server.kill();
}
