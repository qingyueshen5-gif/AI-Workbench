import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'verification', 'v0.4.1-installed');
const cdpPort = Number(process.env.AIW_ELECTRON_CDP_PORT || 9237);
const exePath = process.env.AIW_INSTALLED_EXE || 'C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AI Workbench\\AI Workbench.exe';
const dataFile = join(process.env.APPDATA || '', 'ai-workbench', 'data', 'workbench.json');

mkdirSync(outDir, { recursive: true });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, attempts = 100) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await wait(300);
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
  let page = null;
  for (let i = 0; i < 100; i += 1) {
    const list = await (await waitForUrl(`http://127.0.0.1:${cdpPort}/json/list`)).json();
    page = list.find((item) => item.type === 'page') || list[0] || null;
    if (page?.webSocketDebuggerUrl) break;
    await wait(300);
  }
  if (!page?.webSocketDebuggerUrl) throw new Error('Timed out waiting for Electron page target');
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
  await evaluate(cdp, `
    (() => {
      window.scrollTo(0, document.body.scrollHeight);
      for (const item of Array.from(document.querySelectorAll('*'))) {
        if (item.scrollHeight > item.clientHeight) item.scrollTop = item.scrollHeight;
      }
    })()
  `);
  await wait(300);
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = join(outDir, name);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  return file;
}

function readInstalledData() {
  return JSON.parse(readFileSync(dataFile, 'utf8').replace(/^\uFEFF/, ''));
}

async function waitForInstalledData(waitPattern, initialMessageCount, timeoutMs = 240000) {
  const started = Date.now();
  const pattern = new RegExp(waitPattern, 'i');
  while (Date.now() - started < timeoutMs) {
    try {
      const data = readInstalledData();
      const messages = Array.isArray(data.messages) ? data.messages : [];
      const newAssistantText = messages
        .slice(initialMessageCount)
        .filter((item) => item.role === 'assistant')
        .map((item) => item.content || '')
        .join('\n');
      const assistantCount = messages.slice(initialMessageCount).filter((item) => item.role === 'assistant').length;
      if (assistantCount >= 2 && pattern.test(newAssistantText)) return data;
    } catch {}
    await wait(1000);
  }
  throw new Error(`Timed out waiting for ${waitPattern}`);
}

async function newConversation(cdp) {
  await evaluate(cdp, `
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const button = buttons.find((item) => /新建对话/.test(item.innerText || item.textContent || ''));
      button?.click();
    })()
  `);
  await wait(800);
}

async function sendChat(cdp, text, waitPattern, timeoutMs = 240000) {
  const initialMessageCount = readInstalledData().messages?.length || 0;
  async function fillAndClick() {
    await evaluate(cdp, `
    (async () => {
      const textarea = document.querySelector('.chat-input-area textarea') || document.querySelector('textarea');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, ${JSON.stringify(text)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
      const button = textarea.closest('.chat-input-area')?.querySelector('button') || document.querySelector('button:not([disabled])');
      for (let i = 0; i < 40 && button.disabled; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      button.click();
    })()
  `);
  }
  await fillAndClick();
  for (let i = 0; i < 8; i += 1) {
    await wait(500);
    const data = readInstalledData();
    const messages = Array.isArray(data.messages) ? data.messages : [];
    if (messages.length > initialMessageCount && messages.slice(initialMessageCount).some((item) => item.role === 'user' && item.content === text)) break;
    if (i === 7) await fillAndClick();
  }
  const data = await waitForInstalledData(waitPattern, initialMessageCount, timeoutMs);
  await cdp.send('Page.reload', { ignoreCache: true });
  await wait(1800);
  return data.messages.map((item) => item.content || '').join('\n');
}

async function main() {
  const app = spawn(exePath, [`--remote-debugging-port=${cdpPort}`], {
    windowsHide: false,
    stdio: 'ignore'
  });
  await waitForUrl(`http://127.0.0.1:${cdpPort}/json/list`);
  const cdp = await connectCdp();
  await wait(2500);
  await newConversation(cdp);
  await screenshot(cdp, '00-installed-home.png');

  await sendChat(cdp, '帮我打开腾讯页面', '腾讯|tencent|www\\.tencent\\.com');
  await screenshot(cdp, '01-open-tencent.png');

  await sendChat(cdp, '帮我打开GitHub', 'GitHub|github\\.com');
  await screenshot(cdp, '02-open-github.png');

  for (let i = 1; i <= 3; i += 1) {
    await sendChat(cdp, '帮我看看C盘还剩多少空间', 'C盘[\\s\\S]*(还剩|剩余空间|可用空间|剩余)[\\s\\S]*[0-9.]+[\\s\\S]{0,12}GB');
    await screenshot(cdp, `03-c-drive-${i}.png`);
  }

  await sendChat(cdp, '帮我清理一下C盘', 'C盘[\\s\\S]*(清理|释放)[\\s\\S]*[0-9.]+\\s*GB');
  await screenshot(cdp, '04-clean-c-drive.png');

  await sendChat(cdp, '今天天气怎么样', '天气|气温|降雨|多云|晴|weather');
  await screenshot(cdp, '05-weather.png');

  app.kill();
  console.log(JSON.stringify({ outDir }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
