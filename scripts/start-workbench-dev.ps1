$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$watchdogScript = Join-Path $root 'scripts\ai-workbench-watchdog.ps1'
$command = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $watchdogScript + '"'
$shell = New-Object -ComObject WScript.Shell
$shell.Run($command, 0, $false) | Out-Null
