# Waits for every workflow run on one commit (Tests, and Live backend when the push triggered it) and
# exits on the first failure, so a slice never waits on one run while another has already failed.
# One `gh run list` call per poll, every 120 seconds, to stay inside the shared API rate limit.
#   pwsh -NoProfile -File scripts/watchCi.ps1 [-Ref HEAD]
# Exit 0: all green. Exit 1: a run failed (its failed steps are printed). Exit 2: the latest run was cancelled.
param([string]$Ref = 'HEAD')

$sha = git rev-parse $Ref
$started = Get-Date
$testsSeenAt = $null
while ($true) {
  $runs = gh run list --commit $sha --limit 20 --json databaseId,workflowName,status,conclusion,createdAt | ConvertFrom-Json
  # A superseded run (a re-dispatch or re-push of the same commit) does not count; the newest one per workflow does.
  $latest = $runs | Group-Object workflowName | ForEach-Object { $_.Group | Sort-Object createdAt -Descending | Select-Object -First 1 }
  if ($latest | Where-Object workflowName -eq 'Tests') { $testsSeenAt ??= Get-Date }

  $failed = $latest | Where-Object { $_.status -eq 'completed' -and $_.conclusion -eq 'failure' }
  foreach ($run in $failed) {
    $steps = gh run view $run.databaseId --json jobs --jq '.jobs[] | select(.conclusion=="failure") | "\(.name): \([.steps[] | select(.conclusion=="failure") | .name] | join(", "))"'
    "FAILED $($run.workflowName) $($run.databaseId)"
    $steps
    if ($steps -match 'Generated files match the commit') {
      "Fix: gh run download $($run.databaseId) -n generated-files -D local-validation/generated-$($run.databaseId)"
      "     Copy-Item -Recurse -Force local-validation/generated-$($run.databaseId)/* apps/apis/convex; git diff --stat; commit; push"
    }
  }
  if ($failed) { exit 1 }

  $cancelled = $latest | Where-Object { $_.status -eq 'completed' -and $_.conclusion -eq 'cancelled' }
  if ($cancelled) { $cancelled | ForEach-Object { "CANCELLED $($_.workflowName) $($_.databaseId)" }; exit 2 }

  # Live backend is path-filtered; when it has not appeared 3 minutes after Tests, this push did not trigger it.
  $settled = $testsSeenAt -and (($latest.Count -ge 2) -or ((Get-Date) - $testsSeenAt).TotalMinutes -ge 3)
  if ($settled -and -not ($latest | Where-Object status -ne 'completed')) {
    $latest | ForEach-Object { "GREEN $($_.workflowName) $($_.databaseId)" }
    exit 0
  }
  if (-not $testsSeenAt -and ((Get-Date) - $started).TotalMinutes -ge 10) { "No Tests run for $sha after 10 minutes; was it pushed to ci/<slice>?"; exit 1 }
  [Threading.Thread]::Sleep(120000)
}
