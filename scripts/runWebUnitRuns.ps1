param([ValidateRange(1, 10)][int]$Runs = 3)
# Runs the complete web unit project (`yarn workspace @artificer-toolkit/web test`) $Runs times in a
# row on a clean committed tree, under the shared validation lock, for PLATFORM-14.1. Each run gets
# its own full log; summary.json records the commit, each exit code and the vitest totals. Run it from
# a checkout whose node_modules sits inside its own root (not a Claude worktree: Vite refuses the
# junctioned @mantine CSS there). Windows PowerShell turns native stderr into errors under 'Stop', so
# native steps are checked by exit code.
$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$lock = Join-Path $root 'local-validation/.validation.lock'
Set-Location $root

if (git status --porcelain --untracked-files=no) { throw 'The working tree has uncommitted changes; commit them so the recorded sha identifies the tested source.' }
$commit = (git rev-parse HEAD).Trim()
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $root "local-validation/platform-14/$stamp"
New-Item -ItemType Directory -Force $out -ErrorAction Stop | Out-Null

while ($true) {
  try { New-Item -ItemType File $lock -ErrorAction Stop | Out-Null; break } catch { Start-Sleep 30 }
}
$results = @()
try {
  $env:GOMAXPROCS = '2'
  for ($run = 1; $run -le $Runs; $run++) {
    $log = Join-Path $out "run-$run.log"
    $started = Get-Date
    yarn workspace @artificer-toolkit/web test *> $log
    $exitCode = $LASTEXITCODE
    $totals = Select-String -Path $log -Pattern '^\s*(Test Files|Tests)\s' | ForEach-Object { $_.Line.Trim() }
    $results += [ordered]@{
      run = $run
      exitCode = $exitCode
      seconds = [Math]::Round(((Get-Date) - $started).TotalSeconds)
      totals = @($totals)
      log = "local-validation/platform-14/$stamp/run-$run.log"
    }
    "run $run exit $exitCode $($totals -join ' | ')"
  }
} finally {
  Remove-Item -LiteralPath $lock -ErrorAction SilentlyContinue
}
[ordered]@{ commit = $commit; runs = $results } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $out 'summary.json')
"commit $commit; evidence local-validation/platform-14/$stamp"
$failed = $results | Where-Object { $_.exitCode -ne 0 -or ($_.totals -match '\d+ failed') }
if ($failed -or $results.Count -ne $Runs) { exit 1 }
