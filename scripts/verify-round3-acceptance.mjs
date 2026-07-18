import { spawn } from 'node:child_process';
import { copyFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const runtimeRoot = join(tmpdir(), `ai-workbench-round3-${process.pid}`);
const dataFile = join(runtimeRoot, 'data', 'workbench.json');
const backupFile = join(runtimeRoot, 'data', `workbench.round3-backup-${Date.now()}.json`);
const port = 19988;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), AI_WORKBENCH_RUNTIME_DIR: runtimeRoot },
  stdio: 'ignore'
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/data`);
      if (response.ok) return;
    } catch {}
    await wait(100);
  }
  throw new Error('server did not start');
}

async function request(path, method = 'GET', payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `${path} failed`);
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (existsSync(dataFile)) await copyFile(dataFile, backupFile);
  try {
    await writeFile(dataFile, JSON.stringify({
      dailyGoals: {},
      messages: [],
      conversations: [],
      activeConversationId: '',
      tasks: [
        {
          id: 'round3-login-task',
          title: '登录页修复',
          status: '待开始',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userVisibleSummary: '等待处理',
          failureReason: ''
        }
      ],
      runs: [],
      memories: [],
      preferences: { defaultOwner: '人工', dailyTaskLimit: 5, deepSeekModel: 'deepseek-chat' },
      modelConnection: { status: '未连接', provider: '', model: '', checkedAt: '' },
      systemErrors: []
    }, null, 2), 'utf8');
    await waitForServer();

    const current = await request('/api/data');
    current.tasks[0] = {
      ...current.tasks[0],
      status: '失败',
      failureReason: '登录接口超时，重试三次后仍失败。',
      userVisibleSummary: '登录修复失败：接口超时。'
    };
    await request('/api/data', 'PUT', current);

    const errorMemories = await request('/api/memories/error_experiences');
    const written = errorMemories.memories.find((memory) =>
      memory.value?.task === '登录页修复' && /接口超时/.test(memory.value?.reason || '')
    );
    assert(written, '失败任务没有写入 error_experiences');
    assert(written.value.solution, '错误经验缺少怎么解决的字段');

    const similarTask = await request('/api/tasks', 'POST', {
      title: '登录页复测',
      userGoal: '继续处理登录页问题',
      assignedAgentId: 'deepseek'
    });
    const context = await request(`/api/tasks/${encodeURIComponent(similarTask.task.id)}/context`);
    const related = context.task_context.memories.error_experiences.find((memory) => memory.id === written.id);
    assert(related, '同类任务上下文没有带上错误经验');
    console.log('Round 3 acceptance checks passed');
  } finally {
    server.kill();
    await wait(100);
    if (existsSync(backupFile)) {
      await copyFile(backupFile, dataFile);
      await rm(backupFile, { force: true });
    }
    await rm(runtimeRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
