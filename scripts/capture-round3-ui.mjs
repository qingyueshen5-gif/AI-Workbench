import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { migrateLegacyRuntimeData, runtimeDataDir, runtimeDataFile, runtimeEvidenceDir } from '../runtime-paths.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = runtimeDataFile;
const backupFile = join(runtimeDataDir, `workbench.ui-round3-backup-${Date.now()}.json`);
const evidenceDir = runtimeEvidenceDir;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 19226;
migrateLegacyRuntimeData(root);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await wait(150);
  }
  throw new Error(`${url} did not become ready`);
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let id = 0;
  const callbacks = new Map();
  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (!payload.id || !callbacks.has(payload.id)) return;
    const { resolve, reject } = callbacks.get(payload.id);
    callbacks.delete(payload.id);
    if (payload.error) reject(new Error(payload.error.message));
    else resolve(payload.result || {});
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          socket.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((resolveSend, rejectSend) => callbacks.set(messageId, { resolve: resolveSend, reject: rejectSend }));
        },
        close() {
          socket.close();
        }
      });
    });
    socket.addEventListener('error', () => reject(new Error('Chrome CDP websocket failed')));
  });
}

async function evaluate(cdp, expression) {
  return cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
}

async function waitForText(cdp, expected) {
  for (let i = 0; i < 100; i += 1) {
    const text = await evaluate(cdp, `document.body.innerText || ''`);
    if (String(text.result?.value || '').includes(expected)) return;
    await wait(150);
  }
  throw new Error(`Timed out waiting for text: ${expected}`);
}

async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = join(evidenceDir, name);
  await writeFile(file, Buffer.from(result.data, 'base64'));
  return file;
}

async function main() {
  if (!existsSync(chromePath)) throw new Error('Chrome executable not found');
  await mkdir(evidenceDir, { recursive: true });
  await mkdir(dirname(dataFile), { recursive: true });
  if (existsSync(dataFile)) await copyFile(dataFile, backupFile);
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(dataFile, JSON.stringify({
    dailyGoals: { [today]: '验证MVP闭环' },
    messages: [],
    conversations: [],
    activeConversationId: '',
    tasks: [
      {
        id: 'round3-failed-ui',
        title: '登录页修复',
        status: '失败',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userVisibleSummary: '登录修复失败：原因已在对话里说明。',
        failureReason: '登录接口超时，重试三次后仍失败。',
        assignedAgentId: 'deepseek',
        owner: 'DeepSeek'
      },
      {
        id: 'round3-done-ui',
        title: '网站部署',
        status: '已完成',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userVisibleSummary: '网站部署已经完成。',
        assignedAgentId: 'deepseek',
        owner: 'DeepSeek'
      }
    ],
    runs: [],
    memories: [],
    preferences: { defaultOwner: '人工', dailyTaskLimit: 5, deepSeekModel: 'deepseek-chat' },
    modelConnection: { status: '未连接', provider: '', model: '', checkedAt: '' },
    systemErrors: []
  }, null, 2), 'utf8');

  const userDataDir = join(tmpdir(), `ai-workbench-chrome-round3-${Date.now()}`);
  let chrome = null;
  try {
    await waitForUrl('http://127.0.0.1:5173');
    await waitForUrl('http://127.0.0.1:8787/api/data');
    chrome = spawn(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1365,900',
      'about:blank'
    ], { stdio: 'ignore' });
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`);
    const target = await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: 'PUT' }).then((response) => response.json());
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:5173?round3=${Date.now()}` });
    await waitForText(cdp, 'AI Workbench');
    await evaluate(cdp, `document.querySelector('[aria-label="打开侧边面板"]').click()`);
    await wait(500);
    const pastCollapsed = await screenshot(cdp, 'round3-c-past-goals-collapsed.png');
    const pastListVisible = await evaluate(cdp, `(() => {
      const button = Array.from(document.querySelectorAll('.history-sidebar button')).find((item) => item.textContent.trim() === '过往目标');
      return Boolean(button?.nextElementSibling);
    })()`);
    if (pastListVisible.result?.value) throw new Error('Past goals list is visible by default');

    await evaluate(cdp, `Array.from(document.querySelectorAll('.history-sidebar button')).find((button) => button.textContent.trim() === '过往目标').click()`);
    await wait(400);
    const pastExpandedVisible = await evaluate(cdp, `(() => {
      const button = Array.from(document.querySelectorAll('.history-sidebar button')).find((item) => item.textContent.trim() === '过往目标');
      return Boolean(button?.nextElementSibling);
    })()`);
    if (!pastExpandedVisible.result?.value) throw new Error('Past goals list did not expand after click');
    const pastExpanded = await screenshot(cdp, 'round3-c-past-goals-expanded.png');

    await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('登录页修复')).click()`);
    await wait(300);
    await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === '详情').click()`);
    await wait(400);
    const detailSlim = await screenshot(cdp, 'round3-a-detail-slim.png');
    const detailText = await evaluate(cdp, `document.body.innerText || ''`);
    const forbidden = ['备注', '失败原因', '负责人', '由谁执行', '命令：', '耗时：'];
    const leaked = forbidden.find((word) => String(detailText.result?.value || '').includes(word));
    if (leaked) throw new Error(`Slim detail leaked forbidden text: ${leaked}`);

    cdp.close();
    console.log(JSON.stringify({ pastCollapsed, pastExpanded, detailSlim }, null, 2));
  } finally {
    if (chrome) chrome.kill();
    await wait(200);
    if (existsSync(backupFile)) {
      await copyFile(backupFile, dataFile);
      await rm(backupFile, { force: true });
    }
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
