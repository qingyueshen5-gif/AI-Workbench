$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$vitePortInUse = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($vitePortInUse) {
  exit 0
}

$command = 'cmd.exe /c "cd /d "' + $root + '" && node scripts/dev-background.mjs"'
$shell = New-Object -ComObject WScript.Shell
$shell.Run($command, 0, $false) | Out-Null
