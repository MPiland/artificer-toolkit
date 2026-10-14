<#
.SYNOPSIS
Runs one validation batch under the shared validation lock, first come, first served.

.DESCRIPTION
Each waiter queues a ticket in local-validation/.validation.queue. Only the oldest live ticket may
create local-validation/.validation.lock, so batches run in arrival order. A ticket whose waiting
process has exited is pruned. The batch script runs in a child pwsh under a timeout, and the
runner removes its own lock and ticket even on failure or timeout. The batch script must not take
the lock itself. The queue and lock live beside this script, so worktree sessions call the main
checkout's copy; the batch runs in the caller's current directory.

.EXAMPLE
pwsh -NoProfile -File D:/dev/artificer-toolkit/scripts/withValidationLock.ps1 -Name spells-22-green -Script local-validation/spells-22/green.ps1
#>
param(
  [Parameter(Mandatory)] [ValidatePattern('^[a-z0-9][a-z0-9-]{0,47}$')] [string] $Name,
  [Parameter(Mandatory)] [string] $Script,
  [int] $TimeoutMinutes = 20
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$lock = Join-Path $root 'local-validation/.validation.lock'
$queue = Join-Path $root 'local-validation/.validation.queue'
$batch = (Resolve-Path -LiteralPath $Script).Path
New-Item -ItemType Directory -Force $queue | Out-Null
$ticket = Join-Path $queue ('{0:D20}-{1}-{2}' -f [DateTime]::UtcNow.Ticks, $PID, $Name)
New-Item -ItemType File $ticket | Out-Null
$held = $false
$exitCode = 1
$staleWarned = $false
try {
  while (-not $held) {
    $head = Get-ChildItem -LiteralPath $queue -File | Sort-Object Name | Where-Object {
      $alive = $null -ne (Get-Process -Id ([int]$_.Name.Split('-')[1]) -ErrorAction SilentlyContinue)
      if (-not $alive) { Remove-Item -LiteralPath $_.FullName -ErrorAction SilentlyContinue }
      $alive
    } | Select-Object -First 1
    if ($head.FullName -eq $ticket) {
      try {
        New-Item -ItemType File $lock -ErrorAction Stop | Out-Null
        Set-Content -LiteralPath $lock -Value "$Name pid $PID since $(Get-Date -Format s)"
        $held = $true
        continue
      } catch {
        $current = Get-Item -LiteralPath $lock -ErrorAction SilentlyContinue
        $ageMinutes = if ($current) { ((Get-Date) - $current.LastWriteTime).TotalMinutes } else { 0 }
        if (-not $staleWarned -and $ageMinutes -gt 90) {
          Write-Warning "The validation lock is $([int]$ageMinutes) minutes old. Report it; do not delete it."
          $staleWarned = $true
        }
      }
    }
    Start-Sleep -Seconds 10
  }
  $child = Start-Process pwsh -ArgumentList '-NoProfile', '-File', $batch -WorkingDirectory (Get-Location).Path -NoNewWindow -PassThru
  $null = $child.Handle
  if ($child.WaitForExit($TimeoutMinutes * 60000)) {
    $exitCode = $child.ExitCode
  } else {
    taskkill /T /F /PID $child.Id | Out-Null
    Write-Warning "$Name timed out after $TimeoutMinutes minutes; its process tree was stopped."
    $exitCode = 124
  }
} finally {
  if ($held) { Remove-Item -LiteralPath $lock -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $ticket -ErrorAction SilentlyContinue
}
exit $exitCode
