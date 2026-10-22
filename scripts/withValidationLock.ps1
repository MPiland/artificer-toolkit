<#
.SYNOPSIS
Runs one validation batch under the shared validation lock, first come, first served.

.DESCRIPTION
Two lanes share the machine:
- heavy (default): one batch at a time, in local-validation/.validation.lock. Anything may run here:
  builds, compiles, broad suites, codegen, backend reset and seed.
- light: up to two batches at once, in local-validation/.validation.light-<n>.lock, alongside the
  heavy batch. Only scoped test files: the runner refuses a light batch that builds, compiles,
  deploys, seeds, resets or starts a browser, caps it at 10 minutes, and starts it only while the
  machine has at least 1 GB of free memory.
Every lane uses the main checkout's Turbo cache (.turbo/cache), so worktrees share build hits.

Each waiter queues a ticket in its lane's queue (.validation.queue or .validation.light-queue).
Only the oldest live tickets, one per slot, may take a lock, so each lane runs in arrival order. A
ticket whose waiting process has exited is pruned. The batch runs in a child pwsh under a timeout
with $ErrorActionPreference = 'Stop' and $PSNativeCommandUseErrorActionPreference = $true, so it
stops at its first failing command unless it opts out by setting $ErrorActionPreference itself.
The runner removes its own lock and ticket even on failure or timeout. The batch script must not
take a lock itself. Locks and queues live beside this script, so worktree sessions call the main
checkout's copy; the batch runs in the caller's current directory.

.EXAMPLE
pwsh -NoProfile -File D:/dev/artificer-toolkit/scripts/withValidationLock.ps1 -Name spells-22-green -Script local-validation/spells-22/green.ps1

.EXAMPLE
pwsh -NoProfile -File D:/dev/artificer-toolkit/scripts/withValidationLock.ps1 -Lane light -Name spells-22-red -Script local-validation/spells-22/red.ps1
#>
param(
  [Parameter(Mandatory)] [ValidatePattern('^[a-z0-9][a-z0-9-]{0,47}$')] [string] $Name,
  [string] $Script,
  [ValidateSet('heavy', 'light')] [string] $Lane = 'heavy',
  [ValidateRange(0, 240)] [int] $TimeoutMinutes = 0
)
$ErrorActionPreference = 'Stop'
$validation = Join-Path (Split-Path -Parent $PSScriptRoot) 'local-validation'
# One Turbo cache for the main checkout and every worktree. Entries are keyed by file contents, so a
# workspace one session built is a cache hit for every other session at the same code.
$env:TURBO_CACHE_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) '.turbo/cache'
$light = $Lane -eq 'light'
if (-not $Script) { throw "The $Lane lane needs -Script." }
$batch = (Resolve-Path -LiteralPath $Script).Path
$command = "`$ErrorActionPreference = 'Stop'; `$PSNativeCommandUseErrorActionPreference = `$true; . '$($batch -replace "'", "''")'; exit `$LASTEXITCODE"
if ($light) {
  $heavyStep = Select-String -LiteralPath $batch -Pattern '\b(typecheck\S*|tsc|turbo|build|codegen|resetLocalConvex|deploy|seed|wrangler|playwright|e2e|storybook)\b' | Select-Object -First 1
  if ($heavyStep) { throw "Light lane refuses ${Name}: line $($heavyStep.LineNumber) needs the heavy lane: $($heavyStep.Line.Trim())" }
  if ($TimeoutMinutes -gt 10) { throw 'Light lane batches are capped at 10 minutes.' }
}
$timeout = if ($TimeoutMinutes -gt 0) { $TimeoutMinutes } elseif ($light) { 10 } else { 20 }
$locks = switch ($Lane) {
  'light' { 1, 2 | ForEach-Object { Join-Path $validation ".validation.light-$_.lock" } }
  default { @(Join-Path $validation '.validation.lock') }
}
$queue = Join-Path $validation ($Lane -eq 'heavy' ? '.validation.queue' : ".validation.$Lane-queue")
$minimumMB = $light ? 1024 : 0
$staleMinutes = $light ? 30 : 90
New-Item -ItemType Directory -Force $queue | Out-Null
$ticket = Join-Path $queue ('{0:D20}-{1}-{2}' -f [DateTime]::UtcNow.Ticks, $PID, $Name)
New-Item -ItemType File $ticket | Out-Null
$held = $null
$exitCode = 1
$staleWarned = $false
try {
  while (-not $held) {
    $live = @(Get-ChildItem -LiteralPath $queue -File | Sort-Object Name | Where-Object {
        $alive = $null -ne (Get-Process -Id ([int]$_.Name.Split('-')[1]) -ErrorAction SilentlyContinue)
        if (-not $alive) { Remove-Item -LiteralPath $_.FullName -ErrorAction SilentlyContinue }
        $alive
      } | Select-Object -First $locks.Count)
    $os = Get-CimInstance Win32_OperatingSystem
    $freeMB = $os.FreePhysicalMemory / 1KB
    if ($live.FullName -contains $ticket -and $freeMB -ge $minimumMB) {
      foreach ($candidate in $locks) {
        try {
          New-Item -ItemType File $candidate -ErrorAction Stop | Out-Null
          Set-Content -LiteralPath $candidate -Value "$Name pid $PID since $(Get-Date -Format s)"
          $held = $candidate
          break
        } catch {
          $ageMinutes = ((Get-Date) - (Get-Item -LiteralPath $candidate -ErrorAction SilentlyContinue).LastWriteTime).TotalMinutes
          if (-not $staleWarned -and $ageMinutes -gt $staleMinutes) {
            Write-Warning "$candidate is $([int]$ageMinutes) minutes old. Report it; do not delete it."
            $staleWarned = $true
          }
        }
      }
    }
    if (-not $held) { Start-Sleep -Seconds ($Lane -eq 'heavy' ? 10 : 3) }
  }
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
  $child = Start-Process pwsh -ArgumentList '-NoProfile', '-EncodedCommand', $encoded -WorkingDirectory (Get-Location).Path -NoNewWindow -PassThru
  $null = $child.Handle
  if ($child.WaitForExit($timeout * 60000)) {
    $exitCode = $child.ExitCode
  } else {
    taskkill /T /F /PID $child.Id | Out-Null
    Write-Warning "$Name timed out after $timeout minutes; its process tree was stopped."
    $exitCode = 124
  }
} finally {
  if ($held) { Remove-Item -LiteralPath $held -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $ticket -ErrorAction SilentlyContinue
}
exit $exitCode
