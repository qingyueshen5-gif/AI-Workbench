import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'verification', 'strict-acceptance');
const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const runtimeDir = join(root, `.strict-acceptance-runtime-${stamp}`);
const chromeProfile = join(root, `.strict-chrome-profile-${stamp}`);
const port = 8820;
const cdpPort = 9224;

mkdirSync(outDir, { recursive: true });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startProcess(command, args, options = {}) {
  return spawn(command, args, {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(options.env || {}) }
  });
}

async function waitForUrl(url, attempts = 80) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }
}

async function connectCdp() {
  const list = await (await waitForUrl(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  const page = list.find((item) => item.type === 'page') || list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new CdpClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  return cdp;
}

async function evaluate(cdp, expression, awaitPromise = true) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  return result.result?.value;
}

async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = join(outDir, name);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  return file;
}

async function navigateWorkbench(cdp) {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}` });
  await wait(800);
}

function readRuntimeData() {
  const raw = readFileSync(join(runtimeDir, 'workbench.json'), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

async function waitForDataPattern(waitPattern, initialMessageCount, timeoutMs = 180000) {
  const started = Date.now();
  const pattern = new RegExp(waitPattern);
  while (Date.now() - started < timeoutMs) {
    try {
      const data = readRuntimeData();
      const messages = Array.isArray(data.messages) ? data.messages : [];
      const newText = messages.slice(initialMessageCount).map((item) => item.content || '').join('\n');
      if (messages.length > initialMessageCount && pattern.test(newText)) return data;
    } catch {}
    await wait(1000);
  }
  throw new Error(`Timed out waiting for ${waitPattern}`);
}

async function sendChat(cdp, text, waitPattern, timeoutMs = 180000) {
  const initialMessageCount = readRuntimeData().messages?.length || 0;
  await navigateWorkbench(cdp);
  await evaluate(cdp, `
    (async () => {
      const textarea = document.querySelector('.chat-input-area textarea');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, ${JSON.stringify(text)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
      const button = textarea.closest('.chat-input-area').querySelector('button');
      for (let i = 0; i < 40 && button.disabled; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      button.click();
    })()
  `);
  const data = await waitForDataPattern(waitPattern, initialMessageCount, timeoutMs);
  await navigateWorkbench(cdp);
  return data.messages.map((item) => item.content || '').join('\n');
}

async function main() {
  const server = startProcess(process.execPath, ['server.mjs'], {
    env: {
      PORT: String(port),
      AI_WORKBENCH_RUNTIME_DIR: runtimeDir,
      AIW_DATA_FILE: join(runtimeDir, 'workbench.json')
    }
  });
  await waitForUrl(`http://127.0.0.1:${port}/api/data`);

  const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${chromeProfile}`,
    '--no-first-run',
    '--new-window',
    `http://127.0.0.1:${port}`
  ], { windowsHide: false, stdio: 'ignore' });
  await waitForUrl(`http://127.0.0.1:${cdpPort}/json/list`);
  const cdp = await connectCdp();
  await wait(1500);
  await screenshot(cdp, '00-home.png');

  await sendChat(cdp, '帮我打开GitHub页面', '已在浏览器打开 https://github.com', 120000);
  await screenshot(cdp, '01-open-github.png');

  for (let i = 1; i <= 3; i += 1) {
    await sendChat(cdp, '帮我看看C盘还剩多少空间', 'C盘还剩 [0-9.]+ GB', 120000);
    await screenshot(cdp, `02-c-drive-${i}.png`);
  }

  await sendChat(cdp, '帮我清理一下C盘', 'C盘安全清理完成。释放 [0-9.]+ GB', 180000);
  await screenshot(cdp, '03-clean-c-drive.png');

  await sendChat(cdp, '帮我打开不存在的程序xyz_not_real_app_98765', 'Hermes 这次没有完成。[\\s\\S]*原因：[\\s\\S]*建议：', 180000);
  await screenshot(cdp, '04-failure-explained.png');

  server.kill();
  await wait(1000);
  await evaluate(cdp, `
    (() => {
      const textarea = document.querySelector('textarea');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, '帮我看看C盘还剩多少空间');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    })()
  `);
  await wait(2500);
  await screenshot(cdp, '05-network-reconnecting.png');

  const server2 = startProcess(process.execPath, ['server.mjs'], {
    env: {
      PORT: String(port),
      AI_WORKBENCH_RUNTIME_DIR: runtimeDir,
      AIW_DATA_FILE: join(runtimeDir, 'workbench.json')
    }
  });
  await waitForUrl(`http://127.0.0.1:${port}/api/data`);
  const started = Date.now();
  while (Date.now() - started < 120000) {
    const text = await evaluate(cdp, 'document.body.innerText');
    if (/C盘还剩 [0-9.]+ GB/.test(text) && !/网络波动，正在重连/.test(text)) break;
    await wait(1000);
  }
  await screenshot(cdp, '06-network-delivered.png');

  server2.kill();
  chrome.kill();
  console.log(JSON.stringify({ outDir }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
