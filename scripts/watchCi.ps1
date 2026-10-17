# Waits for every workflow run on one commit (Tests, and Live backend when the push triggered it) and
# exits on the first failure, so a slice never waits on one run while another has already failed.
# One `gh run list` call per poll, every 120 seconds, to stay inside the shared API rate limit.
#   pwsh -NoProfile -File scripts/watchCi.ps1 [-Ref HEAD]
# Exit 0: all green. Exit 1: a run failed (its failed steps are printed, with the download command for
# updated snapshots, or for generated-file drift the auto-fix could not commit; a type error cancels the
# Tests run early and counts as a failure). Exit 2: the latest run was cancelled with no failed job.
# When Live fails on generated-file drift, the workflow's auto-fix job commits the regenerated files to
# the branch; the script prints AUTO-FIX <sha> and follows that commit (exit codes then refer to it).
param([string]$Ref = 'HEAD')

$sha = git rev-parse $Ref
$started = Get-Date
$testsSeenAt = $null
while ($true) {
  $runs = gh run list --commit $sha --limit 20 --json databaseId,workflowName,status,conclusion,createdAt | ConvertFrom-Json
  # A superseded run (a re-dispatch or re-push of the same commit) does not count; the newest one per workflow does.
  $latest = $runs | Group-Object workflowName | ForEach-Object { $_.Group | Sort-Object createdAt -Descending | Select-Object -First 1 }
  if ($latest | Where-Object workflowName -eq 'Tests') { $testsSeenAt ??= Get-Date }

  # Tests cancels its own run on a type error (job "Cancel the run on a type error"); a cancelled run with a
  # failed job is that failure, not a superseded run. An unreadable job list is polled again.
  $cancelledRuns = @($latest | Where-Object { $_.status -eq 'completed' -and $_.conclusion -eq 'cancelled' })
  $failedJobs = @{}
  foreach ($run in $cancelledRuns) {
    $failedJobs[$run.databaseId] = gh run view $run.databaseId --json jobs --jq '[.jobs[] | select(.conclusion=="failure")] | length'
  }
  if ($failedJobs.Values -contains $null) { [Threading.Thread]::Sleep(120000); continue }
  $failed = $latest | Where-Object {
    $_.status -eq 'completed' -and ($_.conclusion -eq 'failure' -or ($_.conclusion -eq 'cancelled' -and $failedJobs[$_.databaseId] -ne '0'))
  }
  foreach ($run in $failed) {
    $steps = gh run view $run.databaseId --json jobs --jq '.jobs[] | select(.conclusion=="failure") | "\(.name): \([.steps[] | select(.conclusion=="failure") | .name] | join(", "))"'
    "FAILED $($run.workflowName) $($run.databaseId)"
    $steps
    if ($steps -match '^Typecheck') {
      gh run view $run.databaseId --log-failed | Select-String 'error TS\d+' | Select-Object -First 40 | ForEach-Object Line
    }
    if ($steps -match 'Generated files match the commit') {
      # The live-backend auto-fix job commits the regenerated files to the branch (trailer below) and
      # dispatches Tests and Live on it; the run only finishes after that job, so the commit exists by now.
      $branch = (gh run view $run.databaseId --json headBranch --jq .headBranch)
      $tip = gh api "repos/{owner}/{repo}/commits/$branch" | ConvertFrom-Json
      if ($tip.sha -ne $sha -and $tip.parents.sha -contains $sha -and $tip.commit.message -match '(?m)^Generated-By: live-backend auto-fix$') {
        "AUTO-FIX $($tip.sha) (regenerated files committed on top of $sha); following it"
        $autoFix = $tip.sha
        continue
      }
      "Fix: gh run download $($run.databaseId) -n generated-files -D local-validation/generated-$($run.databaseId)"
      "     Copy-Item -Recurse -Force local-validation/generated-$($run.databaseId)/* apps/apis/convex; git diff --stat; commit; push"
    }
    # Snapshot mismatches: the Tests workflow reran the failing files with -u and kept the corrected files.
    $artifacts = gh api "repos/{owner}/{repo}/actions/runs/$($run.databaseId)/artifacts" --jq '.artifacts[].name'
    if ($artifacts -contains 'updated-snapshots') {
      "Fix: gh run download $($run.databaseId) -n updated-snapshots -D local-validation/snapshots-$($run.databaseId)"
      "     Copy-Item -Recurse -Force local-validation/snapshots-$($run.databaseId)/* .; git diff --stat; review each snapshot diff (a changed snapshot may be the bug); commit; push"
    }
  }
  if ($autoFix) {
    # The branch now holds the auto-fix commit: follow its runs. Pull it locally to continue from it.
    $sha = $autoFix; $autoFix = $null; $started = Get-Date; $testsSeenAt = $null
    [Threading.Thread]::Sleep(60000)
    continue
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
