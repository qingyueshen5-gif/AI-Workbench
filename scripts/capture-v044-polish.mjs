import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'verification', 'v0.4.4-polish');
const cdpPort = Number(process.env.AIW_ELECTRON_CDP_PORT || 9244);
const exePath = process.env.AIW_INSTALLED_EXE || 'C:\\Users\\<USER>\\AppData\\Local\\Programs\\AI Workbench\\AI Workbench.exe';
const userDataDir = join(outDir, `user-data-${Date.now()}`);
const dataFile = join(process.env.APPDATA || '', 'ai-workbench', 'data', 'workbench.json');

mkdirSync(outDir, { recursive: true });

const actionCases = [
  {
    text: '帮我打开终端',
    replyPattern: /打开终端|终端.*打开|PowerShell|opened_terminal|terminal/i,
    foregroundPattern: /powershell|pwsh|cmd|WindowsTerminal/i,
    screenshot: '02-terminal-foreground.png'
  },
  {
    text: '帮我打开记事本',
    replyPattern: /记事本.*打开|notepad|opened_app/i,
    foregroundPattern: /notepad/i,
    screenshot: '03-notepad-foreground.png'
  },
  {
    text: '帮我打开下载文件夹',
    replyPattern: /文件夹.*打开|Downloads|下载|opened_folder/i,
    foregroundPattern: /explorer/i,
    screenshot: '04-downloads-foreground.png'
  }
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, attempts = 300) {
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
    page = list.find((item) => item.type === 'page' && /127\.0\.0\.1:8787/.test(item.url || ''))
      || list.find((item) => item.type === 'page' && item.url && item.url !== 'about:blank')
      || null;
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

async function capturePage(cdp, name, focusText = '') {
  await evaluate(cdp, `
    (() => {
      const focusText = ${JSON.stringify(focusText)};
      const markdownBlocks = Array.from(document.querySelectorAll('.message-markdown'));
      const target = focusText
        ? markdownBlocks.reverse().find((item) => item.textContent.includes(focusText))
        : null;

      if (target) {
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
      } else {
        window.scrollTo(0, document.body.scrollHeight);
        for (const item of Array.from(document.querySelectorAll('*'))) {
          if (item.scrollHeight > item.clientHeight) item.scrollTop = item.scrollHeight;
        }
      }
    })()
  `);
  await wait(500);
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = join(outDir, name);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  return file;
}

function captureDesktop(name) {
  const file = join(outDir, name);
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$bounds=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '$bitmap=New-Object System.Drawing.Bitmap $bounds.Width,$bounds.Height',
    '$graphics=[System.Drawing.Graphics]::FromImage($bitmap)',
    '$graphics.CopyFromScreen($bounds.Location,[System.Drawing.Point]::Empty,$bounds.Size)',
    `$bitmap.Save(${JSON.stringify(file)},[System.Drawing.Imaging.ImageFormat]::Png)`,
    '$graphics.Dispose()',
    '$bitmap.Dispose()'
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Desktop screenshot failed: ${result.stderr || result.stdout}`);
  return file;
}

function readInstalledData() {
  return JSON.parse(readFileSync(dataFile, 'utf8').replace(/^\uFEFF/, ''));
}

async function waitForReply(initialMessageCount, pattern, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = readInstalledData();
    const text = (data.messages || [])
      .slice(initialMessageCount)
      .filter((item) => item.role === 'assistant')
      .map((item) => item.content || '')
      .join('\n');
    if (pattern.test(text)) return text;
    await wait(1000);
  }
  throw new Error(`Timed out waiting for reply matching ${pattern}`);
}

function latestRunEvidence() {
  const data = readInstalledData();
  const run = (data.runs || [])[0] || {};
  const stdout = String(run.evidence?.stdout || run.output?.evidence?.stdout || '');
  const match = stdout.match(/foreground=(\{[^\n]+\})/);
  const foreground = match ? JSON.parse(match[1]) : null;
  return { run, stdout, foreground };
}

async function sendChat(cdp, text) {
  await evaluate(cdp, `
    (() => {
      const textarea = document.querySelector('.chat-input-area textarea') || document.querySelector('textarea');
      if (!textarea) throw new Error('textarea missing');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, ${JSON.stringify(text)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
      const button = textarea.closest('.chat-input-area')?.querySelector('button') || document.querySelector('button:not([disabled])');
      if (!button) throw new Error('send button missing');
      button.click();
    })()
  `);
}

async function main() {
  const app = spawn(exePath, ['--remote-debugging-port', String(cdpPort), `--user-data-dir=${userDataDir}`], {
    windowsHide: false,
    stdio: 'ignore'
  });
  app.once('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  try {
    await waitForUrl(`http://127.0.0.1:${cdpPort}/json/list`);
    const cdp = await connectCdp();
    await wait(2500);

    let initialMessageCount = readInstalledData().messages?.length || 0;
    await sendChat(cdp, '我最近有什么事没办');
    await waitForReply(initialMessageCount, /\*\*当前未完成待办\*\*[\s\S]*\n1\.\s+\*\*/);
    await capturePage(cdp, '01-markdown-todo.png', '当前未完成待办');

    const results = [];
    for (const testCase of actionCases) {
      initialMessageCount = readInstalledData().messages?.length || 0;
      await sendChat(cdp, testCase.text);
      const reply = await waitForReply(initialMessageCount, testCase.replyPattern);
      await wait(1800);
      const desktopShot = captureDesktop(testCase.screenshot);
      const evidence = latestRunEvidence();
      if (!evidence.foreground?.Focused || !testCase.foregroundPattern.test(evidence.foreground.ProcessName || '')) {
        throw new Error(`${testCase.text}: foreground evidence mismatch: ${JSON.stringify(evidence)}`);
      }
      results.push({ text: testCase.text, reply, foreground: evidence.foreground, desktopShot });
    }

    writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ outDir, results }, null, 2), 'utf8');
    console.log(JSON.stringify({ outDir, results: results.map(({ text, foreground, desktopShot }) => ({ text, foreground, desktopShot })) }, null, 2));
  } finally {
    app.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
