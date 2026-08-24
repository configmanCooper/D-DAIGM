<#
  install-ai.ps1 — fetch the local Dungeon Master.

  The game is fully playable without any of this: the Offline narrator is
  deterministic and instant, and GitHub Copilot models work over the network.
  What this installs is the *local* Dungeon Master — a model that runs on this
  machine, costs nothing per turn, and needs no internet once it is here.

  None of it is committed to the repository. The runtime and its weights are
  several gigabytes, which is exactly the kind of thing that has no business in
  git, so this script fetches them on a machine that needs them.

  It is deliberately conservative:
    * If a sibling game already has the runtime, that copy is used rather than
      downloading a second several-gigabyte duplicate.
    * Otherwise everything lands under this game's own `ai\` folder — never in
      Program Files, never on PATH — so uninstalling is deleting a folder.
    * A model already present is not downloaded again.
    * The server it starts in order to pull models is stopped again afterwards.
      An installer that quietly leaves 3 GB resident on your card is a bad
      installer.

  Usage:
      .\install-ai.ps1                  the best model this GPU has room for
      .\install-ai.ps1 -Model qwen3.5:4b
      .\install-ai.ps1 -All             every model the game knows about
      .\install-ai.ps1 -Force           install here even if a sibling has it
      .\install-ai.ps1 -List            show what is installed, change nothing
#>
[CmdletBinding()]
param(
  [string]$Model,
  [switch]$All,
  [switch]$Force,
  [switch]$List
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Write-Step($m) { Write-Host "  * $m" -ForegroundColor Cyan }
function Write-Warn($m) { Write-Host "  ! $m" -ForegroundColor Yellow }
function Write-Err($m)  { Write-Host "  x $m" -ForegroundColor Red }
function Write-Good($m) { Write-Host "  + $m" -ForegroundColor Green }

# Kept in step with server.js. The order is a preference order — best writer
# first — not a speed ranking, and the VRAM figures are what each model
# actually costs resident at our default context.
$MODELS = [ordered]@{
  'qwen3:1.7b'  = @{ vram = 1700; note = 'small and quick; a good first choice' }
  'llama3.2:3b' = @{ vram = 2400; note = 'a steadier writer' }
  'qwen3.5:4b'  = @{ vram = 3500; note = 'the best of the three, if the card has room' }
}
$BROWSER_RESERVE_MIB = 900

Write-Host ''
Write-Host '  AETHERTABLE - local Dungeon Master installer' -ForegroundColor Magenta
Write-Host ''

# ---------------------------------------------------------------- where ----

function Get-SiblingAi {
  $sib = Join-Path (Split-Path -Parent $Root) 'NegotiatorGame\ai'
  if (Test-Path (Join-Path $sib 'ollama\ollama.exe')) { return $sib }
  return $null
}

$LocalAi   = Join-Path $Root 'ai'
$SiblingAi = Get-SiblingAi
$AiDir     = $LocalAi

if ($SiblingAi -and -not $Force -and -not (Test-Path (Join-Path $LocalAi 'ollama\ollama.exe'))) {
  Write-Good "an AI runtime is already installed at $SiblingAi"
  Write-Step 'the game finds it automatically - no second copy is needed'
  Write-Step 'to install a separate copy here anyway, re-run with -Force'
  $AiDir = $SiblingAi
}

$OllamaExe = Join-Path $AiDir 'ollama\ollama.exe'
$ModelsDir = Join-Path $AiDir 'models'

# ------------------------------------------------------------- runtime ----

function Install-Runtime {
  if (Test-Path $OllamaExe) { Write-Step 'runtime already present'; return }

  Write-Step 'downloading the Ollama runtime (about 700 MB)...'
  $tmp = Join-Path $env:TEMP ('aethertable-ollama-' + [guid]::NewGuid().ToString('N') + '.zip')
  $url = 'https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip'
  try {
    # A progress bar makes Invoke-WebRequest roughly an order of magnitude
    # slower on large files. On 700 MB that is minutes thrown away.
    $prev = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    try { Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing }
    finally { $ProgressPreference = $prev }
  } catch {
    Write-Err "could not download the runtime: $($_.Exception.Message)"
    Write-Err 'check the network, or install Ollama yourself from https://ollama.com'
    exit 1
  }

  Write-Step 'unpacking...'
  $dest = Join-Path $AiDir 'ollama'
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  try { Expand-Archive -Path $tmp -DestinationPath $dest -Force }
  finally { Remove-Item $tmp -ErrorAction SilentlyContinue }

  if (-not (Test-Path $OllamaExe)) {
    # Some releases nest the payload one directory down.
    $found = Get-ChildItem $dest -Recurse -Filter 'ollama.exe' -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($found) {
      Copy-Item (Join-Path $found.Directory.FullName '*') $dest -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  if (-not (Test-Path $OllamaExe)) {
    Write-Err "the archive unpacked but ollama.exe is not where it was expected:"
    Write-Err "  $OllamaExe"
    exit 1
  }
  Write-Good 'runtime installed'
}

# -------------------------------------------------------------- models ----

$script:Server = $null

function Start-OllamaServer {
  if ($script:Server) { return }
  New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null
  $env:OLLAMA_MODELS = $ModelsDir
  $env:OLLAMA_HOST = '127.0.0.1:11434'
  # A pull needs a server; it does not need anything resident afterwards.
  $env:OLLAMA_KEEP_ALIVE = '0'
  Write-Step 'starting the model server...'
  $script:Server = Start-Process $OllamaExe -ArgumentList 'serve' -PassThru -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 -UseBasicParsing | Out-Null
      return
    } catch { Start-Sleep -Milliseconds 700 }
  }
  Write-Warn 'the model server was slow to answer; continuing anyway'
}

function Stop-OllamaServer {
  if ($script:Server) {
    try { & taskkill /PID $script:Server.Id /T /F 2>&1 | Out-Null } catch { }
    $script:Server = $null
  }
}

function Get-Installed {
  $env:OLLAMA_MODELS = $ModelsDir
  # `ollama list` needs a running server, and the most useful moment to ask
  # "what do I have?" is when nothing is running at all. So read the manifest
  # tree directly, and only fall back to the command if that finds nothing.
  $names = @()
  $manifests = Join-Path $ModelsDir 'manifests'
  if (Test-Path $manifests) {
    # .../manifests/<registry>/<namespace>/<model>/<tag>  ->  model:tag
    Get-ChildItem $manifests -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
      $model = $_.Directory.Name
      $tag = $_.Name
      if ($model -and $tag) { $names += "$model`:$tag" }
    }
  }
  if ($names.Count) { return @($names | Sort-Object -Unique) }

  try {
    $out = & $OllamaExe list 2>$null
    if (-not $out) { return @() }
    return @($out | Select-Object -Skip 1 |
      ForEach-Object { ($_ -split '\s+')[0] } |
      Where-Object { $_ })
  } catch { return @() }
}

function Get-FreeVramMiB {
  try {
    $out = & nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>$null
    if ($out) { return [int](($out -split "`n")[0].Trim()) }
  } catch { }
  return $null
}

function Select-BestModel {
  $vram = Get-FreeVramMiB
  if ($null -eq $vram) {
    Write-Step 'no NVIDIA GPU detected - choosing the smallest model'
    Write-Step 'it will run on the CPU: slower, but it works'
    return 'qwen3:1.7b'
  }
  $usable = $vram - $BROWSER_RESERVE_MIB
  Write-Step "$vram MiB GPU free (reserving $BROWSER_RESERVE_MIB MiB for the browser)"
  foreach ($name in @('qwen3.5:4b', 'llama3.2:3b', 'qwen3:1.7b')) {
    if ($usable -ge $MODELS[$name].vram) { return $name }
  }
  Write-Warn 'the card is busy right now; installing the smallest model'
  Write-Warn 'a bigger one can be added later with -Model, once the card is free'
  return 'qwen3:1.7b'
}

function Install-Model($name) {
  if ((Get-Installed) -contains $name) {
    Write-Good "$name is already installed"
    return
  }
  Write-Step "pulling $name (this is the slow part)..."
  & $OllamaExe pull $name
  if ($LASTEXITCODE -ne 0) { Write-Err "could not pull $name"; return }
  Write-Good "$name installed"
}

# ----------------------------------------------------------------- run ----

try {
  if ($List) {
    if (-not (Test-Path $OllamaExe)) {
      Write-Warn 'no runtime installed yet - run this script with no arguments'
      exit 0
    }
    Write-Step "runtime: $OllamaExe"
    Write-Step "models:  $ModelsDir"
    $installed = Get-Installed
    if (-not $installed.Count) { Write-Warn 'no models installed' }
    else { $installed | ForEach-Object { Write-Good $_ } }
    exit 0
  }

  Install-Runtime
  Start-OllamaServer

  if ($All) {
    foreach ($name in $MODELS.Keys) { Install-Model $name }
  } else {
    $want = if ($Model) { $Model } else { Select-BestModel }
    if (-not $Model -and $MODELS.Contains($want)) {
      Write-Step "choosing $want - $($MODELS[$want].note)"
    }
    Install-Model $want
  }

  Write-Host ''
  Write-Good 'done. Run start.cmd and the local Dungeon Master will be offered.'
  Write-Host ''
} finally {
  Stop-OllamaServer
}
