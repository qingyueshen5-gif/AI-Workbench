$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RuntimeRoot = if ($env:AI_WORKBENCH_RUNTIME_DIR) { $env:AI_WORKBENCH_RUNTIME_DIR } else { Join-Path $env:APPDATA 'ai-workbench' }
$LogsDir = Join-Path $RuntimeRoot 'logs'
$LockFile = Join-Path $RuntimeRoot 'watchdog.lock'
$WatchdogLog = Join-Path $LogsDir 'watchdog.log'
$ServiceOutDir = $LogsDir

New-Item -ItemType Directory -Force -Path $RuntimeRoot, $LogsDir | Out-Null

function Write-WatchdogLog([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date).ToString('s'), $Message
  Add-Content -LiteralPath $WatchdogLog -Value $line -Encoding UTF8
}

function Acquire-Lock {
  if (Test-Path -LiteralPath $LockFile) {
    $age = (Get-Date) - (Get-Item -LiteralPath $LockFile).LastWriteTime
    if ($age.TotalMinutes -gt 5) {
      Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue
      Write-WatchdogLog "Removed stale lock older than 5 minutes."
    }
  }
  try {
    $stream = [System.IO.File]::Open($LockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(("pid={0}; time={1}" -f $PID, (Get-Date).ToString('o')))
    $stream.Write($bytes, 0, $bytes.Length)
    return $stream
  } catch {
    Write-WatchdogLog "Another watchdog instance is running; skip this check."
    return $null
  }
}

function Release-Lock($Stream) {
  if ($Stream) {
    $Stream.Close()
    Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue
  }
}

function Test-HttpEndpoint([string]$Url) {
  try {
    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = 'GET'
    $request.Timeout = 1200
    $request.ReadWriteTimeout = 1200
    $response = $request.GetResponse()
    $status = [int]$response.StatusCode
    $response.Close()
    return ($status -ge 200 -and $status -lt 500)
  } catch {
    return $false
  }
}

function Start-WorkbenchProcess([string]$Name, [string[]]$ProcessArgs) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $stdout = Join-Path $ServiceOutDir ("{0}-{1}.out.log" -f $Name, $stamp)
  $stderr = Join-Path $ServiceOutDir ("{0}-{1}.err.log" -f $Name, $stamp)
  Start-Process -FilePath 'node.exe' `
    -ArgumentList $ProcessArgs `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr | Out-Null
  Write-WatchdogLog ("Started {0}: node {1}" -f $Name, ($ProcessArgs -join ' '))
}

function Ensure-Service([string]$Name, [string]$Url, [string[]]$ProcessArgs) {
  if (Test-HttpEndpoint $Url) {
    Write-WatchdogLog ("OK {0} {1}" -f $Name, $Url)
    return
  }
  Write-WatchdogLog ("DOWN {0} {1}; starting." -f $Name, $Url)
  Start-WorkbenchProcess $Name $ProcessArgs
}

$lock = Acquire-Lock
if (-not $lock) { exit 0 }

try {
  $viteCli = Join-Path $Root 'node_modules\vite\bin\vite.js'
  Ensure-Service 'model-proxy' 'http://127.0.0.1:18800/health' @('model-proxy.mjs')
  Ensure-Service 'api' 'http://127.0.0.1:8787/api/data' @('server.mjs')
  Ensure-Service 'frontend' 'http://127.0.0.1:5173/' @($viteCli, '--host', '127.0.0.1')
  Write-WatchdogLog 'Watchdog check complete.'
} catch {
  Write-WatchdogLog ("ERROR {0}" -f $_.Exception.Message)
  exit 1
} finally {
  Release-Lock $lock
}
