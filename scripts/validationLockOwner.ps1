<#
.SYNOPSIS
Lock ownership for withValidationLock.ps1: who owns a lock, whether that owner is still alive, and the
atomic take-or-reclaim of one lock file. Dot-source it; it runs nothing itself.

.DESCRIPTION
A lock file reads "<name> pid <pid> start <unix seconds> since <time>". An owner is the pid plus its
process start time, so a pid the OS has reused for another process does not keep a dead owner's lock alive.
A lock is reclaimed only when its owner process is gone or its pid now has a different start time. Locks and
tickets without a start time (older runners, tickets) are judged by pid alone. A lock whose content cannot
be read is never reclaimed.
#>

function Get-OwnerStartSeconds([int] $ProcessId) {
  try {
    ([DateTimeOffset] (Get-Process -Id $ProcessId -ErrorAction Stop).StartTime).ToUnixTimeSeconds()
  } catch {
    $null
  }
}

# $StartSeconds = $null judges by pid alone. A process that exists but whose start time cannot be read
# counts as alive: never take a lock on a guess.
function Test-OwnerAlive([int] $ProcessId, $StartSeconds = $null) {
  if ($null -eq (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) { return $false }
  $actual = Get-OwnerStartSeconds $ProcessId
  return $null -eq $StartSeconds -or $null -eq $actual -or [Math]::Abs($actual - [long] $StartSeconds) -le 1
}

function Format-LockOwner([string] $Name, [int] $ProcessId = $PID) {
  "$Name pid $ProcessId start $(Get-OwnerStartSeconds $ProcessId) since $(Get-Date -Format s)"
}

function Test-LockOwnerGone([string] $Content) {
  if ($Content -notmatch '\bpid (\d+)') { return $false }
  $ownerPid = [int] $Matches[1]
  $start = if ($Content -match '\bstart (\d+)') { [long] $Matches[1] } else { $null }
  -not (Test-OwnerAlive $ownerPid $start)
}

# Takes the lock at $Path for this process; $false when a live owner holds it or another waiter won the race.
# The lock appears whole in one move (content written first), so no waiter sees a half-written lock.
# A dead owner's lock is moved aside first, so exactly one waiter reclaims it; the moved-aside file is
# checked again before it is dropped, and put back if a live lock was swapped in meanwhile.
function Enter-ValidationLock([string] $Path, [string] $Name) {
  $staged = "$Path.$PID.tmp"
  Set-Content -LiteralPath $staged -Value (Format-LockOwner $Name)
  try {
    try { [IO.File]::Move($staged, $Path); return $true } catch [IO.IOException] {}
    $content = Get-Content -Raw -LiteralPath $Path -ErrorAction SilentlyContinue
    if (-not $content -or -not (Test-LockOwnerGone $content)) { return $false }
    $aside = "$Path.reclaimed-$PID"
    try { [IO.File]::Move($Path, $aside) } catch { return $false }
    $moved = Get-Content -Raw -LiteralPath $aside
    if (-not (Test-LockOwnerGone $moved)) {
      try { [IO.File]::Move($aside, $Path) } catch { Remove-Item -LiteralPath $aside -ErrorAction SilentlyContinue }
      return $false
    }
    Remove-Item -LiteralPath $aside -ErrorAction SilentlyContinue
    Write-Host "$Name reclaimed $Path from a dead owner: $($moved.Trim())"
    try { [IO.File]::Move($staged, $Path); return $true } catch [IO.IOException] { return $false }
  } finally {
    Remove-Item -LiteralPath $staged -ErrorAction SilentlyContinue
  }
}
