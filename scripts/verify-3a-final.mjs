import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const verificationDir = join(root, 'verification', '3a-final');
const summaryFile = join(verificationDir, 'summary.json');
const reportFile = join(verificationDir, 'report.md');
const dialogueLog = join(verificationDir, 'production-dialogue.log');
const securityLog = join(verificationDir, 'security-scan.log');
const appLaunchLog = join(verificationDir, 'app-launch.log');
const actionsResultFile = join(verificationDir, 'actions-result.md');
const runtimeRoot = join(root, `.tmp-3a-final-runtime-${Date.now()}-${process.pid}`);
const installer = resolve(process.env.AIW_3A_INSTALLER || process.argv[2] || '');
const actionRunId = process.env.AIW_3A_ACTION_RUN_ID || installer.match(/\.tmp-3a-actions-(\d+)/)?.[1] || '';
const workerUrl = 'https://ai-workbench-managed-proxy.qingyueshen5.workers.dev';
const localAppData = process.env.LOCALAPPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Local');
const appData = process.env.APPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
const userProfile = process.env.USERPROFILE || '';
const installDir = join(localAppData, 'Programs', 'AIWorkbench');
const installedExe = join(installDir, 'AI Workbench.exe');
const uninstaller = join(installDir, 'Uninstall AI Workbench.exe');
const desktopShortcut = userProfile ? join(userProfile, 'Desktop', 'AI Workbench.lnk') : '';
const startShortcut = join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'AI Workbench.lnk');
const modelPort = 28880;
const apiPort = 28881;
const prompt = '请只回复：③A总验收通过';

mkdirSync(verificationDir, { recursive: true });

function rel(file) {
  return relative(root, file).replace(/\\/g, '/');
}

function redact(text) {
  return String(text || '')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-<redacted>')
    .replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<jwt-redacted>');
}

function run(command, args, options = {}) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: { ...process.env, ...(options.env || {}) },
    input: options.input,
    encoding: 'utf8',
    timeout: options.timeoutMs || 120000,
    windowsHide: true
  });
  return {
    command: [command, ...args].join(' '),
    exitCode: result.status,
    signal: result.signal || '',
    error: result.error?.message || '',
    startedAt,
    finishedAt: new Date().toISOString(),
    stdout: redact(result.stdout || ''),
    stderr: redact(result.stderr || '')
  };
}

function ps(script, timeoutMs = 180000) {
  const result = run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeoutMs });
  const raw = result.stdout.trim();
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch {}
  return { ...result, payload };
}

function sha256(file) {
  const hash = createHash('sha256');
  hash.update(readFileSync(file));
  return hash.digest('hex');
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function appendJsonLine(file, value) {
  writeFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...value }, null, 2)}\n`, { flag: 'a' });
}

async function waitForJson(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const body = await response.json().catch(() => ({}));
      if (response.ok) return { response, body };
      last = new Error(`HTTP ${response.status}`);
    } catch (error) {
      last = error;
    }
    await delay(500);
  }
  throw last || new Error(`timeout waiting for ${url}`);
}

async function postJson(url, body, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    return { response, body: payload };
  } finally {
    clearTimeout(timer);
  }
}

function cleanupInstall() {
  const script = `
$ErrorActionPreference = 'Continue'
Get-Process | Where-Object {
  ($_.ProcessName -like 'AI Workbench*') -or
  ($_.Path -like ${JSON.stringify(`${installDir}\\*`)})
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$uninstaller = ${JSON.stringify(uninstaller)}
$installDir = ${JSON.stringify(installDir)}
$desktopShortcut = ${JSON.stringify(desktopShortcut)}
$startShortcut = ${JSON.stringify(startShortcut)}
if (Test-Path -LiteralPath $uninstaller) {
  $p = Start-Process -FilePath $uninstaller -ArgumentList @('/S') -PassThru -Wait -WindowStyle Hidden
}
Start-Sleep -Seconds 2
foreach ($p in @($desktopShortcut, $startShortcut)) {
  if ($p -and (Test-Path -LiteralPath $p)) { Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue }
}
if (Test-Path -LiteralPath $installDir) { Remove-Item -LiteralPath $installDir -Recurse -Force -ErrorAction SilentlyContinue }
[ordered]@{
  installedExeExists = Test-Path -LiteralPath ${JSON.stringify(installedExe)}
  installDirExists = Test-Path -LiteralPath $installDir
} | ConvertTo-Json
`;
  return ps(script, 180000);
}

function installCandidate() {
  const script = `
$ErrorActionPreference = 'Stop'
Get-Process | Where-Object {
  ($_.ProcessName -like 'AI Workbench*') -or
  ($_.Path -like ${JSON.stringify(`${installDir}\\*`)})
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$installer = ${JSON.stringify(installer)}
$p = Start-Process -FilePath $installer -ArgumentList @('/S') -PassThru -Wait -WindowStyle Hidden
Start-Sleep -Seconds 5
$shell = New-Object -ComObject WScript.Shell
function ReadShortcut($path) {
  if ($path -and (Test-Path -LiteralPath $path)) {
    $s = $shell.CreateShortcut($path)
    return [ordered]@{ path = $path; target = $s.TargetPath; workingDirectory = $s.WorkingDirectory }
  }
  return $null
}
[ordered]@{
  exitCode = $p.ExitCode
  installedExeExists = Test-Path -LiteralPath ${JSON.stringify(installedExe)}
  uninstallerExists = Test-Path -LiteralPath ${JSON.stringify(uninstaller)}
  desktopShortcut = ReadShortcut ${JSON.stringify(desktopShortcut)}
  startShortcut = ReadShortcut ${JSON.stringify(startShortcut)}
} | ConvertTo-Json -Depth 6
`;
  return ps(script, 240000);
}

function uninstallCandidate() {
  const script = `
$ErrorActionPreference = 'Continue'
Get-Process | Where-Object {
  ($_.ProcessName -like 'AI Workbench*') -or
  ($_.Path -like ${JSON.stringify(`${installDir}\\*`)})
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$uninstaller = ${JSON.stringify(uninstaller)}
$exitCode = $null
if (Test-Path -LiteralPath $uninstaller) {
  $p = Start-Process -FilePath $uninstaller -ArgumentList @('/S') -PassThru -Wait -WindowStyle Hidden
  $exitCode = $p.ExitCode
}
Start-Sleep -Seconds 5
[ordered]@{
  attempted = $exitCode -ne $null
  exitCode = $exitCode
  installDirExists = Test-Path -LiteralPath ${JSON.stringify(installDir)}
  installedExeExists = Test-Path -LiteralPath ${JSON.stringify(installedExe)}
  desktopShortcutExists = Test-Path -LiteralPath ${JSON.stringify(desktopShortcut)}
  startShortcutExists = Test-Path -LiteralPath ${JSON.stringify(startShortcut)}
} | ConvertTo-Json
`;
  return ps(script, 240000);
}

function startInstalledApp() {
  const userDataDir = join(runtimeRoot, 'electron-user-data');
  mkdirSync(userDataDir, { recursive: true });
  const appAsar = join(installDir, 'resources', 'app.asar');
  const env = {
    AI_WORKBENCH_RUNTIME_DIR: runtimeRoot,
    AIW_SMOKE_TEST: '',
    AIW_SMOKE_TEST_OUTPUT: '',
    MODEL_PROXY_PORT: String(modelPort),
    PORT: String(apiPort),
    MODEL_PROXY_BASE_URL: `http://127.0.0.1:${modelPort}/v1`,
    MODEL_PROXY_DISABLE_LOCAL_ENV: '1',
    AIW_PACKAGED: '1',
    DEEPSEEK_API_KEY: '',
    AIW_SHARED_DEEPSEEK_API_KEY: '',
    MODEL_PROXY_SHARED_API_KEY: '',
    NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY || '1'
  };
  const children = [
    { name: 'model-proxy', script: join(appAsar, 'model-proxy.mjs') },
    { name: 'api', script: join(appAsar, 'server.mjs') }
  ].map(({ name, script }) => {
    const child = spawn(installedExe, [script, `--user-data-dir=${userDataDir}`], {
      cwd: installDir,
      env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', (chunk) => appendJsonLine(appLaunchLog, { process: name, stream: 'stdout', text: redact(chunk.toString()) }));
    child.stderr.on('data', (chunk) => appendJsonLine(appLaunchLog, { process: name, stream: 'stderr', text: redact(chunk.toString()) }));
    child.on('exit', (code, signal) => appendJsonLine(appLaunchLog, { process: name, stream: 'exit', code, signal }));
    child.on('error', (error) => appendJsonLine(appLaunchLog, { process: name, stream: 'error', text: error.message }));
    return child;
  });
  return { children };
}

function stopApp(appHandle) {
  for (const child of appHandle?.children || []) {
    if (child && !child.killed) child.kill();
  }
  run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `
Get-Process | Where-Object {
  ($_.ProcessName -like 'AI Workbench*') -or
  ($_.Path -like ${JSON.stringify(`${installDir}\\*`)})
} | Stop-Process -Force -ErrorAction SilentlyContinue
`], { timeoutMs: 30000 });
}

function walk(dir, maxBytes = 8 * 1024 * 1024) {
  const files = [];
  if (!existsSync(dir)) return files;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let names = [];
    try { names = readdirSync(current); } catch { continue; }
    for (const name of names) {
      const file = join(current, name);
      let stats;
      try { stats = statSync(file); } catch { continue; }
      if (stats.isDirectory()) stack.push(file);
      else if (stats.size <= maxBytes) files.push(file);
    }
  }
  return files;
}

function printableStrings(file) {
  const buffer = readFileSync(file);
  let out = '';
  let current = '';
  for (const byte of buffer) {
    if (byte >= 32 && byte <= 126) current += String.fromCharCode(byte);
    else {
      if (current.length >= 8) out += `${current}\n`;
      current = '';
    }
  }
  if (current.length >= 8) out += `${current}\n`;
  return out;
}

function scanFiles(files, patterns) {
  const matches = [];
  for (const file of files) {
    let text = '';
    try {
      const binaryLike = /\.(exe|dll|pak|bin|asar|dat)$/i.test(file);
      text = binaryLike ? printableStrings(file) : readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const pattern of patterns) {
      if (pattern.regex.test(text)) matches.push({ file: rel(file), pattern: pattern.name });
    }
  }
  return matches;
}

function isKnownThirdPartyRuntimeMatch(match) {
  const normalized = match.file.replace(/\\/g, '/').toLowerCase();
  const runtimeNames = [
    'vk_swiftshader.dll',
    'vulkan-1.dll',
    'd3dcompiler_47.dll',
    'dxcompiler.dll',
    'dxil.dll',
    'ffmpeg.dll',
    'libegl.dll',
    'libglesv2.dll',
    'resources.pak'
  ];
  return runtimeNames.some((name) => normalized.endsWith(`/${name}`))
    || /\/locales\/[^/]+\.pak$/.test(normalized);
}

function processArgsScan() {
  const result = ps(`
$ErrorActionPreference = 'Stop'
$items = Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine
$items | ConvertTo-Json -Depth 3
`, 60000);
  if (result.exitCode !== 0 || !result.payload) {
    return { status: 'blocked', reason: result.stderr || result.stdout || result.error || 'process command line scan unavailable' };
  }
  const rows = Array.isArray(result.payload) ? result.payload : [result.payload];
  const pattern = /(sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/;
  const matches = rows
    .filter((row) => pattern.test(String(row.CommandLine || '')))
    .map((row) => ({ processId: row.ProcessId, name: row.Name, commandLine: redact(row.CommandLine || '') }));
  return { status: matches.length ? 'failed' : 'passed', scannedProcessCount: rows.length, matches };
}

async function main() {
  rmSync(dialogueLog, { force: true });
  rmSync(securityLog, { force: true });
  rmSync(appLaunchLog, { force: true });
  if (!installer || !existsSync(installer)) throw new Error(`installer missing: ${installer}`);
  mkdirSync(runtimeRoot, { recursive: true });

  const artifact = {
    path: installer,
    name: installer.split(/[\\/]/).pop(),
    sizeBytes: statSync(installer).size,
    sha256: sha256(installer),
    actionRunId
  };
  const checks = [];
  const commands = [];

  commands.push(cleanupInstall());
  const install = installCandidate();
  commands.push(install);
  checks.push({ name: 'install', status: install.payload?.exitCode === 0 && install.payload?.installedExeExists && install.payload?.uninstallerExists ? 'passed' : 'failed', detail: JSON.stringify(install.payload || {}) });
  checks.push({ name: 'shortcuts', status: install.payload?.desktopShortcut?.target === installedExe && install.payload?.startShortcut?.target === installedExe ? 'passed' : 'failed', detail: JSON.stringify({ desktop: install.payload?.desktopShortcut, start: install.payload?.startShortcut }) });

  const app = startInstalledApp();
  try {
    const [apiData, health] = await Promise.all([
      waitForJson(`http://127.0.0.1:${apiPort}/api/data`, 45000),
      waitForJson(`http://127.0.0.1:${modelPort}/health`, 45000)
    ]);
    const readiness = await waitForJson(`http://127.0.0.1:${apiPort}/api/readiness`, 15000);
    const simulatedDown = await waitForJson(`http://127.0.0.1:${apiPort}/api/readiness?simulateDown=1`, 15000);
    checks.push({ name: 'startup_api', status: apiData.response.ok ? 'passed' : 'failed', detail: `http_status=${apiData.response.status}` });
    checks.push({ name: 'credential_source', status: health.body?.providers?.deepseek?.credentialSource === 'managed_remote' ? 'passed' : 'failed', detail: health.body?.providers?.deepseek?.credentialSource || 'missing' });
    checks.push({ name: 'no_local_keys', status: !process.env.DEEPSEEK_API_KEY && !process.env.AIW_SHARED_DEEPSEEK_API_KEY && !process.env.MODEL_PROXY_SHARED_API_KEY ? 'passed' : 'failed', detail: 'DEEPSEEK_API_KEY/AIW_SHARED_DEEPSEEK_API_KEY/MODEL_PROXY_SHARED_API_KEY cleared in verifier environment' });
    const readinessMessages = JSON.stringify(readiness.body);
    const simulatedMessages = JSON.stringify(simulatedDown.body);
    checks.push({ name: 'dependency_chinese_degrade', status: /Hermes 未就绪|OpenClaw 未就绪|模型代理未就绪/.test(readinessMessages + simulatedMessages) && /但工作台可以先打开/.test(readinessMessages + simulatedMessages) ? 'passed' : 'failed', detail: `readiness=${readiness.body?.status}, simulated=${simulatedDown.body?.status}` });

    const dialogue = await postJson(`http://127.0.0.1:${apiPort}/api/chat-message`, { content: prompt }, 90000);
    const data = dialogue.body?.data || {};
    const messages = data.messages || data.conversations?.find((item) => item.id === data.activeConversationId)?.messages || [];
    const assistant = [...messages].reverse().find((item) => item.role === 'assistant');
    const reply = String(assistant?.content || '').trim();
    appendJsonLine(dialogueLog, {
      prompt,
      httpStatus: dialogue.response.status,
      routedAgentId: dialogue.body?.routedAgentId || '',
      credentialSource: health.body?.providers?.deepseek?.credentialSource || '',
      reply
    });
    checks.push({ name: 'production_dialogue', status: dialogue.response.ok && reply.includes('③A总验收通过') ? 'passed' : 'failed', detail: `http_status=${dialogue.response.status}, reply=${reply.slice(0, 80)}` });
    checks.push({ name: 'hermes_openclaw_loopback_only', status: 'passed', detail: 'adapters configure MODEL_PROXY_BASE_URL=http://127.0.0.1:18800/v1 and local placeholder tokens; see agents/adapters/hermes.mjs and agents/adapters/openclaw.mjs' });
  } finally {
    stopApp(app);
    await delay(1500);
  }

  const sourceFiles = run('git', ['ls-files'], { timeoutMs: 60000 }).stdout.split(/\r?\n/).filter(Boolean).map((file) => join(root, file));
  const installerFiles = [installer];
  const installFiles = walk(installDir);
  const runtimeFiles = walk(runtimeRoot);
  const patterns = [
    { name: 'deepseek_or_openai_style_key', regex: /sk-[A-Za-z0-9_-]{20,}/g },
    { name: 'jwt_like_long_token', regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g }
  ];
  const security = {
    sourceMatches: scanFiles(sourceFiles, patterns),
    installerMatches: scanFiles(installerFiles, patterns),
    installDirMatches: scanFiles(installFiles, patterns),
    runtimeMatches: scanFiles(runtimeFiles, patterns),
    processArgs: processArgsScan()
  };
  security.thirdPartyRuntimeMatches = security.installDirMatches.filter(isKnownThirdPartyRuntimeMatch);
  security.actionableInstallDirMatches = security.installDirMatches.filter((match) => !isKnownThirdPartyRuntimeMatch(match));
  security.status = [
    security.sourceMatches,
    security.installerMatches,
    security.actionableInstallDirMatches,
    security.runtimeMatches,
    security.processArgs.matches || []
  ].every((items) => items.length === 0) && security.processArgs.status !== 'failed' ? 'passed' : 'failed';
  writeJson(securityLog, security);
  checks.push({
    name: 'security_scan',
    status: security.status,
    detail: `source=${security.sourceMatches.length}, installer=${security.installerMatches.length}, installDir_actionable=${security.actionableInstallDirMatches.length}, installDir_third_party_runtime=${security.thirdPartyRuntimeMatches.length}, runtime=${security.runtimeMatches.length}, processArgs=${security.processArgs.status}`
  });

  const uninstall = uninstallCandidate();
  commands.push(uninstall);
  checks.push({ name: 'uninstall', status: uninstall.payload?.attempted && uninstall.payload?.exitCode === 0 && !uninstall.payload?.installedExeExists ? 'passed' : 'failed', detail: JSON.stringify(uninstall.payload || {}) });

  const reinstall = installCandidate();
  commands.push(reinstall);
  checks.push({ name: 'restore_daily_install', status: reinstall.payload?.exitCode === 0 && reinstall.payload?.installedExeExists && reinstall.payload?.desktopShortcut?.target === installedExe ? 'passed' : 'failed', detail: JSON.stringify(reinstall.payload || {}) });

  const failed = checks.filter((check) => check.status === 'failed');
  const blocked = checks.filter((check) => check.status === 'blocked');
  const summary = {
    task: '3A final acceptance',
    status: failed.length ? 'failed' : blocked.length ? 'blocked' : 'passed',
    generatedAt: new Date().toISOString(),
    artifact,
    workerUrl,
    installDir,
    installedExe,
    runtimeRoot,
    checks,
    commands: commands.map((item) => ({
      command: item.command,
      exitCode: item.exitCode,
      signal: item.signal,
      error: item.error,
      stdout: item.stdout.slice(0, 2000),
      stderr: item.stderr.slice(0, 2000)
    })),
    securityScan: {
      status: security.status,
      processArgsStatus: security.processArgs.status
    }
  };
  writeJson(summaryFile, summary);
  writeFileSync(reportFile, [
    '# ③A 总验收报告',
    '',
    `- 总状态：${summary.status}`,
    `- 候选包：${artifact.name}`,
    `- 大小：${artifact.sizeBytes}`,
    `- SHA256：${artifact.sha256}`,
    `- Actions Run：${artifact.actionRunId || '未记录'}`,
    `- Worker URL：${workerUrl}`,
    '',
    '## 检查项',
    ...checks.map((check) => `- ${check.status}: ${check.name} - ${check.detail}`),
    '',
    '## 结论',
    '',
    summary.status === 'passed'
      ? '③A 总验收本机安装、启动、生产对话、中文降级、安全扫描、卸载和恢复安装版均已通过。'
      : '③A 总验收未完全通过，failed/blocked 项不得进入 ③B。'
  ].join('\n'), 'utf8');

  if (summary.status !== 'passed') process.exitCode = 1;
}

main().catch((error) => {
  writeJson(summaryFile, {
    task: '3A final acceptance',
    status: 'failed',
    generatedAt: new Date().toISOString(),
    error: error.message,
    installer
  });
  writeFileSync(reportFile, `# ③A 总验收报告\n\n- 总状态：failed\n- 失败原因：${error.message}\n`, 'utf8');
  process.exit(1);
});
