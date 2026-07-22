import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, relative } from 'node:path';

const root = process.cwd();
const version = '0.4.6';
const artifactName = `AI-Workbench-Setup-v${version}-x64.exe`;
const releaseDir = join(root, `release-v${version}-installer`);
const artifactPath = join(releaseDir, artifactName);
const unpackedExe = join(releaseDir, 'win-unpacked', 'AI Workbench.exe');
const verificationDir = join(root, 'verification', 'install-release');
const summaryFile = join(verificationDir, 'preflight-summary.json');
const reportFile = join(verificationDir, 'preflight-report.md');
const smokeOutputFile = join(verificationDir, 'smoke-test.json');
const nsisEvidenceFile = join(verificationDir, 'nsis-install-uninstall.json');
const repair1SummaryFile = join(verificationDir, 'repair1-summary.json');
const repair1ReportFile = join(verificationDir, 'repair1-report.md');
const repair1InstallLog = join(verificationDir, 'repair1-install.log');
const repair1SmokeLog = join(verificationDir, 'repair1-smoke.log');
const repair1UninstallLog = join(verificationDir, 'repair1-uninstall.log');

mkdirSync(verificationDir, { recursive: true });

const commands = [];

function runCommand(command, args, options = {}) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    timeout: options.timeoutMs || 30000,
    windowsHide: true
  });
  const record = {
    command: [command, ...args].join(' '),
    exitCode: result.status,
    signal: result.signal || '',
    startedAt,
    finishedAt: new Date().toISOString(),
    stdout: redact(result.stdout || ''),
    stderr: redact(result.stderr || '')
  };
  commands.push(record);
  return { ...record, rawStdout: result.stdout || '', rawStderr: result.stderr || '' };
}

function runPowerShell(script, logFile, timeoutMs = 120000) {
  const result = runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeoutMs });
  writeFileSync(logFile, `${result.stdout}\n${result.stderr}`, 'utf8');
  let payload = null;
  try {
    const raw = result.rawStdout.trim();
    payload = raw ? JSON.parse(raw) : null;
  } catch (error) {
    payload = { parseError: error.message, raw: redact(result.rawStdout) };
  }
  return { ...result, payload };
}

function redact(value) {
  let text = String(value || '');
  for (const name of ['DEEPSEEK_API_KEY', 'SERPER_API_KEY', 'AIW_SHARED_DEEPSEEK_API_KEY', 'MODEL_PROXY_SHARED_API_KEY']) {
    const secret = String(process.env[name] || '').trim();
    if (secret) text = text.split(secret).join(`<redacted:${name}>`);
  }
  return text.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-<redacted>');
}

function sha256(file) {
  const hash = createHash('sha256');
  hash.update(readFileSync(file));
  return hash.digest('hex');
}

function walkFiles(dir, limitBytes = 1024 * 1024 * 8) {
  const files = [];
  if (!existsSync(dir)) return files;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      const relativePath = relative(root, path).replace(/\\/g, '/');
      if (/node_modules\/\.cache|Cache_Data|GPUCache|Code Cache/i.test(relativePath)) continue;
      const stats = statSync(path);
      if (stats.isDirectory()) {
        stack.push(path);
      } else if (stats.size <= limitBytes) {
        files.push(path);
      }
    }
  }
  return files;
}

function scanFiles(files, patterns) {
  const hits = [];
  for (const file of files) {
    let text = '';
    try {
      text = readFileSync(file, 'latin1');
    } catch {
      continue;
    }
    for (const pattern of patterns) {
      if (pattern instanceof RegExp) {
        if (pattern.test(text)) hits.push({ file: relative(root, file).replace(/\\/g, '/'), pattern: String(pattern) });
      } else if (text.includes(pattern)) {
        hits.push({ file: relative(root, file).replace(/\\/g, '/'), pattern });
      }
    }
  }
  return hits;
}

function printableStrings(file) {
  const buffer = readFileSync(file);
  const strings = [];
  let current = '';
  for (const byte of buffer) {
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= 8) strings.push(current);
      current = '';
    }
  }
  if (current.length >= 8) strings.push(current);
  return strings.join('\n');
}

function scanBinary(file, patterns) {
  if (!existsSync(file)) return [];
  const text = printableStrings(file);
  return patterns
    .filter((pattern) => pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern))
    .map((pattern) => ({ file: relative(root, file).replace(/\\/g, '/'), pattern: String(pattern) }));
}

function reservePort(port) {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('occupied by install-release verifier');
    });
    server.on('error', (error) => resolve({ ok: false, port, error: error.message, server: null }));
    server.listen(port, '127.0.0.1', () => resolve({ ok: true, port, server }));
  });
}

function startMockUpstream() {
  return new Promise((resolve) => {
    const calls = [];
    const server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        calls.push({ url: request.url, authorization: request.headers.authorization || '', body });
        if (request.url === '/v1/chat/completions') {
          response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify({
            id: 'mock-install-release',
            object: 'chat.completion',
            choices: [{ index: 0, message: { role: 'assistant', content: '安装包预验收 mock 通过。' }, finish_reason: 'stop' }]
          }));
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: true }));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, calls, baseUrl: `http://127.0.0.1:${address.port}/v1` });
    });
  });
}

async function runPackagedSmoke() {
  const runtimeRoot = join(tmpdir(), `aiw-install-release-runtime-${process.pid}-${Date.now()}`);
  mkdirSync(runtimeRoot, { recursive: true });
  rmSync(smokeOutputFile, { force: true });
  const mock = await startMockUpstream();
  const portBase = 23000 + (process.pid % 1000);
  const result = await new Promise((resolve) => {
    const child = spawn(unpackedExe, ['--smoke-test'], {
      cwd: dirname(unpackedExe),
      windowsHide: true,
      env: {
        ...process.env,
        AI_WORKBENCH_RUNTIME_DIR: join(runtimeRoot, 'ai-workbench-runtime'),
        AIW_SMOKE_TEST: '1',
        AIW_SMOKE_TEST_OUTPUT: smokeOutputFile,
        MODEL_PROXY_PORT: String(portBase),
        PORT: String(portBase + 1),
        MODEL_PROXY_DISABLE_LOCAL_ENV: '1',
        MODEL_PROXY_DEEPSEEK_BASE_URL: mock.baseUrl,
        AIW_SHARED_DEEPSEEK_API_KEY: 'mock-shared-key-for-install-release'
      },
      stdio: 'ignore'
    });
    const startedAt = new Date().toISOString();
    const timer = setTimeout(() => {
      child.kill();
      resolve({ exitCode: null, timedOut: true, startedAt, finishedAt: new Date().toISOString() });
    }, 30000);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ exitCode: code, signal: signal || '', timedOut: false, startedAt, finishedAt: new Date().toISOString() });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: null, error: error.message, timedOut: false, startedAt, finishedAt: new Date().toISOString() });
    });
  });
  mock.server.close();
  const runtimeDirs = ['config', 'data', 'logs', 'evidence'].map((name) => join(runtimeRoot, 'ai-workbench-runtime', name));
  const smoke = existsSync(smokeOutputFile) ? JSON.parse(readFileSync(smokeOutputFile, 'utf8')) : null;
  return {
    ...result,
    runtimeRoot,
    smokeOutputFile: relative(root, smokeOutputFile).replace(/\\/g, '/'),
    smoke,
    runtimeDirs: Object.fromEntries(runtimeDirs.map((dir) => [basename(dir), existsSync(dir)])),
    mechanism_test: {
      type: 'mock_upstream',
      sharedManagedConfigured: smoke?.readiness?.checks?.some((check) => check.id === 'model_proxy') ?? false
    },
    production_test: {
      status: 'blocked',
      reason: '3A has no production shared key injection evidence; mock only verifies mechanism.'
    }
  };
}

async function testDependencyFallback() {
  const port = 24000 + (process.pid % 1000);
  const runtimeRoot = join(tmpdir(), `aiw-install-release-deps-${process.pid}-${Date.now()}`);
  const child = spawn(process.execPath, [join(root, 'server.mjs')], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(port),
      AI_WORKBENCH_RUNTIME_DIR: runtimeRoot,
      AIW_SIMULATE_DEPENDENCIES_DOWN: '1',
      MODEL_PROXY_DISABLE_LOCAL_ENV: '1'
    },
    stdio: 'ignore'
  });
  try {
    const payload = await waitForJson(`http://127.0.0.1:${port}/api/readiness?simulateDown=1`, 10000);
    const messages = JSON.stringify(payload);
    return {
      ok: payload.status === 'degraded' && /模型代理未就绪|Hermes 未就绪|OpenClaw 未就绪/.test(messages),
      port,
      status: payload.status,
      notReady: (payload.checks || []).filter((check) => !check.ok).map((check) => check.id),
      hasChineseMessage: /未就绪|不可用|暂不/.test(messages)
    };
  } finally {
    child.kill();
  }
}

async function testPortConflict() {
  const modelPort = 25000 + (process.pid % 1000);
  const apiPort = modelPort + 1;
  const occupiedModel = await reservePort(modelPort);
  const occupiedApi = await reservePort(apiPort);
  const proxy = runCommand(process.execPath, [join(root, 'model-proxy.mjs')], {
    timeoutMs: 6000,
    env: {
      MODEL_PROXY_PORT: String(modelPort),
      AI_WORKBENCH_RUNTIME_DIR: join(tmpdir(), `aiw-install-release-port-proxy-${process.pid}`),
      MODEL_PROXY_DISABLE_LOCAL_ENV: '1'
    }
  });
  const result = {
    modelPort,
    apiPort,
    occupiedModel: occupiedModel.ok,
    occupiedApi: occupiedApi.ok,
    proxyExitCode: proxy.exitCode,
    proxyExplainedConflict: /端口|占用|not_ready|already/i.test(`${proxy.stdout}\n${proxy.stderr}`)
  };
  occupiedModel.server?.close();
  occupiedApi.server?.close();
  return result;
}

function waitForJson(url, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      fetch(url).then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        resolve(await response.json());
      }).catch((error) => {
        if (Date.now() - started > timeoutMs) {
          reject(error);
          return;
        }
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function powershellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runNsisInstallUninstall() {
  const helper = runCommand(process.execPath, [join(root, 'scripts', 'verify-nsis-install.mjs'), artifactPath, verificationDir], {
    timeoutMs: 240000
  });
  let helperPayload = null;
  try {
    helperPayload = JSON.parse(helper.rawStdout || '{}');
  } catch (error) {
    helperPayload = {
      task: 'nsis-install-uninstall',
      version,
      installer: relative(root, artifactPath).replace(/\\/g, '/'),
      status: 'failed',
      parseError: error.message,
      stdout: helper.stdout,
      stderr: helper.stderr
    };
  }
  writeFileSync(nsisEvidenceFile, `${JSON.stringify(helperPayload, null, 2)}\n`, 'utf8');
  return helperPayload;

  const r1TempRoot = join(root, '.tmp-install-r1', `${process.pid}-${Date.now()}`);
  const shortcutBackupDir = join(r1TempRoot, 'shortcut-backup');
  const smokeRoot = join(r1TempRoot, 'smoke');
  mkdirSync(r1TempRoot, { recursive: true });
  const script = `
$ErrorActionPreference = 'Continue'
$installer = ${powershellString(artifactPath)}
$backup = ${powershellString(shortcutBackupDir)}
$smokeRoot = ${powershellString(smokeRoot)}
$nsisLog = Join-Path $smokeRoot 'nsis-installer.log'
$updaterInstaller = Join-Path $env:LOCALAPPDATA 'ai-workbench-updater\\installer.exe'
$desktop = [Environment]::GetFolderPath('Desktop')
$desktopShortcut = Join-Path $desktop 'AI Workbench.lnk'
$startMenuShortcut = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\AI Workbench.lnk'
New-Item -ItemType Directory -Force -Path $backup | Out-Null
New-Item -ItemType Directory -Force -Path $smokeRoot | Out-Null
$beforeShortcuts = @()
$movedShortcuts = @()
$shell = New-Object -ComObject WScript.Shell
foreach ($lnk in @($desktopShortcut, $startMenuShortcut)) {
  if (Test-Path -LiteralPath $lnk) {
    $s = $shell.CreateShortcut($lnk)
    $beforeShortcuts += [pscustomobject]@{ path = $lnk; target = $s.TargetPath; workingDirectory = $s.WorkingDirectory }
    $dest = Join-Path $backup ([IO.Path]::GetFileName($lnk) + '.' + ([guid]::NewGuid().ToString('N')) + '.bak')
    Move-Item -LiteralPath $lnk -Destination $dest -Force
    $movedShortcuts += [pscustomobject]@{ original = $lnk; backup = $dest }
  }
}
$install = Start-Process -FilePath $installer -ArgumentList @('/S') -PassThru -Wait -WindowStyle Hidden
Start-Sleep -Seconds 3
$uninstallRegistry = @()
foreach ($rootKey in @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall')) {
  if (Test-Path -LiteralPath $rootKey) {
    Get-ChildItem -LiteralPath $rootKey -ErrorAction SilentlyContinue | ForEach-Object {
      $item = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
      if ($item.DisplayName -eq 'AI Workbench') {
        $uninstallRegistry += [pscustomobject]@{
          key = $_.Name
          displayName = $item.DisplayName
          displayVersion = $item.DisplayVersion
          installLocation = $item.InstallLocation
          displayIcon = $item.DisplayIcon
          uninstallString = $item.UninstallString
          quietUninstallString = $item.QuietUninstallString
        }
      }
    }
  }
}
$afterInstallShortcuts = @()
foreach ($lnk in @($desktopShortcut, $startMenuShortcut)) {
  if (Test-Path -LiteralPath $lnk) {
    $s = $shell.CreateShortcut($lnk)
    $afterInstallShortcuts += [pscustomobject]@{ path = $lnk; target = $s.TargetPath; workingDirectory = $s.WorkingDirectory }
  }
}
$candidateExePaths = @()
foreach ($shortcut in $afterInstallShortcuts) {
  if ($shortcut.target) { $candidateExePaths += $shortcut.target }
}
foreach ($entry in $uninstallRegistry) {
  if ($entry.installLocation) { $candidateExePaths += (Join-Path $entry.installLocation 'AI Workbench.exe') }
  if ($entry.displayIcon) {
    $iconPath = ($entry.displayIcon -replace '^"', '') -replace '",.*$', ''
    if ($iconPath -like '*.exe') { $candidateExePaths += $iconPath }
  }
}
$candidateExePaths += (Join-Path $env:LOCALAPPDATA 'Programs\\AI Workbench\\AI Workbench.exe')
$candidateExePaths += (Join-Path $env:LOCALAPPDATA 'Programs\\AIWorkbench\\AI Workbench.exe')
$candidateExePaths += (Join-Path $env:LOCALAPPDATA 'AI Workbench\\AI Workbench.exe')
$installedExe = ''
$waitStarted = Get-Date
while (-not $installedExe -and ((Get-Date) - $waitStarted).TotalSeconds -lt 60) {
  foreach ($candidate in $candidateExePaths | Select-Object -Unique) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      $installedExe = $candidate
      break
    }
  }
  if (-not $installedExe) { Start-Sleep -Seconds 2 }
}
$target = ''
if ($installedExe) { $target = Split-Path -Parent $installedExe }
$candidateUninstallers = @()
foreach ($entry in $uninstallRegistry) {
  if ($entry.uninstallString) {
    $candidateUninstallers += (($entry.uninstallString -replace '^"', '') -replace '"\\s.*$', '')
  }
  if ($entry.quietUninstallString) {
    $candidateUninstallers += (($entry.quietUninstallString -replace '^"', '') -replace '"\\s.*$', '')
  }
}
if ($target) {
  $candidateUninstallers += (Join-Path $target 'Uninstall AI Workbench.exe')
}
$uninstaller = ''
foreach ($candidate in $candidateUninstallers | Select-Object -Unique) {
  if ($candidate -and (Test-Path -LiteralPath $candidate)) {
    $uninstaller = $candidate
    break
  }
}
$fileVersion = ''
if ($installedExe -and (Test-Path -LiteralPath $installedExe)) {
  $fileVersion = (Get-Item -LiteralPath $installedExe).VersionInfo.FileVersion
}
$installedExeExistsAfterInstall = ($installedExe -and (Test-Path -LiteralPath $installedExe))
$uninstallerExistsAfterInstall = ($uninstaller -and (Test-Path -LiteralPath $uninstaller))
$shortcutsPointToInstalledExe = $false
if ($installedExe -and $afterInstallShortcuts.Count -gt 0) {
  $shortcutsPointToInstalledExe = (($afterInstallShortcuts | Where-Object { $_.target -eq $installedExe }).Count -eq $afterInstallShortcuts.Count)
}
$smokeOutput = Join-Path $smokeRoot 'smoke.json'
$smokeStdout = Join-Path $smokeRoot 'stdout.log'
$smokeStderr = Join-Path $smokeRoot 'stderr.log'
$smokeExit = $null
$smokeTimedOut = $false
if ($installedExe -and (Test-Path -LiteralPath $installedExe)) {
  $oldRuntime = $env:AI_WORKBENCH_RUNTIME_DIR
  $oldSmoke = $env:AIW_SMOKE_TEST
  $oldSmokeOut = $env:AIW_SMOKE_TEST_OUTPUT
  $oldPort = $env:PORT
  $oldProxyPort = $env:MODEL_PROXY_PORT
  $oldDisableEnv = $env:MODEL_PROXY_DISABLE_LOCAL_ENV
  $env:AI_WORKBENCH_RUNTIME_DIR = Join-Path $smokeRoot 'runtime'
  $env:AIW_SMOKE_TEST = '1'
  $env:AIW_SMOKE_TEST_OUTPUT = $smokeOutput
  $env:PORT = '29871'
  $env:MODEL_PROXY_PORT = '29870'
  $env:MODEL_PROXY_DISABLE_LOCAL_ENV = '1'
  $sp = Start-Process -FilePath $installedExe -ArgumentList @('--smoke-test') -PassThru -WindowStyle Hidden -RedirectStandardOutput $smokeStdout -RedirectStandardError $smokeStderr
  $finished = $sp.WaitForExit(45000)
  if ($finished) { $smokeExit = $sp.ExitCode } else { $smokeTimedOut = $true; Stop-Process -Id $sp.Id -Force }
  $env:AI_WORKBENCH_RUNTIME_DIR = $oldRuntime
  $env:AIW_SMOKE_TEST = $oldSmoke
  $env:AIW_SMOKE_TEST_OUTPUT = $oldSmokeOut
  $env:PORT = $oldPort
  $env:MODEL_PROXY_PORT = $oldProxyPort
  $env:MODEL_PROXY_DISABLE_LOCAL_ENV = $oldDisableEnv
}
$smokeJson = $null
if (Test-Path -LiteralPath $smokeOutput) {
  $smokeJson = Get-Content -LiteralPath $smokeOutput -Raw
}
$smokeRuntime = Join-Path $smokeRoot 'runtime'
$smokeRuntimeDirs = @{
  config = (Test-Path -LiteralPath (Join-Path $smokeRuntime 'config'))
  data = (Test-Path -LiteralPath (Join-Path $smokeRuntime 'data'))
  logs = (Test-Path -LiteralPath (Join-Path $smokeRuntime 'logs'))
  evidence = (Test-Path -LiteralPath (Join-Path $smokeRuntime 'evidence'))
}
$uninstallExit = $null
$uninstallAttempted = $false
if ($uninstaller -and (Test-Path -LiteralPath $uninstaller)) {
  $uninstallAttempted = $true
  $u = Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru -Wait -WindowStyle Hidden
  $uninstallExit = $u.ExitCode
  Start-Sleep -Seconds 3
}
$afterUninstallShortcuts = @()
foreach ($lnk in @($desktopShortcut, $startMenuShortcut)) {
  if (Test-Path -LiteralPath $lnk) {
    $s = $shell.CreateShortcut($lnk)
    $afterUninstallShortcuts += [pscustomobject]@{ path = $lnk; target = $s.TargetPath; workingDirectory = $s.WorkingDirectory }
    Remove-Item -LiteralPath $lnk -Force
  }
}
foreach ($entry in $movedShortcuts) {
  if (Test-Path -LiteralPath $entry.backup) {
    Move-Item -LiteralPath $entry.backup -Destination $entry.original -Force
  }
}
[pscustomobject]@{
  method = 'silent'
  installCommand = "$installer /S"
  nsisLog = $nsisLog
  nsisLogExists = (Test-Path -LiteralPath $nsisLog)
  nsisLogText = $(if (Test-Path -LiteralPath $nsisLog) { Get-Content -LiteralPath $nsisLog -Raw } else { '' })
  userContext = @{
    envUsername = $env:USERNAME
    environmentUserName = [Environment]::UserName
    userProfile = $env:USERPROFILE
    desktop = $desktop
    localAppData = $env:LOCALAPPDATA
    roamingAppData = $env:APPDATA
  }
  updaterInstaller = @{
    path = $updaterInstaller
    exists = (Test-Path -LiteralPath $updaterInstaller)
    sha256 = $(if (Test-Path -LiteralPath $updaterInstaller) { (Get-FileHash -LiteralPath $updaterInstaller -Algorithm SHA256).Hash } else { '' })
  }
  installExitCode = $install.ExitCode
  installTarget = $target
  installedExe = $installedExe
  installedExeExists = $installedExeExistsAfterInstall
  uninstaller = $uninstaller
  uninstallerExists = $uninstallerExistsAfterInstall
  installedExeExistsAfterUninstall = ($installedExe -and (Test-Path -LiteralPath $installedExe))
  fileVersion = $fileVersion
  uninstallRegistry = $uninstallRegistry
  shortcutsPointToInstalledExe = $shortcutsPointToInstalledExe
  installedSmoke = @{
    root = $smokeRoot
    output = $smokeOutput
    stdout = $smokeStdout
    stderr = $smokeStderr
    exitCode = $smokeExit
    timedOut = $smokeTimedOut
    outputExists = (Test-Path -LiteralPath $smokeOutput)
    outputJson = $smokeJson
    runtimeRoot = $smokeRuntime
    runtimeDirs = $smokeRuntimeDirs
  }
  beforeShortcuts = $beforeShortcuts
  movedShortcuts = $movedShortcuts
  afterInstallShortcuts = $afterInstallShortcuts
  uninstallAttempted = $uninstallAttempted
  uninstallCommand = "$uninstaller /S"
  uninstallExitCode = $uninstallExit
  installDirExistsAfterUninstall = ($target -and (Test-Path -LiteralPath $target))
  afterUninstallShortcuts = $afterUninstallShortcuts
  restoredShortcuts = $movedShortcuts
} | ConvertTo-Json -Depth 8
`;
  const result = runPowerShell(script, repair1InstallLog, 180000);
  const payload = result.payload || {};
  copyFileSync(repair1InstallLog, repair1UninstallLog);
  writeFileSync(nsisEvidenceFile, `${JSON.stringify({
    task: 'nsis-install-uninstall',
    version,
    installer: relative(root, artifactPath).replace(/\\/g, '/'),
    status: payload.installExitCode === 0 && payload.installedExeExists && payload.uninstallerExists && payload.shortcutsPointToInstalledExe && payload.installedSmoke?.exitCode === 0 && payload.uninstallAttempted && payload.uninstallExitCode === 0 && !payload.installDirExistsAfterUninstall ? 'passed' : 'failed',
    ...payload
  }, null, 2)}\n`, 'utf8');
  return payload;
}

function trackedRuntimeFiles() {
  const listed = runCommand('git', ['ls-files']).rawStdout.split(/\r?\n/).filter(Boolean);
  return listed
    .filter((file) => /\.(mjs|cjs|js|jsx|json|html|css|ps1|vbs)$/i.test(file))
    .filter((file) => !file.startsWith('verification/'))
    .filter((file) => !file.startsWith('research/'))
    .filter((file) => !file.startsWith('tasks/'))
    .filter((file) => !['EXECUTION_PROTOCOL.md', 'TASKLOG.md', 'AI-Workbench-Handoff.md', 'CURRENT_PROGRESS_AUDIT.md'].includes(file))
    .map((file) => join(root, file));
}

async function main() {
  const artifactExists = existsSync(artifactPath);
  const unpackedExists = existsSync(unpackedExe);
  const summary = {
    task: 'install-release-preflight',
    status: 'failed',
    version,
    artifactName,
    artifactPath: artifactExists ? relative(root, artifactPath).replace(/\\/g, '/') : '',
    artifactSizeBytes: artifactExists ? statSync(artifactPath).size : 0,
    sha256: artifactExists ? sha256(artifactPath) : '',
    build: {
      artifactExists,
      unpackedExists,
      releaseDir: relative(root, releaseDir).replace(/\\/g, '/')
    },
    install: {
      status: 'not_run',
      method: 'not_run',
      reason: '3A local script uses win-unpacked smoke test; NSIS install/uninstall must be run with explicit installer execution authorization.'
    },
    firstRun: {},
    sharedKey: {},
    dependencyFallback: {},
    portConflict: {},
    secretScan: {},
    uninstall: {
      status: 'not_run',
      method: 'not_run',
      reason: 'No NSIS install was performed by this script.'
    },
    actions: {
      status: 'not_run',
      reason: 'Workflow can be submitted by git push; no remote run result is available during local preflight.'
    },
    fiveCriteria: {
      a_noHardcodedPaths: false,
      b_firstRunCreatesFiles: false,
      c_missingDependenciesNoCrash: false,
      d_portConflictFallback: false,
      e_readinessReportComplete: false
    },
    commands,
    knownIssues: []
  };

  let nsisPayload = null;
  if (!artifactExists) summary.knownIssues.push('Installer artifact is missing.');
  if (!unpackedExists) summary.knownIssues.push('win-unpacked executable is missing.');

  if (artifactExists) {
    nsisPayload = runNsisInstallUninstall();
  }

  if (nsisPayload || existsSync(nsisEvidenceFile)) {
    const nsis = JSON.parse(readFileSync(nsisEvidenceFile, 'utf8'));
    summary.install = {
      status: (nsis.installedExeExists ?? nsis.expectedInstalledExeExists) && (nsis.uninstallerExists ?? nsis.expectedUninstallerExists) && Boolean(nsis.shortcutsPointToInstalledExe) ? 'passed' : 'failed',
      method: nsis.method,
      command: nsis.installCommand,
      exitCode: nsis.installExitCode,
      installDir: nsis.installTarget || nsis.expectedInstallDir,
      installedExeExists: nsis.installedExeExists ?? nsis.expectedInstalledExeExists,
      uninstallerExists: nsis.uninstallerExists ?? nsis.expectedUninstallerExists,
      installedExe: nsis.installedExe || '',
      uninstaller: nsis.uninstaller || '',
      shortcutsPointToInstalledExe: Boolean(nsis.shortcutsPointToInstalledExe),
      afterInstallShortcuts: nsis.afterInstallShortcuts || [],
      uninstallRegistry: nsis.uninstallRegistry || [],
      desktopShortcutExists: nsis.desktopShortcutExists,
      startMenuShortcutExists: nsis.startMenuShortcutExists,
      failureReason: nsis.failureReason || ''
    };
    summary.uninstall = {
      status: nsis.uninstallAttempted && nsis.uninstallExitCode === 0 ? 'passed' : 'failed',
      method: nsis.method,
      attempted: nsis.uninstallAttempted,
      exitCode: nsis.uninstallExitCode,
      installDirExistsAfterUninstall: Boolean(nsis.installDirExistsAfterUninstall),
      installedExeExistsAfterUninstall: Boolean(nsis.installedExeExistsAfterUninstall),
      afterUninstallShortcuts: nsis.afterUninstallShortcuts || [],
      failureReason: nsis.uninstallAttempted ? '' : 'Uninstall was not attempted because expected uninstaller was not created.'
    };
    let installedSmokeJson = null;
    try {
      installedSmokeJson = nsis.installedSmoke?.outputJson ? JSON.parse(nsis.installedSmoke.outputJson) : null;
    } catch {}
    summary.firstRun = {
      exitCode: nsis.installedSmoke?.exitCode ?? null,
      timedOut: Boolean(nsis.installedSmoke?.timedOut),
      runtimeRoot: nsis.installedSmoke?.runtimeRoot || '',
      smokeOutputFile: nsis.installedSmoke?.output || '',
      smoke: installedSmokeJson,
      runtimeDirs: nsis.installedSmoke?.runtimeDirs || {},
      mechanism_test: {
        type: 'installed_smoke',
        sharedManagedConfigured: installedSmokeJson?.readiness?.checks?.some((check) => check.id === 'model_proxy') ?? false
      },
      production_test: {
        status: 'blocked',
        reason: '3A-R1 does not implement production shared key injection; smoke validates installed app mechanics only.'
      }
    };
    summary.sharedKey = summary.firstRun.mechanism_test;
    summary.sharedKey.production_test = summary.firstRun.production_test;
  } else if (unpackedExists) {
    summary.firstRun = await runPackagedSmoke();
    summary.sharedKey = summary.firstRun.mechanism_test;
    summary.sharedKey.production_test = summary.firstRun.production_test;
  }

  try {
    summary.dependencyFallback = await testDependencyFallback();
  } catch (error) {
    summary.dependencyFallback = { ok: false, error: redact(error.message || error) };
  }

  try {
    summary.portConflict = await testPortConflict();
  } catch (error) {
    summary.portConflict = { ok: false, error: redact(error.message || error) };
  }

  const scanPatterns = [
    /sk-[A-Za-z0-9_-]{20,}/,
    'DEEPSEEK_API_KEY=',
    'SERPER_API_KEY=',
    'AIW_SHARED_DEEPSEEK_API_KEY=',
    'MODEL_PROXY_SHARED_API_KEY=',
    'C:\\Users\\胖胖虎',
    'F:\\AI-Workbench'
  ];
  const sourceHits = scanFiles(trackedRuntimeFiles(), scanPatterns);
  const packageTextFiles = walkFiles(join(releaseDir, 'win-unpacked'))
    .filter((file) => /\.(asar|json|js|cjs|mjs|html|css|yml|yaml|txt|map)$/i.test(file));
  const packageHits = scanFiles(packageTextFiles, scanPatterns);
  const installerHits = scanBinary(artifactPath, scanPatterns);
  const hardPathPatterns = ['C:\\Users\\胖胖虎', 'F:\\AI-Workbench'];
  const packagePathHits = scanFiles(packageTextFiles, hardPathPatterns);
  const installerPathHits = scanBinary(artifactPath, hardPathPatterns);
  summary.secretScan = {
    sourceRuntimeHits: sourceHits,
    packageHits,
    installerHits,
    packagePathHits,
    installerPathHits,
    ok: packageHits.length === 0 && installerHits.length === 0 && packagePathHits.length === 0 && installerPathHits.length === 0,
    note: 'sourceRuntimeHits are informational because runtime code may contain environment variable names or mock placeholders; package and installer hits are blocking.'
  };

  summary.fiveCriteria.a_noHardcodedPaths = summary.secretScan.ok;
  summary.fiveCriteria.b_firstRunCreatesFiles = Object.values(summary.firstRun.runtimeDirs || {}).every(Boolean);
  summary.fiveCriteria.c_missingDependenciesNoCrash = Boolean(summary.dependencyFallback.ok);
  summary.fiveCriteria.d_portConflictFallback = Boolean(summary.portConflict.proxyExplainedConflict);
  summary.fiveCriteria.e_readinessReportComplete = Boolean(summary.artifactPath && summary.sha256 && summary.firstRun.smokeOutputFile && summary.commands.length);

  const corePassed = Object.values(summary.fiveCriteria).every(Boolean)
    && artifactExists
    && unpackedExists
    && summary.install.status === 'passed'
    && summary.uninstall.status === 'passed'
    && summary.firstRun.exitCode === 0
    && summary.secretScan.ok;

  if (!summary.sharedKey?.production_test || summary.sharedKey.production_test.status !== 'passed') {
    summary.knownIssues.push('shared_managed production injection is not verified in 3A; mechanism test used mock upstream only.');
  }
  if (summary.install.status !== 'passed') summary.knownIssues.push('NSIS silent install did not create the expected per-user installed exe/uninstaller.');
  if (summary.uninstall.status !== 'passed') summary.knownIssues.push('Uninstall verification did not pass.');
  if (summary.install.status !== 'passed' && summary.install.shortcutsPointToInstalledExe === false) summary.knownIssues.push('Installed shortcuts did not point to the discovered installed executable.');
  if (summary.firstRun.exitCode !== 0 || !summary.firstRun.smoke) summary.knownIssues.push('Packaged Electron smoke test did not complete successfully.');
  summary.status = corePassed ? 'passed' : 'failed';

  writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(reportFile, renderReport(summary), 'utf8');
  writeFileSync(repair1SummaryFile, `${JSON.stringify({ ...summary, task: 'install-release-repair1' }, null, 2)}\n`, 'utf8');
  writeFileSync(repair1ReportFile, renderReport({ ...summary, task: 'install-release-repair1' }), 'utf8');
  console.log(JSON.stringify({ status: summary.status, summaryFile: relative(root, summaryFile), reportFile: relative(root, reportFile) }, null, 2));
  process.exitCode = summary.status === 'passed' ? 0 : 1;
}

function mark(value) {
  return value ? 'passed' : 'failed';
}

function renderReport(summary) {
  return `# Windows 安装包候选版发布前预验收

生成时间：${new Date().toISOString()}

## 总状态

- 状态：${summary.status}
- 版本：${summary.version}
- 安装包：${summary.artifactPath || '<missing>'}
- 大小：${summary.artifactSizeBytes}
- SHA256：${summary.sha256 || '<missing>'}

## 五条硬验收

| 标准 | 状态 |
| --- | --- |
| a. 无硬编码开发机路径 | ${mark(summary.fiveCriteria.a_noHardcodedPaths)} |
| b. 首次运行自建目录 | ${mark(summary.fiveCriteria.b_firstRunCreatesFiles)} |
| c. 依赖缺失不崩并给中文说明 | ${mark(summary.fiveCriteria.c_missingDependenciesNoCrash)} |
| d. 端口冲突有兜底 | ${mark(summary.fiveCriteria.d_portConflictFallback)} |
| e. 就绪报告完整 | ${mark(summary.fiveCriteria.e_readinessReportComplete)} |

## 安装与卸载

- 安装：${summary.install.status}，${summary.install.failureReason || summary.install.reason || ''}
- 卸载：${summary.uninstall.status}，${summary.uninstall.failureReason || summary.uninstall.reason || ''}

## shared_managed

- 机制测试：${summary.sharedKey?.type || 'not_run'}
- 生产验证：${summary.sharedKey?.production_test?.status || 'not_run'}
- 说明：${summary.sharedKey?.production_test?.reason || ''}

## 安全扫描

- 运行时源码命中：${summary.secretScan.sourceRuntimeHits?.length ?? 0}
- 解包目录命中：${summary.secretScan.packageHits?.length ?? 0}
- 安装包命中：${summary.secretScan.installerHits?.length ?? 0}

## 已知问题

${summary.knownIssues.length ? summary.knownIssues.map((item) => `- ${item}`).join('\n') : '- 无'}

## 命令证据

${summary.commands.map((item) => `- \`${item.command}\` -> exit ${item.exitCode}`).join('\n')}
`;
}

main().catch((error) => {
  const payload = {
    task: 'install-release-preflight',
    status: 'failed',
    error: redact(error.stack || error.message || error)
  };
  writeFileSync(summaryFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  writeFileSync(reportFile, `# Windows 安装包候选版发布前预验收\n\n状态：failed\n\n错误：${payload.error}\n`, 'utf8');
  console.error(payload.error);
  process.exit(1);
});
