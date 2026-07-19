import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const port = 19787;
const runtimeRoot = join(tmpdir(), `ai-workbench-acceptance-${process.pid}`);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), AI_WORKBENCH_RUNTIME_DIR: runtimeRoot },
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
      const response = await fetch(`${baseUrl}/api/data`);
      if (response.ok) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error(`API server did not start.\n${output}`);
}

async function ask(content) {
  const response = await fetch(`${baseUrl}/api/chat-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${content}: ${payload.error || response.status}`);
  const messages = payload.data?.messages || [];
  const reply = [...messages].reverse().find((message) => message.role === 'assistant')?.content || '';
  return reply;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await waitForServer();

  const stock = await ask('牧原股份今天开盘收盘多少');
  assert(stock.includes('牧原股份') && stock.includes('2026-07-18'), 'stock reply must mention stock and 2026-07-18');
  assert(/开盘价\s*\d+(\.\d+)?/.test(stock) || stock.includes('已拿到的最新数据'), 'stock reply must include prices or compliant fallback');
  assert(!/建议您通过|请自行|自己查询/.test(stock), 'stock reply must not push work to the user');

  const todos = await ask('我最近有什么事没办');
  assert(todos.includes('CURRENT_TASK.md'), 'todo reply must say it read CURRENT_TASK.md');
  assert(todos.includes('P1') && todos.includes('P2'), 'todo reply must include current unfinished tasks');
  assert(/\*\*当前未完成待办\*\*[\s\S]*\n1\.\s+\*\*/.test(todos), 'todo reply must be a numbered, multi-line, bold formatted list');
  assert(!/哪个文件|提供路径/.test(todos), 'todo reply must not ask for a file path');

  const fuzzy = await ask('帮我看看那个东西弄好没');
  assert(fuzzy.includes('你是想问') && fuzzy.includes('还是'), 'fuzzy reply must ask a natural clarification');
  assert(!/^\s*\{/.test(fuzzy), 'fuzzy reply must not be JSON');

  const lottery = await ask('查一下明天彩票开什么号');
  assert(lottery.includes('查不到') && lottery.includes('不会编造'), 'lottery reply must refuse future lottery prediction honestly');
  assert(!/\d{2}\s*[、,，]\s*\d{2}\s*[、,，]\s*\d{2}/.test(lottery), 'lottery reply must not fabricate numbers');

  console.log('Acceptance verification passed');
} finally {
  server.kill();
  await rm(runtimeRoot, { recursive: true, force: true });
}
