import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = join(root, 'data', 'workbench.json');
const backupFile = join(root, 'data', `workbench.ui-backup-${Date.now()}.json`);
const evidenceDir = join(root, 'evidence');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 19225;

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
  const events = [];
  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (payload.id && callbacks.has(payload.id)) {
      const { resolve, reject } = callbacks.get(payload.id);
      callbacks.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else resolve(payload.result || {});
      return;
    }
    events.push(payload);
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
        },
        events
      });
    });
    socket.addEventListener('error', () => reject(new Error('Chrome CDP websocket failed')));
  });
}

async function evaluate(cdp, expression) {
  return cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
}

async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = join(evidenceDir, name);
  await writeFile(file, Buffer.from(result.data, 'base64'));
  return file;
}

async function waitForText(cdp, expected) {
  for (let i = 0; i < 160; i += 1) {
    const text = await evaluate(cdp, `document.body.innerText || ''`);
    if (String(text.result?.value || '').includes(expected)) return;
    await wait(150);
  }
  throw new Error(`Timed out waiting for text: ${expected}`);
}

async function sendChat(cdp, text, expectedText) {
  await evaluate(cdp, `document.querySelector('textarea').focus()`);
  await cdp.send('Input.insertText', { text });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13
  });
  if (expectedText) await waitForText(cdp, expectedText);
  await wait(1200);
}

async function main() {
  if (!existsSync(chromePath)) throw new Error('Chrome executable not found');
  await mkdir(evidenceDir, { recursive: true });
  if (existsSync(dataFile)) await copyFile(dataFile, backupFile);
  const today = new Date().toISOString().slice(0, 10);
  const fixture = {
    dailyGoals: { [today]: '验证MVP闭环' },
    messages: [],
    conversations: [],
    activeConversationId: '',
    tasks: [
      {
        id: 'ui-hermes',
        title: 'Hermes 修复进度',
        status: '进行中',
        owner: 'Hermes',
        assignedAgentId: 'hermes',
        createdAt: new Date().toISOString(),
        notes: '等待最终验收',
        failureReason: '',
        userVisibleSummary: 'Hermes 修复还在处理，等待最终验证。'
      },
      {
        id: 'ui-deploy',
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
    runs: [
      {
        id: 'ui-run-hermes',
        taskId: 'ui-hermes',
        agentId: 'hermes',
        status: 'running',
        input: {},
        output: null,
        evidence: { durationMs: 1200 },
        errorRaw: null,
        errorUserMessage: '',
        retryCount: 0,
        costEstimate: { currency: 'USD', amount: 0, note: '' },
        startedAt: new Date().toISOString(),
        finishedAt: '',
        verified: false,
        verificationResult: null,
        durationMs: 1200
      }
    ],
    preferences: { defaultOwner: '人工', dailyTaskLimit: 5, deepSeekModel: 'deepseek-chat' },
    modelConnection: { status: '未连接', provider: '', model: '', checkedAt: '' },
    systemErrors: []
  };
  await writeFile(dataFile, JSON.stringify(fixture, null, 2), 'utf8');
  const userDataDir = join(tmpdir(), `ai-workbench-chrome-round2-${Date.now()}`);
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
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173' });
    await waitForText(cdp, 'AI Workbench');

    await sendChat(cdp, '帮我看看那个东西弄好没', 'Hermes 的修复进度');
    await sendChat(cdp, '都是', '已经完成并可访问');
    const contextState = await screenshot(cdp, 'round2-1-context-both.png');

    await sendChat(cdp, '你好', '你好，我在。');
    await sendChat(cdp, '谢谢', '不客气。');
    await sendChat(cdp, '哈哈', '我在。');
    await evaluate(cdp, `document.querySelector('[aria-label="打开侧边面板"]').click()`);
    await wait(500);
    const casualState = await screenshot(cdp, 'round2-2-casual-no-new-task.png');

    const defaultState = await screenshot(cdp, 'round2-3-default-collapsed.png');

    await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('Hermes 修复进度')).click()`);
    await wait(400);
    const summaryState = await screenshot(cdp, 'round2-3-click-task-summary.png');

    await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === '详情').click()`);
    await wait(400);
    const detailState = await screenshot(cdp, 'round2-5-detail-no-owner-selector.png');
    const detailText = await evaluate(cdp, `document.body.innerText`);
    if (String(detailText.result?.value || '').includes('负责人')) throw new Error('Detail still shows owner selector text');

    await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('验证MVP闭环')).click()`);
    await wait(400);
    const pastGoalState = await screenshot(cdp, 'round2-4-past-goal-expanded.png');

    cdp.close();
    console.log(JSON.stringify({ contextState, casualState, defaultState, summaryState, detailState, pastGoalState }, null, 2));
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
