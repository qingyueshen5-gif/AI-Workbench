$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$WatchdogScript = Join-Path $Root 'scripts\ai-workbench-watchdog.ps1'
$TaskName = 'AI Workbench Watchdog'
$StartupTaskName = 'AI Workbench Startup Recovery'
$Description = 'Keeps AI Workbench local services available.'
$UserId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path -LiteralPath $WatchdogScript)) {
  throw "Watchdog script not found: $WatchdogScript"
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $WatchdogScript) `
  -WorkingDirectory $Root

$intervalTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
  -RepetitionInterval (New-TimeSpan -Minutes 2) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$startupTrigger = New-ScheduledTaskTrigger -AtLogOn -User $UserId
$startupTrigger.Delay = 'PT20S'

$settings = New-ScheduledTaskSettingsSet `
  -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

$principal = New-ScheduledTaskPrincipal -UserId $UserId -LogonType Interactive -RunLevel Limited

foreach ($name in @($TaskName, $StartupTaskName)) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
}

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $intervalTrigger `
  -Settings $settings `
  -Principal $principal `
  -Description $Description | Out-Null

Register-ScheduledTask `
  -TaskName $StartupTaskName `
  -Action $action `
  -Trigger $startupTrigger `
  -Settings $settings `
  -Principal $principal `
  -Description "$Description Runs once after user logon with a 20 second delay." | Out-Null

Write-Output "Registered scheduled tasks:"
Get-ScheduledTask -TaskName $TaskName, $StartupTaskName |
  Select-Object TaskName, State, TaskPath |
  Format-Table -AutoSize
