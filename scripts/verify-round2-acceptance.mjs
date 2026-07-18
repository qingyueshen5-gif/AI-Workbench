import { spawn } from 'node:child_process';
import { readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = join(root, 'data', 'workbench.json');
const backupFile = join(root, 'data', `workbench.round2-backup-${Date.now()}.json`);
const port = 19987;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
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

async function ask(content, conversationId = 'round2-conversation') {
  const body = await request('/api/chat-message', 'POST', { content, conversationId });
  const conversation = body.data.conversations.find((item) => item.id === conversationId);
  const reply = [...(conversation?.messages || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
  return { body, reply };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (existsSync(dataFile)) await copyFile(dataFile, backupFile);
  const today = new Date().toISOString().slice(0, 10);
  const fixture = {
    dailyGoals: { [today]: '验证MVP闭环' },
    messages: [],
    conversations: [],
    activeConversationId: '',
    tasks: [
      {
        id: 'round2-hermes',
        title: 'Hermes 修复进度',
        status: '进行中',
        owner: 'Hermes',
        assignedAgentId: 'hermes',
        createdAt: new Date().toISOString(),
        notes: '',
        failureReason: '',
        userVisibleSummary: 'Hermes 修复还在处理，等待最终验证。'
      },
      {
        id: 'round2-deploy',
        title: '网站部署',
        status: '已完成',
        owner: 'DeepSeek',
        assignedAgentId: 'deepseek',
        createdAt: new Date().toISOString(),
        notes: '',
        failureReason: '',
        userVisibleSummary: '网站部署已经完成并可访问。'
      }
    ],
    runs: [],
    preferences: { defaultOwner: '人工', dailyTaskLimit: 5, deepSeekModel: 'deepseek-chat' },
    modelConnection: { status: '未连接', provider: '', model: '', checkedAt: '' },
    systemErrors: []
  };
  await writeFile(dataFile, JSON.stringify(fixture, null, 2), 'utf8');
  await waitForServer();

  const beforeCount = (await request('/api/data')).tasks.length;
  const fuzzy = await ask('帮我看看那个东西弄好没');
  assert(/Hermes/.test(fuzzy.reply) && /网站部署/.test(fuzzy.reply) && /还是/.test(fuzzy.reply), '修1首轮追问不正确');
  const both = await ask('都是');
  assert(/Hermes/.test(both.reply) && /网站部署/.test(both.reply) && /两件事/.test(both.reply), '修1没有结合上下文回答都是');
  assert(both.body.data.tasks.length === beforeCount, '修1澄清回答不应生成任务');

  for (const text of ['你好', '谢谢', '哈哈']) {
    const countBefore = (await request('/api/data')).tasks.length;
    const result = await ask(text, `round2-casual-${text}`);
    const countAfter = result.body.data.tasks.length;
    assert(result.reply && countAfter === countBefore, `修2闲聊生成了任务：${text}`);
  }

  const data = await request('/api/data');
  assert(data.tasks.some((task) => task.title === 'Hermes 修复进度'), '验收数据缺少 Hermes 任务');
  assert(data.tasks.some((task) => task.title === '网站部署'), '验收数据缺少网站部署任务');
  console.log('Round 2 acceptance API checks passed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    server.kill();
    await wait(100);
    if (existsSync(backupFile)) {
      await copyFile(backupFile, dataFile);
      await rm(backupFile, { force: true });
    }
  });
