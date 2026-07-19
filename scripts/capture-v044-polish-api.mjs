import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'verification', 'v0.4.4-polish');
const dataFile = join(process.env.APPDATA || '', 'ai-workbench', 'data', 'workbench.json');
const apiBase = process.env.AIW_API_BASE || 'http://127.0.0.1:8787';

mkdirSync(outDir, { recursive: true });

const actionCases = [
  {
    text: '帮我打开终端',
    replyPattern: /打开终端|终端.*打开|PowerShell|opened_terminal|terminal/i,
    foregroundPattern: /powershell|pwsh|cmd|WindowsTerminal/i,
    screenshot: '12-terminal-foreground-api.png'
  },
  {
    text: '帮我打开记事本',
    replyPattern: /记事本.*打开|notepad|opened_app/i,
    foregroundPattern: /notepad/i,
    screenshot: '13-notepad-foreground-api.png'
  },
  {
    text: '帮我打开下载文件夹',
    replyPattern: /文件夹.*打开|Downloads|下载|opened_folder/i,
    foregroundPattern: /explorer/i,
    screenshot: '14-downloads-foreground-api.png'
  }
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readInstalledData() {
  return JSON.parse(readFileSync(dataFile, 'utf8').replace(/^\uFEFF/, ''));
}

async function sendChat(text) {
  const response = await fetch(`${apiBase}/api/chat-message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: text })
  });
  if (!response.ok) throw new Error(`${text}: API returned ${response.status}`);
  return response.json();
}

async function waitForAssistantAfter(initialCount, pattern, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = readInstalledData();
    const text = (data.messages || [])
      .slice(initialCount)
      .filter((item) => item.role === 'assistant')
      .map((item) => item.content || '')
      .join('\n');
    if (pattern.test(text)) return text;
    await wait(1000);
  }
  throw new Error(`Timed out waiting for assistant reply matching ${pattern}`);
}

function latestRunEvidence() {
  const data = readInstalledData();
  const run = (data.runs || [])[0] || {};
  const stdout = String(run.evidence?.stdout || run.output?.evidence?.stdout || '');
  const match = stdout.match(/foreground=(\{[^\n]+\})/);
  const foreground = match ? JSON.parse(match[1]) : null;
  return { run, stdout, foreground };
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

async function main() {
  await fetch(`${apiBase}/api/data`);

  let initialCount = readInstalledData().messages?.length || 0;
  await sendChat('我最近有什么事没办');
  const todoReply = await waitForAssistantAfter(initialCount, /\*\*当前未完成待办\*\*[\s\S]*\n1\.\s+\*\*/);

  const results = [];
  for (const testCase of actionCases) {
    initialCount = readInstalledData().messages?.length || 0;
    await sendChat(testCase.text);
    const reply = await waitForAssistantAfter(initialCount, testCase.replyPattern);
    await wait(1800);
    const evidence = latestRunEvidence();
    if (!evidence.foreground?.Focused || !testCase.foregroundPattern.test(evidence.foreground.ProcessName || '')) {
      throw new Error(`${testCase.text}: foreground evidence mismatch: ${JSON.stringify(evidence)}`);
    }
    results.push({
      text: testCase.text,
      reply,
      foreground: evidence.foreground,
      desktopShot: captureDesktop(testCase.screenshot)
    });
  }

  const summary = {
    outDir,
    apiBase,
    todoReply,
    results
  };
  writeFileSync(join(outDir, 'summary-api.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify({
    outDir,
    results: results.map(({ text, foreground, desktopShot }) => ({ text, foreground, desktopShot }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
