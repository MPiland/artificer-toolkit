param(
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9][a-z0-9-]{2,120}$')][string]$Name,
  [Parameter(Mandatory)][ValidateSet(
    'encounter-blueprints', 'character-concurrency', 'receipt-ledgers', 'notification-delivery', 'session-control',
    'campaign-inventory', 'equipment-capacity', 'equipment-character', 'publication', 'publication-class',
    'publication-feat', 'publication-equipment', 'encounter-lifecycle', 'encounter-action-contention',
    'encounter-reaction-contention', 'checkpoint', 'checkpoint-large','campaign-item-producers', 'campaign-vehicle-producers',
    'campaign-inventory-read-probe', 'campaign-membership-custody', 'campaign-currency-lifecycle',
    'campaign-assignment-lifecycle', 'campaign-qualified-currency', 'campaign-custody-authored-delete',
    'auth-browser', 'signed-in-request-audit', 'profile-browser', 'recovery-browser', 'social-browser', 'account-entitlements',
    'publication-browser', 'publication-class-browser', 'publication-feat-browser',
    'publication-equipment-browser', 'campaign-lifecycle', 'campaign-custody-browser',
    'campaign-membership-browser', 'campaign-collaboration-browser', 'campaign-content-browser',
    'scene-live-browser', 'vtt-map-retention', 'movement', 'passage', 'disarm-browser', 'effects-browser',
    'area-browser', 'shove-aside-browser', 'hide-browser', 'player-browser', 'heat-metal-browser', 'delegated-attack-browser', 'account-deletion-browser', 'builder-browser', 'character-sheet-browser',
    'character-sheet-spells-browser', 'vtt-browser', 'v15-workload'
  )][string]$Proof
)
# Runs one native proof of apps/apis/tests/developmentDrafts.ts against the LOCAL Convex deployment
# while a background job captures the backend's native function log for the same window. Refuses any
# target other than the phase82-local-linux container. Evidence goes to
# local-validation/local-convex-proofs/<Name>.*, which scripts/validatePreStagingLocal.mjs verifies.
# Windows PowerShell 5.1 turns native stderr (git, yarn) into terminating errors under 'Stop', so
# native steps are checked by exit code and cmdlets opt in with -ErrorAction Stop.
$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$url = 'http://127.0.0.1:3210'
$siteUrl = 'http://127.0.0.1:3211'
$expectedInstance = 'phase82-local-linux'
$container = 'phase82-convex-local-linux'
$packet = Join-Path $root 'local-validation/local-convex-proofs'
New-Item -ItemType Directory -Force $packet -ErrorAction Stop | Out-Null
$stem = Join-Path $packet $Name
$stopSignal = "$stem.native-stop"
$readySignal = "$stem.native-collector-ready.json"
if ((Test-Path -LiteralPath "$stem.log") -or (Test-Path -LiteralPath $stopSignal)) { throw "Evidence already exists: $Name" }

# Yarn injects this file into the driver and its values override the process environment, so it must
# not hold an admin key: a stored key would replace the one generated below.
$environmentFile = if ($env:YARN_INJECT_ENVIRONMENT_FILES) { $env:YARN_INJECT_ENVIRONMENT_FILES } else { Join-Path $root 'local-validation/local-convex/local.application.env' }
if (-not (Test-Path -LiteralPath $environmentFile -PathType Leaf)) { throw "The local application environment file is missing: $environmentFile" }
if (Select-String -LiteralPath $environmentFile -Pattern '^\s*(export\s+)?CONVEX_SELF_HOSTED_ADMIN_KEY\s*=' -Quiet) {
  throw 'The local application environment must not store CONVEX_SELF_HOSTED_ADMIN_KEY; it is generated at run time.'
}

$instance = (Invoke-WebRequest -UseBasicParsing -Uri "$url/instance_name" -TimeoutSec 10 -ErrorAction Stop).Content
if ($instance -ne $expectedInstance) { throw 'The proof target is not the local Convex deployment.' }
# The admin key is generated inside the container and never written to disk or printed.
$adminKey = ([string](docker exec $container ./generate_admin_key.sh 2>$null | Select-Object -Last 1)).Trim()
if ($LASTEXITCODE -ne 0 -or -not $adminKey) { throw 'Could not generate the local admin key.' }

$driverArguments = [string[]]@(switch ($Proof) {
  'movement' { '--encounter-movement-browser' }
  'passage' { '--encounter-passage-browser' }
  'disarm-browser' { '--encounter-disarm-browser' }
  'effects-browser' { '--encounter-effects-browser' }
  'area-browser' { '--encounter-area-browser' }
  'shove-aside-browser' { '--encounter-shove-aside-browser' }
  'hide-browser' { '--encounter-hide-browser' }
  'player-browser' { '--encounter-player-browser' }
  'heat-metal-browser' { '--encounter-heat-metal-browser' }
  'delegated-attack-browser' { '--encounter-delegated-attack-browser' }
  'builder-browser' { '--character-builder-browser' }
  'v15-workload' { '--encounter-v15-workload' }
  'account-deletion-browser' { '--account-deletion-browser'; "--fixture-attempt=$Name" }
  default { "--$Proof" }
})

$collector = Start-Job -ErrorAction Stop -ArgumentList $stem, $stopSignal, $readySignal, $url, $expectedInstance, $adminKey -ScriptBlock {
  param($stem, $stopSignal, $readySignal, $url, $expectedInstance, $adminKey)
  # The collector runs only cmdlets, so 'Stop' cannot be triggered by native stderr here.
  $ErrorActionPreference = 'Stop'

  function Test-NativeLogIdleTimeout {
    param([System.Exception]$Exception)
    $current = $Exception
    while ($null -ne $current) {
      if ($current -is [System.TimeoutException]) { return $true }
      if ($current -is [System.Net.WebException] -and $current.Status -eq [System.Net.WebExceptionStatus]::Timeout) { return $true }
      $current = $current.InnerException
    }
    return $false
  }

  function Get-NativeLogPage {
    param([string]$Uri, [hashtable]$Headers)
    try {
      return Invoke-RestMethod -Uri $Uri -Headers $Headers -TimeoutSec 10
    } catch {
      if (Test-NativeLogIdleTimeout $_.Exception) { return $null }
      throw
    }
  }

  $collectorStartedAtUtc = [DateTime]::UtcNow.ToString('o')
  $instance = (Invoke-WebRequest -UseBasicParsing -Uri "$url/instance_name").Content
  if ($instance -ne $expectedInstance) { throw 'Wrong native log instance.' }
  $headers = @{ Authorization = "Convex $adminKey" }
  $page = Get-NativeLogPage -Uri "$url/api/stream_function_logs?cursor=0" -Headers $headers
  if ($null -eq $page) { throw 'Native log baseline timed out.' }
  $cursor = $page.newCursor
  if ($null -eq $cursor) { throw 'Native log cursor is unavailable.' }
  $startCursor = $cursor
  [System.IO.File]::WriteAllText($readySignal, (@{ readyAtUtc = [DateTime]::UtcNow.ToString('o'); startCursor = $startCursor } | ConvertTo-Json))

  $entryCount = 0
  $writer = [System.IO.StreamWriter]::new("$stem.native-executions.jsonl", $true, [System.Text.UTF8Encoding]::new($false))
  try {
    while ($true) {
      $page = Get-NativeLogPage -Uri ("$url/api/stream_function_logs?cursor=" + [string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0}', $cursor)) -Headers $headers
      if ($null -eq $page) {
        if (Test-Path -LiteralPath $stopSignal) { break }
        continue
      }

      $entries = @($page.entries)
      foreach ($entry in $entries) {
        $writer.WriteLine(($entry | ConvertTo-Json -Depth 24 -Compress))
        $entryCount += 1
      }
      $writer.Flush()
      $cursor = $page.newCursor
      if ($null -eq $cursor) { throw 'Native log cursor is unavailable.' }
      if ((Test-Path -LiteralPath $stopSignal) -and $entries.Count -eq 0) { break }
    }

    $completedAtUtc = [DateTime]::UtcNow.ToString('o')
    $cutoffAtUtc = (Get-Content -LiteralPath $stopSignal -Raw).Trim()
    $capture = @{ entryCount = $entryCount; startCursor = $startCursor; lastCursor = $cursor; cutoffAtUtc = $cutoffAtUtc; sourceWindowStartUtc = $collectorStartedAtUtc; sourceWindowEndUtc = $completedAtUtc; completedAtUtc = $completedAtUtc }
    [System.IO.File]::WriteAllText("$stem.native-capture.json", ($capture | ConvertTo-Json))
  } finally {
    $writer.Dispose()
  }
}

$proofExit = 1
$collectorReady = $false
$collectorTimedOut = $false
$runError = $null
Push-Location $root
try {
  $readyDeadline = [DateTime]::UtcNow.AddSeconds(20)
  while ([DateTime]::UtcNow -lt $readyDeadline) {
    if (Test-Path -LiteralPath $readySignal) {
      $collectorReady = $true
      break
    }
    if ($collector.State -in @('Failed', 'Stopped', 'Completed')) { break }
    $null = Wait-Job $collector -Timeout 1
  }
  if (-not $collectorReady) { throw 'Native log collector did not establish its baseline cursor.' }

  if ($Proof -eq 'builder-browser') {
    # developmentCharacterBrowser.ts overwrites its fixed output folder; keep the previous run's copy.
    $prior = "$stem.previous-builder-output"
    New-Item -ItemType Directory -Path $prior -ErrorAction Stop | Out-Null
    $oldOutput = Join-Path $packet 'phase82-builder-browser'
    foreach ($entry in @('playwright.log', 'playwright')) {
      $source = Join-Path $oldOutput $entry
      if (Test-Path -LiteralPath $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $prior $entry) -Recurse -ErrorAction Stop
      }
    }
  }

  $paths = @(git -c core.quotepath=false ls-files --cached --others --exclude-standard | Sort-Object -Unique)
  if ($LASTEXITCODE -ne 0) { throw 'Source inventory failed.' }
  $head = git rev-parse HEAD
  if ($LASTEXITCODE -ne 0) { throw 'Source head lookup failed.' }
  $hashes = @($paths | ForEach-Object {
    if (Test-Path -LiteralPath $_ -PathType Leaf) {
      [ordered]@{ path = $_; sha256 = (Get-FileHash -LiteralPath $_ -Algorithm SHA256 -ErrorAction Stop).Hash }
    } else { [ordered]@{ path = $_; deleted = $true } }
  })
  [System.IO.File]::WriteAllText("$stem.source-before.json", ([ordered]@{ capturedAtUtc = [DateTime]::UtcNow.ToString('o'); head = $head; sources = $hashes } | ConvertTo-Json -Depth 5))
  [System.IO.File]::WriteAllText("$stem.guard.json", ([ordered]@{ classification = 'local'; target = $instance; url = $url; operation = $Name; verifiedAtUtc = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json))

  $evidenceDirectory = "$stem.evidence"
  $driverEnvironment = [ordered]@{
    YARN_INJECT_ENVIRONMENT_FILES = $environmentFile
    CONVEX_DEPLOYMENT = "local:$expectedInstance"
    CONVEX_URL = $url
    CONVEX_SITE_URL = $siteUrl
    CONVEX_SELF_HOSTED_URL = $url
    CONVEX_SELF_HOSTED_ADMIN_KEY = $adminKey
    CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY = $evidenceDirectory
  }
  $nodeLimit = ''
  if ($Proof -eq 'campaign-membership-browser') {
    $driverEnvironment.NODE_OPTIONS = '--max-old-space-size=2048'
    $nodeLimit = 'NODE_OPTIONS=--max-old-space-size=2048; '
  }
  $command = "${nodeLimit}YARN_INJECT_ENVIRONMENT_FILES=<local application env>; yarn tsx apps/apis/tests/developmentDrafts.ts $($driverArguments -join ' ')"
  [System.IO.File]::WriteAllText("$stem.command.txt", $command)

  $previousEnvironment = @{}
  foreach ($entry in $driverEnvironment.GetEnumerator()) {
    $previousEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key)
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value)
  }
  $started = [DateTime]::UtcNow.ToString('o')
  try {
    # No 0xC0000409 (libuv exit abort) tolerance: a proof has no success signal independent of its exit.
    yarn tsx apps/apis/tests/developmentDrafts.ts @driverArguments *> "$stem.log"
    $proofExit = $LASTEXITCODE
  } finally {
    foreach ($entry in $previousEnvironment.GetEnumerator()) {
      [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value)
    }
  }
  [System.IO.File]::WriteAllText("$stem.exit.txt", "$proofExit")
  $metadata = [ordered]@{ command = $command; startedAtUtc = $started; completedAtUtc = [DateTime]::UtcNow.ToString('o'); exitCode = $proofExit; target = $instance; evidenceDirectory = $evidenceDirectory; sourceIdentity = "$Name.source-before.json" }
  [System.IO.File]::WriteAllText("$stem.metadata.json", ($metadata | ConvertTo-Json))

  $changed = @($hashes | Where-Object {
    if ($_.deleted) { Test-Path -LiteralPath $_.path -PathType Leaf }
    else { -not (Test-Path -LiteralPath $_.path -PathType Leaf) -or (Get-FileHash -LiteralPath $_.path -Algorithm SHA256 -ErrorAction Stop).Hash -ne $_.sha256 }
  } | ForEach-Object { $_.path })
  $finalPaths = @(git -c core.quotepath=false ls-files --cached --others --exclude-standard | Sort-Object -Unique)
  if ($LASTEXITCODE -ne 0) { throw 'Final source inventory failed.' }
  $pathSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::InvariantCultureIgnoreCase)
  $pathSet.UnionWith([string[]]$paths)
  $added = @($finalPaths | Where-Object { -not $pathSet.Contains($_) })
  $parity = [ordered]@{ checkedAtUtc = [DateTime]::UtcNow.ToString('o'); sourceEntries = $hashes.Count; changedPaths = $changed; addedPaths = $added; matches = ($changed.Count -eq 0 -and $added.Count -eq 0) }
  [System.IO.File]::WriteAllText("$stem.source-parity.json", ($parity | ConvertTo-Json))
  $excerpt = Get-Content -LiteralPath "$stem.log" -Tail 24 | Out-String
  Write-Output $excerpt.Substring(0, [Math]::Min(4500, $excerpt.Length))
} catch {
  $runError = $_
  $proofExit = 1
} finally {
  Pop-Location
  [System.IO.File]::WriteAllText($stopSignal, [DateTime]::UtcNow.ToString('o'))
  $collectorDeadline = [DateTime]::UtcNow.AddSeconds(120)
  while ($collector.State -eq 'Running' -and [DateTime]::UtcNow -lt $collectorDeadline) {
    $remainingSeconds = [Math]::Max(1, [Math]::Min(20, [int][Math]::Ceiling(($collectorDeadline - [DateTime]::UtcNow).TotalSeconds)))
    $null = Wait-Job $collector -Timeout $remainingSeconds
  }
  if ($collector.State -eq 'Running') {
    $collectorTimedOut = $true
    Stop-Job $collector
  }
  $collectorState = [string]$collector.State
  Receive-Job $collector *> "$stem.native-capture.log"
  $collectorCompleted = $collectorState -eq 'Completed' -and (Test-Path -LiteralPath "$stem.native-capture.json")
  $proofError = if ($null -eq $runError) { $null } else { $runError.Exception.Message }
  $status = @{ collectorState = $collectorState; collectorReady = $collectorReady; collectorCompleted = $collectorCompleted; collectorTimedOut = $collectorTimedOut; proofExit = $proofExit; proofError = $proofError }
  [System.IO.File]::WriteAllText("$stem.native-capture-status.json", ($status | ConvertTo-Json))
  Remove-Job $collector -Force
  Remove-Variable adminKey -ErrorAction SilentlyContinue
}

if ($null -ne $runError) { Write-Error $runError }
if ($proofExit -ne 0) { exit $proofExit }
if (-not $collectorCompleted) { exit 1 }
exit 0
