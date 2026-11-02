param([Parameter(Mandatory)][ValidateSet('start', 'status', 'stop', 'mail')][string]$Action)
# Serves the local fixtures the Convex backend's Node actions call from inside the local Convex
# container, so the backend and host clients reach the same state:
# - the in-memory R2 protocol substitute (apps/apis/tests/localR2.ts) on container port 8026, which
#   Docker publishes on host 127.0.0.1:8026 for map uploads and browser media;
# - the email sink (apps/apis/tests/localEmailSink.ts) on container-only 127.0.0.1:8025/email for
#   MAIL_DELIVERY_MODE=local (LOCAL_EMAIL_SINK_URL). It keeps the newest 50 messages as HTML files;
#   'mail' copies them to the ignored local-validation/local-email/ folder for a tester to open.
# Idempotent: 'start' reuses healthy fixtures, 'stop' is a no-op when none run. The fixtures use fixed
# dummy credentials; this script reads and prints no secret.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$container = 'phase82-convex-local-linux'
$directory = '/tmp/artificer-local-fixtures'

function Test-LocalFixtures {
  try {
    $r2 = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8026/health' -TimeoutSec 3
    if ($r2.StatusCode -ne 200 -or $r2.Content -ne 'artificer-local-r2') { return $false }
  } catch { return $false }
  docker exec $container node -e "fetch('http://127.0.0.1:8025/health').then((r) => r.text()).then((body) => process.exit(body === 'artificer-local-email' ? 0 : 1), () => process.exit(1))" 2>$null
  return $LASTEXITCODE -eq 0
}

function Invoke-Container([string]$Command) {
  docker exec $container sh -c $Command
  if ($LASTEXITCODE -ne 0) { throw "The local fixture container step failed (exit $LASTEXITCODE)." }
}

# A throwaway CI container shares the runner's host network instead (.github/workflows/browser-journeys.yml),
# so its Node actions reach the host Worker through host.docker.internal as Docker Desktop does locally.
$hostNetwork = (docker inspect --format '{{.HostConfig.NetworkMode}}' $container 2>$null) -eq 'host'
if (-not $hostNetwork -and (docker port $container 8026/tcp 2>$null) -notcontains '127.0.0.1:8026') {
  throw "$container must publish container port 8026 on host 127.0.0.1:8026 only."
}

switch ($Action) {
  'status' {
    if (Test-LocalFixtures) { 'running' } else { 'stopped'; exit 1 }
  }
  'start' {
    if (Test-LocalFixtures) { 'Local Convex fixtures already running.'; exit 0 }
    # A partial start (one fixture answering) is stopped first so the ports are free.
    Invoke-Container "if [ -f $directory/pid ]; then kill `$(cat $directory/pid) 2>/dev/null; fi; mkdir -p $directory && rm -f $directory/pid"
    # R2 binds 0.0.0.0 inside the container; Docker publishes it on host loopback only (checked above).
    $entry = New-TemporaryFile
    try {
      [System.IO.File]::WriteAllText($entry.FullName, @"
import { writeFileSync } from 'node:fs'
import { startLocalEmailSink } from './localEmailSink.ts'
import { startLocalR2 } from './localR2.ts'
await startLocalR2({ port: 8026, host: '0.0.0.0' })
await startLocalEmailSink({ port: 8025, directory: '$directory/email', capacity: 50 })
writeFileSync('$directory/pid', String(process.pid))
"@)
      foreach ($copy in @(
          @{ from = (Join-Path $root 'apps/apis/tests/localR2.ts'); to = 'localR2.ts' },
          @{ from = (Join-Path $root 'apps/apis/tests/localEmailSink.ts'); to = 'localEmailSink.ts' },
          @{ from = $entry.FullName; to = 'server.mjs' })) {
        docker cp $copy.from "${container}:$directory/$($copy.to)" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Copying the local fixtures into the container failed.' }
      }
    } finally { Remove-Item -LiteralPath $entry.FullName -Force }
    docker exec -d $container sh -c "cd $directory && exec node server.mjs > server.log 2>&1"
    if ($LASTEXITCODE -ne 0) { throw 'Starting the local fixtures failed.' }
    $deadline = [DateTime]::UtcNow.AddSeconds(20)
    while ([DateTime]::UtcNow -lt $deadline) {
      if (Test-LocalFixtures) { 'Local Convex fixtures started.'; exit 0 }
      Start-Sleep -Milliseconds 250
    }
    throw "The local fixtures did not become healthy; see $directory/server.log in $container."
  }
  'stop' {
    # Stops only the process this script recorded; R2 objects held in memory are discarded.
    Invoke-Container "if [ -f $directory/pid ]; then kill `$(cat $directory/pid) 2>/dev/null; rm -f $directory/pid; fi"
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    while ((Test-LocalFixtures) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
    if (Test-LocalFixtures) { throw 'The local fixtures are still answering after stop.' }
    'Local Convex fixtures stopped.'
  }
  'mail' {
    # Replaces the host copy with the sink's current messages; message bodies carry their links and codes.
    $target = Join-Path $root 'local-validation/local-email'
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
    Invoke-Container "mkdir -p $directory/email"
    docker cp "${container}:$directory/email" $target | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Copying the local email messages failed.' }
    "$((Get-ChildItem -LiteralPath $target -Filter *.html).Count) message(s) in $target"
  }
}
