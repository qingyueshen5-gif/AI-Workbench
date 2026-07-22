# Windows 安装包候选版发布前预验收

生成时间：2026-07-22T10:25:34.860Z

## 总状态

- 状态：failed
- 版本：0.4.6
- 安装包：release-v0.4.6-installer/AI-Workbench-Setup-v0.4.6-x64.exe
- 大小：111605900
- SHA256：7aef266db879f5f912b5eb806cd85347690ab033201736e39f59541c8617accd

## 五条硬验收

| 标准 | 状态 |
| --- | --- |
| a. 无硬编码开发机路径 | passed |
| b. 首次运行自建目录 | failed |
| c. 依赖缺失不崩并给中文说明 | passed |
| d. 端口冲突有兜底 | passed |
| e. 就绪报告完整 | passed |

## 安装与卸载

- 安装：failed，
- 卸载：failed，Uninstall was not attempted because expected uninstaller was not created.

## shared_managed

- 机制测试：installed_smoke
- 生产验证：blocked
- 说明：3A-R1 does not implement production shared key injection; smoke validates installed app mechanics only.

## 安全扫描

- 运行时源码命中：6
- 解包目录命中：0
- 安装包命中：0

## GitHub Actions

- 状态：failed
- Run ID：29912255523
- 日志读取：failed，`gh run view 29912255523 --log-failed` 返回 HTTP 403，提示需要仓库 admin 权限。

## 已知问题

- shared_managed production injection is not verified in 3A; mechanism test used mock upstream only.
- NSIS silent install did not create the expected per-user installed exe/uninstaller.
- Uninstall verification did not pass.
- Installed shortcuts did not point to the discovered installed executable.
- Packaged Electron smoke test did not complete successfully.

## 命令证据

- `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command
$ErrorActionPreference = 'Continue'
$installer = 'F:\AI-Workbench\release-v0.4.6-installer\AI-Workbench-Setup-v0.4.6-x64.exe'
$backup = 'F:\AI-Workbench\.tmp-install-r1\31748-1784715834201\shortcut-backup'
$smokeRoot = 'F:\AI-Workbench\.tmp-install-r1\31748-1784715834201\smoke'
$nsisLog = Join-Path $smokeRoot 'nsis-installer.log'
$updaterInstaller = Join-Path $env:LOCALAPPDATA 'ai-workbench-updater\installer.exe'
$desktop = [Environment]::GetFolderPath('Desktop')
$desktopShortcut = Join-Path $desktop 'AI Workbench.lnk'
$startMenuShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\AI Workbench.lnk'
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
$install = Start-Process -FilePath $installer -ArgumentList @('/S', '/currentuser', '/LOG=' + $nsisLog) -PassThru -Wait -WindowStyle Hidden
Start-Sleep -Seconds 3
$uninstallRegistry = @()
foreach ($rootKey in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')) {
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
$candidateExePaths += (Join-Path $env:LOCALAPPDATA 'Programs\AI Workbench\AI Workbench.exe')
$candidateExePaths += (Join-Path $env:LOCALAPPDATA 'AI Workbench\AI Workbench.exe')
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
    $candidateUninstallers += (($entry.uninstallString -replace '^"', '') -replace '"\s.*$', '')
  }
  if ($entry.quietUninstallString) {
    $candidateUninstallers += (($entry.quietUninstallString -replace '^"', '') -replace '"\s.*$', '')
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
  installCommand = "$installer /S /currentuser"
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
` -> exit 0
- `C:\Program Files\nodejs\node.exe F:\AI-Workbench\model-proxy.mjs` -> exit 0
- `git ls-files` -> exit 0
