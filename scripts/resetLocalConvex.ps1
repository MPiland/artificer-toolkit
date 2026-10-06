param([Parameter(Mandatory)][ValidatePattern('^[a-z0-9][a-z0-9-]{2,62}$')][string]$Name)
# Backs up, then empties every nonempty app and component table of the LOCAL Convex deployment.
# Local development data only: refuses any target other than the phase82-local-linux container.
# Better Auth JWKS and system tables are preserved. Evidence goes to local-validation/convex-reset/.
# Windows PowerShell 5.1 turns native stderr (docker, yarn progress) into terminating errors under
# 'Stop', so native steps are checked by exit code and cmdlets opt in with -ErrorAction Stop.
$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$url = 'http://127.0.0.1:3210'
$expectedInstance = 'phase82-local-linux'
$container = 'phase82-convex-local-linux'
$packet = Join-Path $root 'local-validation/convex-reset'
New-Item -ItemType Directory -Force $packet -ErrorAction Stop | Out-Null
$stem = Join-Path $packet $Name
if (Test-Path -LiteralPath "$stem.reset.json") { throw 'Reset evidence with this name already exists.' }

$instance = (Invoke-WebRequest -UseBasicParsing -Uri "$url/instance_name" -TimeoutSec 10 -ErrorAction Stop).Content
if ($instance -ne $expectedInstance) { throw 'The reset target is not the local Convex deployment.' }
# The admin key is generated inside the container and never written to disk or printed.
$adminKey = (docker exec $container ./generate_admin_key.sh 2>$null | Select-Object -Last 1).Trim()
if (-not $adminKey) { throw 'Could not generate the local admin key.' }

$manifest = [ordered]@{
  target = $instance
  url = $url
  startedAtUtc = [DateTime]::UtcNow.ToString('o')
  backup = "$Name.before.zip"
  imports = @()
}
$manifestPath = "$stem.reset.json"
$emptyPath = "$stem.empty.jsonl"
[System.IO.File]::WriteAllBytes($emptyPath, [byte[]]@())

# Node on Windows can abort with a libuv assertion while exiting after the command finished
# (exit 0xC0000409). That exit is accepted only when the step is verified independently: exports
# by their download confirmation plus a readable zip, imports by the post-reset snapshot check.
$libuvExitAbort = -1073740791
# Yarn runs through Node directly, as validatePreStagingLocal.mjs does: a yarn.cmd shim would pass the
# key through cmd.exe, which splits it at its '|' and echoes the secret half into the log.
$node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$yarn = Join-Path (Split-Path $node) 'node_modules/corepack/dist/yarn.js'
if (-not (Test-Path -LiteralPath $yarn)) { throw 'Corepack yarn.js was not found beside node.' }
function Invoke-LocalConvex {
  param([string[]]$Arguments, [string]$LogPath, [string]$Label, [string]$ExportPath)
  & $node $yarn workspace @artificer-toolkit/apis exec convex @Arguments --url $url --admin-key $adminKey *> $LogPath
  $exitCode = $LASTEXITCODE
  if ($exitCode -eq 0) { return }
  if ($exitCode -eq $libuvExitAbort) {
    if (-not $ExportPath) { return }
    $log = Get-Content -LiteralPath $LogPath -Raw
    if ($log -match 'Downloaded snapshot export' -and (Test-Path -LiteralPath $ExportPath)) {
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      [System.IO.Compression.ZipFile]::OpenRead($ExportPath).Dispose()
      return
    }
  }
  throw "$Label failed (exit $exitCode); see $LogPath"
}

function Get-ResetTables {
  param([string]$Snapshot)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($Snapshot)
  try {
    $tables = @()
    foreach ($entry in $zip.Entries) {
      if ($entry.Length -eq 0 -or -not $entry.FullName.EndsWith('/documents.jsonl', [StringComparison]::Ordinal)) { continue }
      $component = $null
      if ($entry.FullName -match '^_components/(.+)/([^/]+)/documents\.jsonl$') {
        $component = $Matches[1].Replace('/_components/', '/')
        $table = $Matches[2]
      } elseif ($entry.FullName -match '^([^/]+)/documents\.jsonl$') {
        $table = $Matches[1]
      } else {
        throw "Unrecognized nonempty Convex table path: $($entry.FullName)"
      }
      if ($table.StartsWith('_', [StringComparison]::Ordinal)) { continue }
      if ($component -eq 'betterAuth' -and $table -eq 'jwks') { continue }
      $tables += [ordered]@{ component = $component; table = $table; source = $entry.FullName }
    }
    return @($tables | Sort-Object { $_.component }, { $_.table })
  } finally {
    $zip.Dispose()
  }
}

try {
  Push-Location $root
  try {
    Invoke-LocalConvex -Arguments @('export', '--path', "$stem.before.zip") -LogPath "$stem.backup.log" -Label 'Local backup' -ExportPath "$stem.before.zip"
    $manifest.backupSha256 = (Get-FileHash -LiteralPath "$stem.before.zip" -Algorithm SHA256).Hash
    $tables = @(Get-ResetTables -Snapshot "$stem.before.zip")
    $manifest.plannedTables = $tables
    for ($index = 0; $index -lt $tables.Count; $index++) {
      $entry = $tables[$index]
      $arguments = @('import', '--replace', '--yes', '--table', $entry.table)
      if ($entry.component) { $arguments += @('--component', $entry.component) }
      $arguments += $emptyPath
      Invoke-LocalConvex -Arguments $arguments -LogPath ('{0}.import-{1:D3}.log' -f $stem, ($index + 1)) -Label "Clear $($entry.source)"
      $manifest.imports += $entry.source
    }
    Invoke-LocalConvex -Arguments @('export', '--path', "$stem.after.zip") -LogPath "$stem.after.log" -Label 'Post-reset snapshot' -ExportPath "$stem.after.zip"
    $manifest.postResetSha256 = (Get-FileHash -LiteralPath "$stem.after.zip" -Algorithm SHA256).Hash
    $cleared = @($tables | ForEach-Object { "$($_.component)/$($_.table)" })
    $remaining = @(Get-ResetTables -Snapshot "$stem.after.zip" | Where-Object { "$($_.component)/$($_.table)" -in $cleared })
    if ($remaining.Count -gt 0) { throw "Post-reset snapshot retains $($remaining.Count) cleared tables." }
    $manifest.clearedTableCount = $tables.Count
    $manifest.status = 'passed'
    Write-Output "Reset $($tables.Count) nonempty local tables; backup at $stem.before.zip."
  } finally {
    Pop-Location
  }
} catch {
  $manifest.status = 'failed'
  $manifest.error = $_.Exception.Message
  throw
} finally {
  $manifest.completedAtUtc = [DateTime]::UtcNow.ToString('o')
  # BOM-free UTF-8 in both shells; Windows PowerShell 5.1's -Encoding utf8 adds a BOM that JSON.parse rejects.
  [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8))
  Remove-Variable adminKey -ErrorAction SilentlyContinue
}
