<#
================================================================================
  restore.ps1 - go back to an earlier version of the game
================================================================================

WHAT THIS IS FOR
----------------
Every time the game reaches a good, tested state it gets two things:

  * a COMMIT in git (and usually a tag like `checkpoint/optimized`)
  * a ZIP BACKUP in D:\CLI\backups\ (source only, never the AI model files)

This script takes you back to any of them, and it never throws away what you
have now without saving it first.


HOW TO USE IT
-------------
Open PowerShell in the game folder and run one of these.
(If you prefer double-clicking, use `restore.cmd` - it does the same thing.)

  See everything you could go back to:

      .\restore.ps1 -List

  Go back to a named checkpoint:

      .\restore.ps1 -Checkpoint optimized
      .\restore.ps1 -Checkpoint uireviewdone

  Go back to a particular commit (the short id from `-List`):

      .\restore.ps1 -Commit 3aa3fb6

  Go back one commit, or three:

      .\restore.ps1 -Back 1
      .\restore.ps1 -Back 3

  Restore from a zip backup instead of from git
  (use this if git itself is in a mess):

      .\restore.ps1 -Backup optimized

  See what WOULD happen, and change nothing:

      .\restore.ps1 -Checkpoint optimized -DryRun

  Come back to the newest version after looking around:

      .\restore.ps1 -Latest


WHAT IT DOES TO KEEP YOU SAFE
-----------------------------
Before it changes anything, it always:

  1. Stops the game if it is running (so nothing is writing to the folder).
  2. Zips your CURRENT source to D:\CLI\backups\aethertable_safety_<time>.zip
  3. Commits anything uncommitted onto a branch called `safety/<time>`,
     so nothing you have written is ever lost, even work you had not committed.

It will refuse to run if it cannot do those things, unless you pass -Force.

After restoring you are on a DETACHED HEAD (a read-only look at the past).
That is normal and safe. To get back to the newest version:

      .\restore.ps1 -Latest

To keep working from the old version instead, make a branch:

      git switch -c my-new-branch


THE ARGUMENTS, IN FULL
----------------------
  -List                 Show checkpoints, commits and zip backups. Changes nothing.
  -Checkpoint <name>    Restore a named checkpoint, e.g. optimized
  -Commit <id>          Restore a specific commit, e.g. 3aa3fb6
  -Back <n>             Restore the commit n steps before the current one
  -Backup <name>        Restore from a zip backup rather than from git
  -Latest               Return to the newest committed version on main
  -DryRun               Print what would happen; change nothing
  -Force                Skip the "you have uncommitted changes" refusal
  -NoSafety             Skip making the safety backup (not recommended)
  -Start                Start the game again once the restore is done

================================================================================
#>

[CmdletBinding()]
param(
  [switch] $List,
  [string] $Checkpoint,
  [string] $Commit,
  [int]    $Back = 0,
  [string] $Backup,
  [switch] $Latest,
  [switch] $DryRun,
  [switch] $Force,
  [switch] $NoSafety,
  [switch] $Start
)

$ErrorActionPreference = 'Stop'
$Root       = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackupDir  = 'D:\CLI\backups'
$Stamp      = Get-Date -Format 'yyyy-MM-dd_HHmmss'

Set-Location $Root

# ---------------------------------------------------------------- helpers ---

function Say    { param([string]$m) Write-Host "  $m" }
function Head   { param([string]$m) Write-Host ""; Write-Host "  $m" -ForegroundColor Cyan; Write-Host "  $('-' * $m.Length)" -ForegroundColor DarkGray }
function Warn   { param([string]$m) Write-Host "  ! $m" -ForegroundColor Yellow }
function Fail   { param([string]$m) Write-Host "  x $m" -ForegroundColor Red; exit 1 }
function Good   { param([string]$m) Write-Host "  + $m" -ForegroundColor Green }

function InAGitRepo {
  & git rev-parse --git-dir *> $null
  return ($LASTEXITCODE -eq 0)
}

function WorkingTreeIsDirty {
  $s = & git status --porcelain
  return -not [string]::IsNullOrWhiteSpace(($s -join ''))
}

# ------------------------------------------------------------------ list ----

function Show-Everything {
  Head 'Named checkpoints (the tested, known-good points)'
  $tags = & git tag -l 'checkpoint/*' --sort=-creatordate
  if (-not $tags) {
    Say '(none yet)'
  } else {
    foreach ($t in $tags) {
      $short = $t -replace '^checkpoint/', ''
      $info  = & git log -1 --pretty=format:'%h  %ad  %s' --date=short $t
      Say ("{0,-16} {1}" -f $short, $info)
    }
  }

  Head 'Recent commits (newest first)'
  $log = & git log --pretty=format:'%h|%ad|%s' --date=short -20
  $i = 0
  foreach ($line in $log) {
    $p = $line -split '\|', 3
    $marker = if ($i -eq 0) { '->' } else { "  " }
    Say ("{0} {1}  {2}  {3}" -f $marker, $p[0], $p[1], $p[2])
    $i++
  }
  Say ''
  Say 'Use -Back 1 for the one below the arrow, -Back 2 for the next, and so on.'

  Head 'Zip backups (source only - never the AI models)'
  if (-not (Test-Path $BackupDir)) {
    Say "(no backup folder at $BackupDir)"
  } else {
    $zips = Get-ChildItem $BackupDir -Filter 'aethertable_*.zip' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending
    if (-not $zips) { Say '(none yet)' }
    foreach ($z in $zips) {
      $name = $z.BaseName -replace '^aethertable_', ''
      $size = [math]::Round($z.Length / 1MB, 2)
      Say ("{0,-40} {1,6} MB   {2}" -f $name, $size, $z.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))
    }
    Say ''
    Say 'Use -Backup with the part before the date, e.g.  -Backup optimized'
  }

  Head 'Where you are now'
  $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
  $here   = & git log -1 --pretty=format:'%h  %ad  %s' --date=short
  if ($branch -eq 'HEAD') {
    Say "detached at $here"
    Say 'Run  .\restore.ps1 -Latest  to come back to the newest version.'
  } else {
    Say "on branch '$branch' at $here"
  }
  if (WorkingTreeIsDirty) {
    Warn 'You have uncommitted changes. A restore will save them to a safety branch first.'
  }
  Write-Host ''
}

# ------------------------------------------------------------- the safety ---

function Stop-TheGame {
  if ($DryRun) { Say 'would stop the game'; return }
  if (Test-Path (Join-Path $Root 'start.ps1')) {
    try {
      & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'start.ps1') -Stop *> $null
      Say 'stopped the game (and released the AI)'
    } catch {
      Warn 'could not stop the game cleanly; carrying on'
    }
  }
}

function Save-WhatYouHaveNow {
  if ($NoSafety) { Warn 'skipping the safety backup because you asked (-NoSafety)'; return }

  # 1. Anything uncommitted goes onto a branch of its own, so it is recoverable
  #    with ordinary git commands later.
  if (WorkingTreeIsDirty) {
    $branch = "safety/$Stamp"
    if ($DryRun) {
      Say "would commit your uncommitted changes to a branch called $branch"
    } else {
      & git stash push -u -m "restore.ps1 safety $Stamp" *> $null
      if ($LASTEXITCODE -eq 0) {
        & git branch $branch stash@{0} *> $null
        & git stash pop *> $null
        Good "your uncommitted changes are saved on the branch '$branch'"
        Say  "  (see them later with:  git show $branch)"
      } else {
        Warn 'could not stash your changes; the zip backup below is your safety net'
      }
    }
  }

  # 2. A zip of the source as it stands, which does not depend on git at all.
  $dest = Join-Path $BackupDir "aethertable_safety_$Stamp"
  if ($DryRun) { Say "would zip your current source to $dest.zip"; return }

  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  $files = & git ls-files
  foreach ($f in $files) {
    if (-not (Test-Path $f)) { continue }
    $target = Join-Path $dest $f
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    Copy-Item $f $target -Force
  }
  Compress-Archive -Path "$dest\*" -DestinationPath "$dest.zip" -Force
  Remove-Item $dest -Recurse -Force
  Good "your current source is zipped at $dest.zip"
}

# ---------------------------------------------------------------- restore ---

function Restore-Commit {
  param([string] $Ref, [string] $Describe)

  $resolved = & git rev-parse --verify --quiet "$Ref^{commit}"
  if (-not $resolved) { Fail "I cannot find '$Ref'. Run  .\restore.ps1 -List  to see what exists." }

  $what = & git log -1 --pretty=format:'%h  %ad  %s' --date=short $resolved
  Head "Restoring $Describe"
  Say $what

  if ($DryRun) {
    Say ''
    Say 'DRY RUN - nothing was changed.'
    return
  }

  Stop-TheGame
  Save-WhatYouHaveNow

  & git checkout --force $resolved *> $null
  if ($LASTEXITCODE -ne 0) { Fail 'git could not check that out. Nothing was lost - your safety zip is in D:\CLI\backups.' }

  Good "the game folder is now exactly as it was at $($what.Split(' ')[0])"
  Say ''
  Say 'You are on a detached HEAD, which is a safe, read-only look at the past.'
  Say '  To come back to the newest version:   .\restore.ps1 -Latest'
  Say '  To keep working from here instead:    git switch -c my-new-branch'
}

function Restore-Backup {
  param([string] $Name)

  if (-not (Test-Path $BackupDir)) { Fail "There is no backup folder at $BackupDir" }
  $zip = Get-ChildItem $BackupDir -Filter "aethertable_*$Name*.zip" |
         Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $zip) { Fail "No backup matches '$Name'. Run  .\restore.ps1 -List  to see them." }

  Head "Restoring from the zip backup"
  Say $zip.Name
  Say ("taken {0}, {1} MB" -f $zip.LastWriteTime, [math]::Round($zip.Length / 1MB, 2))

  if ($DryRun) {
    Say ''
    Say 'DRY RUN - nothing was changed.'
    return
  }

  Stop-TheGame
  Save-WhatYouHaveNow

  # Unpack beside the game first, so a corrupt zip cannot half-overwrite it.
  $tmp = Join-Path $env:TEMP "aethertable_restore_$Stamp"
  Expand-Archive -Path $zip.FullName -DestinationPath $tmp -Force
  if (-not (Test-Path (Join-Path $tmp 'index.html'))) {
    Remove-Item $tmp -Recurse -Force
    Fail 'That zip does not look like a game backup (no index.html inside). Nothing was changed.'
  }

  Copy-Item (Join-Path $tmp '*') $Root -Recurse -Force
  Remove-Item $tmp -Recurse -Force

  Good 'the game folder now matches that backup'
  Say ''
  Say 'Note: this restored FILES, not git history. Your git branch is unchanged,'
  Say 'so `git status` will show the differences as uncommitted edits.'
}

function Restore-Latest {
  Head 'Returning to the newest version'
  if ($DryRun) { Say 'would switch back to main and pull nothing'; return }

  Stop-TheGame
  Save-WhatYouHaveNow

  & git checkout --force main *> $null
  if ($LASTEXITCODE -ne 0) { Fail "Could not switch back to main." }
  $what = & git log -1 --pretty=format:'%h  %ad  %s' --date=short
  Good "back on main at $what"
}

# ------------------------------------------------------------------- main ---

Write-Host ''
Write-Host '  AETHERTABLE - restore' -ForegroundColor Cyan

if (-not (InAGitRepo)) { Fail "This folder is not a git repository, so only -Backup will work." }

$asked = @($List, $Checkpoint, $Commit, ($Back -gt 0), $Backup, $Latest) |
         Where-Object { $_ -and $_ -ne '' }

if (-not $asked) {
  # No arguments: show the list, which is the most useful thing to do and
  # cannot break anything.
  Show-Everything
  Write-Host '  Run  .\restore.ps1 -List  for this again, or open this file to read the instructions at the top.'
  Write-Host ''
  exit 0
}

if ($List) { Show-Everything; exit 0 }

# A restore is destructive to the working folder, so check before leaping.
if ((WorkingTreeIsDirty) -and -not $Force -and -not $DryRun -and $NoSafety) {
  Fail @'
You have uncommitted changes and you passed -NoSafety, so there would be
nowhere to put them. Either drop -NoSafety (recommended), commit your work,
or pass -Force to throw the changes away.
'@
}

if ($Latest)          { Restore-Latest; }
elseif ($Backup)      { Restore-Backup -Name $Backup }
elseif ($Checkpoint)  { Restore-Commit -Ref "checkpoint/$Checkpoint" -Describe "checkpoint '$Checkpoint'" }
elseif ($Commit)      { Restore-Commit -Ref $Commit -Describe "commit $Commit" }
elseif ($Back -gt 0)  { Restore-Commit -Ref "HEAD~$Back" -Describe "$Back commit(s) back" }

if ($Start -and -not $DryRun) {
  Head 'Starting the game again'
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'start.ps1')
}

Write-Host ''
