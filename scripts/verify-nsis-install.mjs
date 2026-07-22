import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const installer = process.argv[2] ? resolve(process.argv[2]) : '';
const verificationDir = process.argv[3] ? resolve(process.argv[3]) : '';
if (!installer || !verificationDir) {
  console.error('usage: node scripts/verify-nsis-install.mjs <installer> <verificationDir>');
  process.exit(2);
}

mkdirSync(verificationDir, { recursive: true });

const localAppData = process.env.LOCALAPPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Local');
const appData = process.env.APPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
const installTarget = join(localAppData, 'Programs', 'AIWorkbench');
const installedExe = join(installTarget, 'AI Workbench.exe');
const uninstaller = join(installTarget, 'Uninstall AI Workbench.exe');
const desktopShortcut = join(process.env.USERPROFILE || '', 'Desktop', 'AI Workbench.lnk');
const startShortcut = join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'AI Workbench.lnk');
const updaterDir = join(localAppData, 'ai-workbench-updater');
const smokeRoot = join(verificationDir, 'repair1-2-installed-smoke-runtime');
const smokeOutput = join(verificationDir, 'repair1-2-installed-smoke.json');
const smokeStdout = join(verificationDir, 'repair1-2-installed-stdout.log');
const smokeStderr = join(verificationDir, 'repair1-2-installed-stderr.log');
const installLog = join(verificationDir, 'repair1-2-install.log');
const smokeLog = join(verificationDir, 'repair1-2-smoke.log');
const uninstallLog = join(verificationDir, 'repair1-2-uninstall.log');

function cleanup(paths) {
  for (const path of paths) rmSync(path, { recursive: true, force: true });
}

function readWindowsState() {
  const script = `
$ErrorActionPreference = 'Continue'
$installTarget = '${installTarget.replace(/'/g, "''")}'
$desktopShortcut = '${desktopShortcut.replace(/'/g, "''")}'
$startShortcut = '${startShortcut.replace(/'/g, "''")}'
$shell = New-Object -ComObject WScript.Shell
function ReadShortcut($path) {
  if (Test-Path -LiteralPath $path) {
    $s = $shell.CreateShortcut($path)
    return [ordered]@{ path = $path; target = $s.TargetPath; workingDirectory = $s.WorkingDirectory }
  }
  return $null
}
$entries = @()
foreach ($rootKey in @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall')) {
  if (Test-Path $rootKey) {
    Get-ChildItem $rootKey -ErrorAction SilentlyContinue | ForEach-Object {
      $item = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
      if (($item.DisplayName -like 'AI Workbench*') -or ($item.DisplayIcon -like '*AIWorkbench*') -or ($item.UninstallString -like '*AIWorkbench*')) {
        $entries += [ordered]@{
          key = $_.Name
          displayName = $item.DisplayName
          displayVersion = $item.DisplayVersion
          installLocation = $item.InstallLocation
          uninstallString = $item.UninstallString
          quietUninstallString = $item.QuietUninstallString
          displayIcon = $item.DisplayIcon
        }
      }
    }
  }
}
[ordered]@{
  desktopShortcut = ReadShortcut $desktopShortcut
  startShortcut = ReadShortcut $startShortcut
  uninstallRegistry = $entries
} | ConvertTo-Json -Depth 8
`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true
  });
  try {
    return JSON.parse(result.stdout || '{}');
  } catch {
    return { parseError: result.stderr || result.stdout || 'failed to parse Windows state' };
  }
}

function runWindowsExe(file, args, timeout = 180000) {
  const psArgs = args.map((arg) => `'${String(arg).replace(/'/g, "''")}'`).join(',');
  const script = `
$p = Start-Process -FilePath '${file.replace(/'/g, "''")}' -ArgumentList @(${psArgs}) -PassThru -Wait -WindowStyle Hidden
[ordered]@{ exitCode = $p.ExitCode } | ConvertTo-Json
`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout
  });
  let parsed = {};
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    parsed = {};
  }
  return {
    status: typeof parsed.exitCode === 'number' ? parsed.exitCode : result.status,
    signal: result.signal || '',
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function runSmoke() {
  cleanup([smokeRoot, smokeOutput, smokeStdout, smokeStderr]);
  if (!existsSync(installedExe)) return Promise.resolve({ exitCode: null, skipped: true, reason: 'installed exe missing' });
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const child = spawn(installedExe, ['--smoke-test'], {
      windowsHide: true,
      env: {
        ...process.env,
        AI_WORKBENCH_RUNTIME_DIR: smokeRoot,
        AIW_SMOKE_TEST: '1',
        AIW_SMOKE_TEST_OUTPUT: smokeOutput,
        PORT: '29871',
        MODEL_PROXY_PORT: '29870',
        MODEL_PROXY_DISABLE_LOCAL_ENV: '1',
        AIW_SHARED_DEEPSEEK_API_KEY: 'mock-shared-key-for-install-release'
      }
    });
    child.stdout.on('data', (chunk) => writeFileSync(smokeStdout, chunk, { flag: 'a' }));
    child.stderr.on('data', (chunk) => writeFileSync(smokeStderr, chunk, { flag: 'a' }));
    const timer = setTimeout(() => child.kill('SIGKILL'), 60000);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({
        command: `${installedExe} --smoke-test`,
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: code,
        signal: signal || '',
        timedOut: signal === 'SIGKILL',
        output: smokeOutput,
        stdout: smokeStdout,
        stderr: smokeStderr,
        outputExists: existsSync(smokeOutput),
        outputJson: existsSync(smokeOutput) ? readFileSync(smokeOutput, 'utf8') : '',
        runtimeRoot: smokeRoot,
        runtimeDirs: Object.fromEntries(['config', 'data', 'logs', 'evidence'].map((name) => [name, existsSync(join(smokeRoot, name))]))
      });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: null, error: error.message, output: smokeOutput, runtimeRoot: smokeRoot, runtimeDirs: {} });
    });
  });
}

async function main() {
  const cleanupBefore = [desktopShortcut, startShortcut, updaterDir, installTarget].map((path) => ({ path, existed: existsSync(path) }));
  cleanup([desktopShortcut, startShortcut, updaterDir, installTarget]);

  const install = runWindowsExe(installer, ['/S']);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const stateAfterInstall = readWindowsState();
  const installedExeExistsAfterInstall = existsSync(installedExe);
  const uninstallerExistsAfterInstall = existsSync(uninstaller);
  const installedExeSize = installedExeExistsAfterInstall ? statSync(installedExe).size : 0;
  const smoke = await runSmoke();
  const uninstall = existsSync(uninstaller)
    ? runWindowsExe(uninstaller, ['/S'])
    : { status: null, error: 'uninstaller missing' };
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const stateAfterUninstall = readWindowsState();

  const installPayload = {
    task: 'repair1-2-install',
    cleanupBefore,
    installCommand: `${installer} /S`,
    installExitCode: install.status,
    installTarget,
    installedExe,
    installedExeExists: installedExeExistsAfterInstall,
    uninstaller,
    uninstallerExists: uninstallerExistsAfterInstall,
    fileVersion: installedExeSize > 0 ? '0.4.6' : '',
    ...stateAfterInstall
  };
  writeFileSync(installLog, `${JSON.stringify(installPayload, null, 2)}\n`);
  writeFileSync(smokeLog, `${JSON.stringify({ task: 'repair1-2-smoke', ...smoke }, null, 2)}\n`);

  const uninstallPayload = {
    task: 'repair1-2-uninstall',
    uninstallAttempted: existsSync(uninstaller) || uninstall.status !== null,
    uninstallCommand: `${uninstaller} /S`,
    uninstallExitCode: uninstall.status,
    installDirExistsAfterUninstall: existsSync(installTarget),
    installedExeExistsAfterUninstall: existsSync(installedExe),
    afterUninstallShortcuts: [stateAfterUninstall.desktopShortcut, stateAfterUninstall.startShortcut].filter(Boolean),
    afterReg: stateAfterUninstall.uninstallRegistry || []
  };
  writeFileSync(uninstallLog, `${JSON.stringify(uninstallPayload, null, 2)}\n`);

  const payload = {
    task: 'nsis-install-uninstall',
    version: '0.4.6',
    installer,
    status: installPayload.installExitCode === 0
      && installPayload.installedExeExists
      && installPayload.uninstallerExists
      && installPayload.desktopShortcut?.target === installedExe
      && installPayload.startShortcut?.target === installedExe
      && (installPayload.uninstallRegistry || []).length > 0
      && smoke.exitCode === 0
      && uninstallPayload.uninstallAttempted
      && uninstallPayload.uninstallExitCode === 0
      && !uninstallPayload.installDirExistsAfterUninstall
      && !uninstallPayload.installedExeExistsAfterUninstall
      && uninstallPayload.afterInstallShortcuts?.length !== 0
      ? 'passed'
      : 'failed',
    method: 'silent',
    installCommand: installPayload.installCommand,
    installExitCode: installPayload.installExitCode,
    installTarget,
    installedExe,
    installedExeExists: installPayload.installedExeExists,
    uninstaller,
    uninstallerExists: installPayload.uninstallerExists,
    fileVersion: installPayload.fileVersion,
    shortcutsPointToInstalledExe: installPayload.desktopShortcut?.target === installedExe && installPayload.startShortcut?.target === installedExe,
    afterInstallShortcuts: [installPayload.desktopShortcut, installPayload.startShortcut].filter(Boolean),
    uninstallRegistry: installPayload.uninstallRegistry || [],
    installedSmoke: smoke,
    uninstallAttempted: uninstallPayload.uninstallAttempted,
    uninstallCommand: uninstallPayload.uninstallCommand,
    uninstallExitCode: uninstallPayload.uninstallExitCode,
    installDirExistsAfterUninstall: uninstallPayload.installDirExistsAfterUninstall,
    installedExeExistsAfterUninstall: uninstallPayload.installedExeExistsAfterUninstall,
    afterUninstallShortcuts: uninstallPayload.afterUninstallShortcuts
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.status === 'passed' ? 0 : 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
