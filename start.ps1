<#
  AETHERTABLE launcher.

  Adapted from the sibling ACCORD project's launcher, which had already been
  taught the awkward lessons: reuse a healthy server rather than fighting it,
  never kill a process that is not ours, and always reclaim the GPU on the way
  out. Kills are scoped strictly to executables living inside this folder, so a
  system-wide Ollama or an unrelated node process is never touched.
#>
[CmdletBinding()]
param(
  [int]$Port = 8177,
  [string]$Model,
  [switch]$NoBrowser,
  [switch]$Stop,
  [switch]$Clean,
  [switch]$Restart
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Url  = "http://127.0.0.1:$Port/"

function Write-Step($msg)  { Write-Host "  * $msg" -ForegroundColor Cyan }
function Write-Warn($msg)  { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "  x $msg" -ForegroundColor Red }
function Write-Good($msg)  { Write-Host "  + $msg" -ForegroundColor Green }

# Only ever touch processes whose executable lives under this game folder.
function Get-OurProcesses {
  $names = @('ollama', 'llama-server')
  $out = @()
  foreach ($n in $names) {
    Get-Process -Name $n -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        $p = $_.Path
        if ($p -and $p.ToLower().StartsWith($Root.ToLower())) { $out += $_ }
      } catch { }
    }
  }
  $out
}

# A node process is ours if it is running our server.js from our folder, or if
# it owns the port we are about to use.
function Get-OurNodeServers {
  $out = @()
  try {
    $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
      $cmd = $p.CommandLine
      if ($cmd -and $cmd -match 'server\.js' -and $cmd -match [regex]::Escape((Split-Path -Leaf $Root))) {
        $out += $p.ProcessId
      }
    }
  } catch { }
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) { if ($out -notcontains $c.OwningProcess) { $out += $c.OwningProcess } }
  } catch { }
  $out | Where-Object { $_ -and $_ -gt 0 } | Select-Object -Unique
}

function Stop-Tree($processId) {
  if (-not $processId) { return }
  try { & taskkill /PID $processId /T /F 2>&1 | Out-Null } catch { }
}

function Remove-Leftovers {
  $killed = 0
  foreach ($p in Get-OurProcesses) { Stop-Tree $p.Id; $killed++ }
  foreach ($processId in Get-OurNodeServers) { Stop-Tree $processId; $killed++ }
  if ($killed) { Write-Step "cleared $killed leftover process(es)" }
}

function Get-FreeVramMiB {
  try {
    $out = & nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>$null
    if ($out) { return [int](($out -split "`n")[0].Trim()) }
  } catch { }
  return $null
}

function Wait-ForUrl($target, $timeoutSec) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $target -TimeoutSec 3 -UseBasicParsing
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
    } catch { }
    Start-Sleep -Milliseconds 700
  }
  return $false
}

function Get-Status {
  try {
    return Invoke-RestMethod -Uri "$Url`api/status" -TimeoutSec 5
  } catch { return $null }
}

Write-Host ''
Write-Host '  AETHERTABLE' -ForegroundColor Magenta
Write-Host '  a 2D D&D simulator with a local-AI Dungeon Master' -ForegroundColor DarkGray
Write-Host ''

if ($Stop -or $Clean) {
  Write-Step 'shutting down...'
  Remove-Leftovers
  Write-Good 'stopped. GPU memory reclaimed.'
  exit 0
}

# An already-healthy server is reused rather than restarted: a needless restart
# costs a full model reload, and two launcher windows would otherwise kill each
# other's server in turn.
if (-not $Restart) {
  $existing = Get-Status
  if ($existing -and $existing.ok) {
    Write-Good "a server is already running on port $Port - reusing it"
    if ($existing.loaded) { Write-Step "model loaded: $($existing.loaded)" }
    if (-not $NoBrowser) { Start-Process $Url }
    exit 0
  }
}

# Preflight.
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Err 'node is not on PATH. Install Node.js (https://nodejs.org) and try again.'
  exit 1
}
if (-not (Test-Path (Join-Path $Root 'server.js'))) {
  Write-Err "server.js not found in $Root"
  exit 1
}

# The AI runtime may live here or in a sibling game; the server resolves that
# itself, so only report what we can see.
$aiLocal   = Join-Path $Root 'ai\ollama\ollama.exe'
$aiSibling = Join-Path (Split-Path -Parent $Root) 'NegotiatorGame\ai\ollama\ollama.exe'
if (Test-Path $aiLocal) {
  Write-Step 'local AI runtime found'
} elseif (Test-Path $aiSibling) {
  Write-Step 'using the AI runtime already installed alongside this game'
} else {
  Write-Warn 'no local AI runtime found - the Offline Dungeon Master will narrate.'
  Write-Warn 'run install-ai.cmd for a local model, or choose a Copilot model in the game.'
}

Remove-Leftovers

$vram = Get-FreeVramMiB
if ($vram -ne $null) {
  if ($vram -gt 5000)    { Write-Step "$vram MiB GPU free - plenty of room" }
  elseif ($vram -gt 2600) { Write-Warn "$vram MiB GPU free - a smaller model may be chosen" }
  else                    { Write-Warn "$vram MiB GPU free - another program is using the card; the DM will be slow until it is freed" }
}

$env:PORT = "$Port"
if ($Model) {
  $env:DND_MODEL = $Model
  Write-Step "model pinned to $Model (automatic step-down disabled)"
}

Write-Step 'starting server...'
$server = Start-Process node -ArgumentList 'server.js' -WorkingDirectory $Root -NoNewWindow -PassThru

try {
  if (-not (Wait-ForUrl $Url 60)) {
    Write-Err "the server did not come up on port $Port."
    Write-Err "another program may be using it - try:  .\start.ps1 -Port 9000"
    exit 1
  }
  Write-Good "running at $Url"

  # Never block play on the model. The game is fully playable without it.
  $deadline = (Get-Date).AddSeconds(75)
  $reported = $false
  while ((Get-Date) -lt $deadline) {
    $s = Get-Status
    if ($s -and $s.ollama) {
      if ($s.loaded)    { Write-Good "Dungeon Master ready: $($s.loaded)" }
      elseif ($s.recommended) { Write-Step "loading $($s.recommended)..." }
      if ($s.measured -and $s.measured.tokPerSec) {
        Write-Step "$($s.measured.tokPerSec) tok/s measured"
      }
      if ($s.hint) { Write-Warn $s.hint }
      $reported = $true
      break
    }
    Start-Sleep -Milliseconds 900
  }
  if (-not $reported) {
    Write-Warn 'the local model is not available yet - the game is still fully playable.'
    Write-Warn 'the Offline Dungeon Master will narrate, or pick a Copilot model in the game.'
  }

  if (-not $NoBrowser) { Start-Process $Url }

  Write-Host ''
  Write-Host '  Press Ctrl+C to stop.' -ForegroundColor DarkGray
  Write-Host ''
  while ($true) {
    Start-Sleep -Seconds 1
    if ($server.HasExited) { break }
  }
} finally {
  # Always tear the tree down. A leaked model runner holds GPU memory for ever.
  if ($server -and -not $server.HasExited) { Stop-Tree $server.Id }
  Remove-Leftovers
  Write-Host ''
  Write-Good 'stopped. GPU memory reclaimed.'
}
