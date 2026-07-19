import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'verification', 'v0.4.3-actions');
const cdpPort = Number(process.env.AIW_ELECTRON_CDP_PORT || 9243);
const exePath = process.env.AIW_INSTALLED_EXE || 'C:\\Users\\胖胖虎\\AppData\\Local\\Programs\\AI Workbench\\AI Workbench.exe';
const dataFile = join(process.env.APPDATA || '', 'ai-workbench', 'data', 'workbench.json');

mkdirSync(outDir, { recursive: true });

const cases = [
  {
    text: '帮我打开终端',
    replyPattern: /打开终端|终端.*打开|PowerShell|opened_terminal|terminal/i,
    processPattern: /WindowsTerminal|powershell|pwsh|cmd/i,
    activatePattern: 'WindowsTerminal|powershell|pwsh|cmd',
    screenshot: '01-open-terminal-desktop.png'
  },
  {
    text: '帮我打开记事本',
    replyPattern: /记事本.*已打开|notepad/i,
    processPattern: /notepad/i,
    activatePattern: 'notepad',
    screenshot: '02-open-notepad-desktop.png'
  },
  {
    text: '帮我打开下载文件夹',
    replyPattern: /文件夹已打开|Downloads|下载/i,
    processPattern: /explorer/i,
    activatePattern: 'explorer',
    screenshot: '03-open-downloads-folder-desktop.png'
  }
];

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

async function capturePage(cdp, name) {
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

function processEvidence(pattern) {
  const command = "Get-Process | Select-Object ProcessName,Id,MainWindowTitle | ConvertTo-Json -Compress";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true, encoding: 'utf8' });
  const text = `${result.stdout}\n${result.stderr}`;
  if (!pattern.test(text)) throw new Error(`Expected process not found: ${pattern}\n${text}`);
  return text;
}

function focusEvidenceWindow(activatePattern) {
  const script = [
    '$code=\'using System; using System.Runtime.InteropServices; public class NativeWindow { [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }\'',
    'Add-Type $code -ErrorAction SilentlyContinue',
    "$blockers=Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -match 'AI Workbench|WindowsTerminal|powershell|pwsh|cmd') }",
    "foreach($item in $blockers){ [NativeWindow]::ShowWindowAsync($item.MainWindowHandle, 6) | Out-Null }",
    `$pattern=${JSON.stringify(activatePattern)}`,
    '$target=Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.ProcessName -match $pattern } | Select-Object -First 1',
    '$shell=New-Object -ComObject WScript.Shell',
    'if($target){ [NativeWindow]::ShowWindowAsync($target.MainWindowHandle, 9) | Out-Null; $shell.AppActivate($target.Id) | Out-Null; [NativeWindow]::SetForegroundWindow($target.MainWindowHandle) | Out-Null }',
    'Start-Sleep -Milliseconds 800'
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Window focus failed: ${result.stderr || result.stdout}`);
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
  const app = spawn(exePath, [`--remote-debugging-port=${cdpPort}`], {
    windowsHide: false,
    stdio: 'ignore'
  });
  try {
    await waitForUrl(`http://127.0.0.1:${cdpPort}/json/list`);
    const cdp = await connectCdp();
    await wait(2500);
    await capturePage(cdp, '00-installed-home.png');

    const results = [];
    for (const testCase of cases) {
      const initialMessageCount = readInstalledData().messages?.length || 0;
      await sendChat(cdp, testCase.text);
      const reply = await waitForReply(initialMessageCount, testCase.replyPattern);
      await wait(1800);
      const processes = processEvidence(testCase.processPattern);
      focusEvidenceWindow(testCase.activatePattern);
      const desktopShot = captureDesktop(testCase.screenshot);
      results.push({ text: testCase.text, reply, desktopShot, processMatched: testCase.processPattern.toString(), processSample: processes.slice(0, 1000) });
    }

    writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ outDir, results }, null, 2), 'utf8');
    console.log(JSON.stringify({ outDir, cases: results.map((item) => ({ text: item.text, desktopShot: item.desktopShot })) }, null, 2));
  } finally {
    app.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
