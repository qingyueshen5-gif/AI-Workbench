import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'verification', 'v0.4.2-experience');
const cdpPort = Number(process.env.AIW_ELECTRON_CDP_PORT || 9238);
const exePath = process.env.AIW_INSTALLED_EXE || join(process.env.LOCALAPPDATA || '', 'Programs', 'AI Workbench', 'AI Workbench.exe');
const dataFile = join(process.env.APPDATA || '', 'ai-workbench', 'data', 'workbench.json');
const pasteText = '我最近有什么事没办';

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
  await cdp.send('Input.setIgnoreInputEvents', { ignore: false });
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
  await wait(400);
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = join(outDir, name);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  return file;
}

function readInstalledData() {
  return JSON.parse(readFileSync(dataFile, 'utf8').replace(/^\uFEFF/, ''));
}

async function waitForReply(initialMessageCount, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = readInstalledData();
    const text = (data.messages || [])
      .slice(initialMessageCount)
      .filter((item) => item.role === 'assistant')
      .map((item) => item.content || '')
      .join('\n');
    if (/\*\*当前未完成待办\*\*[\s\S]*\n1\.\s+\*\*/.test(text)) return data;
    await wait(1000);
  }
  throw new Error('Timed out waiting for formatted todo reply');
}

async function main() {
  spawnSync('powershell.exe', ['-NoProfile', '-Command', `Set-Clipboard -Value ${JSON.stringify(pasteText)}`], { windowsHide: true });
  const app = spawn(exePath, [`--remote-debugging-port=${cdpPort}`], {
    windowsHide: false,
    stdio: 'ignore'
  });
  await waitForUrl(`http://127.0.0.1:${cdpPort}/json/list`);
  const cdp = await connectCdp();
  await wait(2500);
  await screenshot(cdp, '00-no-english-menu.png');

  await evaluate(cdp, "document.querySelector('.chat-input-area textarea')?.focus()");
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, modifiers: 2 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, modifiers: 2 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, modifiers: 2 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 });
  await wait(800);
  const pasted = await evaluate(cdp, "document.querySelector('.chat-input-area textarea')?.value || ''");
  if (pasted !== pasteText) throw new Error(`Ctrl+V paste failed: ${pasted}`);
  await screenshot(cdp, '01-ctrl-v-pasted.png');

  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 760, y: 828, button: 'right', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 760, y: 828, button: 'right', clickCount: 1 });
  await wait(800);
  await screenshot(cdp, '02-right-click-menu-triggered.png');

  const initialMessageCount = readInstalledData().messages?.length || 0;
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await waitForReply(initialMessageCount);
  await cdp.send('Page.reload', { ignoreCache: true });
  await wait(1500);
  await screenshot(cdp, '03-formatted-todo-reply.png');

  app.kill();
  console.log(JSON.stringify({ outDir, pasted }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
