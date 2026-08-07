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
let cookie = '';
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
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.json();
  return { response, body };
}

async function establishAuthenticatedSession() {
  const response = await fetch(`${baseUrl}/`);
  const setCookie = response.headers.get('set-cookie');
  await response.text();
  cookie = String(setCookie || '').split(';')[0];
  if (!cookie.startsWith('aiw_session=')) {
    throw new Error('Authenticated session cookie aiw_session was not issued');
  }
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`API server exited before readiness (exitCode=${server.exitCode}).\n${output}`);
    }
    try {
      const { response } = await request('/api/readiness');
      if (response.ok) return;
      lastError = new Error(`readiness endpoint returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(100);
  }
  throw new Error(`API server did not become ready within 15000ms. Last error: ${lastError?.message || 'none'}\n${output}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await waitForServer();
  await establishAuthenticatedSession();

  const content = `验证统一任务结构 ${new Date().toISOString()}`;
  const taskCreated = await request('/api/tasks', 'POST', {
    userGoal: content,
    title: '验证统一任务结构',
    assignedAgentId: 'hermes',
    evidenceRequired: ['task_run_linkage']
  });
  assert(taskCreated.response.status === 201, `Task create failed: ${taskCreated.body.error || taskCreated.response.status}`);
  const createdTask = taskCreated.body.task;

  const runCreated = await request('/api/runs', 'POST', {
    taskId: createdTask.id,
    agentId: createdTask.assignedAgentId,
    status: 'pending',
    input: { source: 'verify-tasks-runs' },
    output: null,
    evidence: {}
  });
  assert(runCreated.response.status === 201, `Run create failed: ${runCreated.body.error || runCreated.response.status}`);
  const createdRun = runCreated.body.run;

  const taskGet = await request(`/api/tasks/${encodeURIComponent(createdTask.id)}`);
  assert(taskGet.response.ok, `GET task failed: ${taskGet.body.error || taskGet.response.status}`);

  const runGet = await request(`/api/runs/${encodeURIComponent(createdRun.id)}`);
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
  const taskRunLinkageVerified = run.taskId === task.id && run.agentId === task.assignedAgentId;
  assert(taskRunLinkageVerified, 'Task/run linkage is invalid');
  assert(run.durationMs >= 0, 'Run duration is missing');
  const verifiedFieldIsFalse = run.verified === false;
  const verificationResultIsNull = run.verificationResult === null;
  assert(verifiedFieldIsFalse, 'Task/run linkage and field presence must not imply business verified');
  assert(verificationResultIsNull, 'A linked run without trusted server evidence must have no verification result');
  const shapeOrLinkageCanPromoteBusinessVerified = run.verified === true;
  assert(shapeOrLinkageCanPromoteBusinessVerified === false, 'Shape or linkage alone cannot promote business verification');

  console.log(JSON.stringify({
    task,
    run,
    taskRunLinkageVerified,
    verifiedFieldIsFalse,
    verificationResultIsNull,
    shapeOrLinkageCanPromoteBusinessVerified
  }, null, 2));
}

try {
  await main();
} finally {
  server.kill();
}
