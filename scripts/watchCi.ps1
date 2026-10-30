# Waits for every workflow run on one commit (Tests, Browser journeys, and Live backend when the push
# triggered it) and exits on the first failure, so a slice never waits on one run while another has
# already failed.
# One `gh run list` call per poll, every 120 seconds, to stay inside the shared API rate limit.
#   pwsh -NoProfile -File scripts/watchCi.ps1 [-Ref HEAD]
# Exit 0: every run concluded success. Exit 1: a run failed or ended in any other non-success conclusion
# (its failed steps are printed, with the download command for updated snapshots, or for generated-file
# drift the auto-fix could not commit; a type error cancels the Tests run early and counts as a failure),
# or a `gh` or `git` call failed (no network, auth, rate limit). Exit 2: the latest run was cancelled with
# no failed job.
# When Live fails on generated-file drift, or Lint is the only failing Tests job, that workflow's auto-fix
# job commits the fixes to the branch; the script prints AUTO-FIX <sha> and follows that commit (exit
# codes then refer to it).
param([string]$Ref = 'HEAD')

# A failed `gh` call must end the watch: read as an empty run list, it once reported green.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$sha = git rev-parse $Ref
$started = Get-Date
$testsSeenAt = $null
while ($true) {
  # Only the validation workflows: a Merge slice run dispatched from this commit is not its CI.
  $runs = gh run list --commit $sha --limit 20 --json databaseId,workflowName,status,conclusion,createdAt | ConvertFrom-Json |
    Where-Object workflowName -in 'Tests', 'Live backend', 'Browser journeys'
  # A superseded run (a re-dispatch or re-push of the same commit) does not count; the newest one per workflow does.
  $latest = $runs | Group-Object workflowName | ForEach-Object { $_.Group | Sort-Object createdAt -Descending | Select-Object -First 1 }
  if ($latest | Where-Object workflowName -eq 'Tests') { $testsSeenAt ??= Get-Date }

  # Tests cancels its own run on a type error (job "Cancel the run on a type error"); a cancelled run with a
  # failed job is that failure, not a superseded run. Any other conclusion but success (timed_out,
  # startup_failure, action_required, ...) is a failure too.
  $cancelledRuns = @($latest | Where-Object { $_.status -eq 'completed' -and $_.conclusion -eq 'cancelled' })
  $failedJobs = @{}
  foreach ($run in $cancelledRuns) {
    $failedJobs[$run.databaseId] = gh run view $run.databaseId --json jobs --jq '[.jobs[] | select(.conclusion=="failure")] | length'
  }
  $failed = $latest | Where-Object {
    $_.status -eq 'completed' -and ($_.conclusion -notin 'success', 'cancelled' -or ($_.conclusion -eq 'cancelled' -and $failedJobs[$_.databaseId] -ne '0'))
  }
  foreach ($run in $failed) {
    $steps = gh run view $run.databaseId --json jobs --jq '.jobs[] | select(.conclusion=="failure") | "\(.name): \([.steps[] | select(.conclusion=="failure") | .name] | join(", "))"'
    "FAILED $($run.workflowName) $($run.databaseId)"
    $steps
    if ($steps -match '^Typecheck') {
      # Read the whole log first: stopping gh mid-pipeline would surface as a failed gh call.
      $log = gh run view $run.databaseId --log-failed
      $log | Select-String 'error TS\d+' | Select-Object -First 40 | ForEach-Object Line
    }
    $drift = [bool]($steps -match 'Generated files match the commit')
    $lintOnly = $run.workflowName -eq 'Tests' -and @($steps).Count -gt 0 -and -not (@($steps) | Where-Object { $_ -notmatch '^Lint: ' })
    if ($drift -or $lintOnly) {
      # An auto-fix job (live-backend: regenerated files; Tests: format and lint fixes) commits on top of
      # $sha (trailer below) and dispatches Tests and Live; the run only finishes after that job, so the
      # commit exists by now.
      $branch = (gh run view $run.databaseId --json headBranch --jq .headBranch)
      $tip = gh api "repos/{owner}/{repo}/commits/$branch" | ConvertFrom-Json
      if ($tip.sha -ne $sha -and $tip.parents.sha -contains $sha -and $tip.commit.message -match '(?m)^Generated-By: (live-backend|tests) auto-fix$') {
        "AUTO-FIX $($tip.sha) (fixes committed on top of $sha); following it"
        $autoFix = $tip.sha
        continue
      }
    }
    if ($lintOnly) {
      "Fix: node scripts/formatChanged.mjs --base origin/codex/phase-08-2-convex-cutover; yarn oxlint --fix; yarn lint; commit; push"
    }
    if ($drift) {
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

  # Live backend is path-filtered, and an auto-fix dispatch starts no Browser journeys run; a workflow that
  # has not appeared 3 minutes after Tests was not triggered for this commit.
  $settled = ($latest.workflowName -contains 'Tests') -and (($latest.Count -ge 3) -or ((Get-Date) - $testsSeenAt).TotalMinutes -ge 3)
  if ($settled -and -not ($latest | Where-Object status -ne 'completed')) {
    $latest | ForEach-Object { "GREEN $($_.workflowName) $($_.databaseId)" }
    exit 0
  }
  if (-not $testsSeenAt -and ((Get-Date) - $started).TotalMinutes -ge 10) { "No Tests run for $sha after 10 minutes; was it pushed to ci/<slice>?"; exit 1 }
  [Threading.Thread]::Sleep(120000)
}
