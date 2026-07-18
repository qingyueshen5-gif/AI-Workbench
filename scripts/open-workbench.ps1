$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$url = 'http://127.0.0.1:5173'
$node = 'node.exe'
$devScript = Join-Path $root 'scripts\dev-background.mjs'

function Test-LocalPort([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $connect = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $connect.AsyncWaitHandle.WaitOne(350, $false)
    if ($ok) { $client.EndConnect($connect) }
    $client.Close()
    return $ok
  } catch {
    return $false
  }
}

if (-not (Test-LocalPort 5173)) {
  Start-Process -FilePath $node -ArgumentList "`"$devScript`"" -WorkingDirectory $root -WindowStyle Hidden | Out-Null
}

for ($i = 0; $i -lt 40; $i++) {
  if (Test-LocalPort 5173) { break }
  Start-Sleep -Milliseconds 500
}

Start-Process $url | Out-Null
