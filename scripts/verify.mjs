import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = join(root, 'data', 'workbench.json');
const api = 'http://127.0.0.1:8787/api/data';

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
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

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(api);
      if (response.ok) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error(`API server did not start.\n${output}`);
}

async function request(method, payload) {
  const response = await fetch(api, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.json();
  return { response, body };
}

async function main() {
  await rm(dataFile, { force: true });
  await waitForServer();

  const today = new Date().toISOString().slice(0, 10);
  const validData = {
    dailyGoals: { [today]: '验证 MVP 闭环' },
    messages: [
      {
        id: 'verify-message',
        content: '把这条消息同步为任务',
        createdAt: new Date().toISOString(),
        isTask: true,
        taskId: 'verify-task'
      }
    ],
    tasks: [
      {
        id: 'verify-task',
        title: '验证任务持久化',
        status: '已完成',
        owner: 'Codex',
        createdAt: new Date().toISOString(),
        notes: 'verify script',
        failureReason: ''
      }
    ]
  };

  const saved = await request('PUT', validData);
  if (!saved.response.ok) {
    throw new Error(`Expected valid data to save, got ${saved.response.status}`);
  }

  const persisted = JSON.parse(await readFile(dataFile, 'utf8'));
  if (persisted.dailyGoals[today] !== validData.dailyGoals[today]) {
    throw new Error('Daily goal was not persisted');
  }
  if (persisted.tasks[0]?.status !== '已完成') {
    throw new Error('Task status was not persisted');
  }

  const invalidFailedTask = {
    ...validData,
    tasks: [{ ...validData.tasks[0], status: '失败', failureReason: '' }]
  };
  const rejected = await request('PUT', invalidFailedTask);
  if (rejected.response.status !== 400 || rejected.body.error !== '失败任务必须填写失败原因') {
    throw new Error('Failed tasks without a failure reason should be rejected');
  }

  const validFailedTask = {
    ...validData,
    tasks: [{ ...validData.tasks[0], status: '失败', failureReason: '验证失败原因必填' }]
  };
  const accepted = await request('PUT', validFailedTask);
  if (!accepted.response.ok) {
    throw new Error('Failed tasks with a failure reason should be accepted');
  }

  console.log('MVP verification passed');
}

try {
  await main();
} finally {
  server.kill();
}
