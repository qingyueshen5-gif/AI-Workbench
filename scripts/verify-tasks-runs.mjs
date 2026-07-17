import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 19878;
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

  const content = `验证统一任务结构 ${new Date().toISOString()}`;
  const chat = await request('/api/chat-message', 'POST', {
    content,
    conversationId: 'verify-task-run-conversation'
  });
  assert(chat.response.ok, `Chat request failed: ${chat.body.error || chat.response.status}`);

  const matchingTask = chat.body.data.tasks.find((task) => task.userGoal === content);
  assert(matchingTask, 'Chat message did not create a task record');

  const matchingRun = chat.body.data.runs.find((run) => run.taskId === matchingTask.id);
  assert(matchingRun, 'Chat message did not create a run record');

  const taskGet = await request(`/api/tasks/${encodeURIComponent(matchingTask.id)}`);
  assert(taskGet.response.ok, `GET task failed: ${taskGet.body.error || taskGet.response.status}`);

  const runGet = await request(`/api/runs/${encodeURIComponent(matchingRun.id)}`);
  assert(runGet.response.ok, `GET run failed: ${runGet.body.error || runGet.response.status}`);

  const task = taskGet.body.task;
  const run = runGet.body.run;

  for (const field of [
    'id',
    'parentTaskId',
    'userGoal',
    'title',
    'status',
    'priority',
    'riskLevel',
    'assignedAgentId',
    'dependencies',
    'evidenceRequired',
    'createdAt',
    'updatedAt',
    'userVisibleSummary'
  ]) {
    assert(Object.prototype.hasOwnProperty.call(task, field), `Task is missing ${field}`);
  }
  assert(task.goal && task.assignee && task.evidence_required && task.retry_policy, 'Task compatibility fields are incomplete');

  for (const field of [
    'id',
    'taskId',
    'agentId',
    'status',
    'input',
    'output',
    'evidence',
    'errorRaw',
    'errorUserMessage',
    'retryCount',
    'costEstimate',
    'startedAt',
    'finishedAt',
    'verified',
    'verificationResult'
  ]) {
    assert(Object.prototype.hasOwnProperty.call(run, field), `Run is missing ${field}`);
  }
  assert(run.taskId === task.id, 'Run taskId does not match task id');
  assert(run.agentId === task.assignedAgentId, 'Run agentId does not match assigned agent');
  assert(run.durationMs >= 0, 'Run duration is missing');

  console.log(JSON.stringify({ task, run }, null, 2));
}

try {
  await main();
} finally {
  server.kill();
}
