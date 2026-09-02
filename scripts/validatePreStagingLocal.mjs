import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { finished } from 'node:stream/promises'

const root = resolve(import.meta.dirname, '..')
const confirmation = 'validate-pre-staging-local'
const localHosts = new Set(['127.0.0.1', '::1', 'host.docker.internal', 'localhost'])
const remoteOnlyEnvironmentNames = new Set([
  'CONFIRM_MANAGED_VTT_SMOKE',
  'MANAGED_LIVE_SESSION_ENDPOINT',
  'MANAGED_VTT_BASE_URL',
  'NETLIFY_AUTH_TOKEN',
  'NETLIFY_SITE_ID',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_DSN',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_PROJECT_REF',
  'VITE_SENTRY_DSN'
])
const optionalLocalUrlNames = [
  'APP_E2E_BASE_URL',
  'LIVE_SESSION_EXECUTOR_URL',
  'MANAGED_LIVE_SESSION_ENDPOINT',
  'SITE_URL',
  'VITE_LIVE_SESSION_WEBSOCKET_URL'
]
const promotionContract = {
  localAuthority:
    'Local is the complete functional correctness environment for migrations, reset/seed/audit, generated parity, builds, types, lint, tests, PostgreSQL proofs, and end-to-end journeys.',
  production:
    'Production requires a separate approval after staging and is never a discovery environment.',
  staging: {
    approval:
      'Every bounded staging attempt requires explicit user approval immediately before execution.',
    parity:
      'Staging receives the exact locally accepted source, migrations, canonical seed shape, generated contracts, and built artifacts without staging-only fixes or overrides.',
    responseToFailure:
      'Any functional failure that local could exercise stops promotion, adds or repairs local coverage, and requires the complete local lifecycle before one new staging attempt.',
    scope:
      'One query- and egress-conscious managed-environment gate covers connection and pooler behavior, hosted Auth/RLS, Storage/Realtime/Edge/Netlify integration, secrets, TLS, packaging, and runtime parity.',
    state: 'FROZEN_PENDING_SEPARATE_USER_APPROVAL'
  }
}
const excludedArtifactPrefixes = [
  '.codex/validation/',
  '.impeccable/review/',
  '.netlify/',
  'apps/session-worker/.wrangler/',
  'apps/session-worker/dist-staging/',
  'codex/'
]
const generatedFiles = [
  'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql',
  'packages/db/src/types/supabase.database.ts'
]
const runtimeArtifactPaths = [
  '.netlify/functions-internal',
  'apps/apis/dist',
  'apps/apis/tsconfig.build.tsbuildinfo',
  'apps/session-host/dist',
  'apps/session-host/tsconfig.build.tsbuildinfo',
  'apps/session-worker/dist',
  'apps/session-worker/dist-staging',
  'apps/web/.cache/tsc',
  'apps/web/dist',
  'packages/db/dist',
  'packages/db/tsconfig.build.tsbuildinfo',
  'packages/design-system/dist',
  'packages/design-system/tsconfig.build.tsbuildinfo',
  'packages/emails/dist',
  'packages/emails/tsconfig.build.tsbuildinfo',
  'packages/functions/dist',
  'packages/functions/tsconfig.build.tsbuildinfo',
  'packages/functions/tsconfig.services.tsbuildinfo',
  'packages/functions/tsconfig.tsbuildinfo',
  'packages/schema/dist',
  'packages/schema/tsconfig.build.tsbuildinfo',
  'packages/shared/dist',
  'packages/shared/tsconfig.build.tsbuildinfo'
]
const phase08RecoveryMap = [
  {
    decision: 'KEEP',
    paths: [
      'apps/web/src/domains/campaigns/vtt/CampaignTabletop.stories.fixtures.ts',
      'apps/web/src/domains/campaigns/vtt/CampaignTabletopWindow.stories.tsx',
      'apps/web/src/domains/campaigns/vtt/liveSessionSceneState.test.ts'
    ],
    reason:
      'The retained tabletop fixtures, role-separated surface, and private Scene convergence coverage remain current and are exercised by the final local browser lifecycle.'
  },
  {
    decision: 'REIMPLEMENT',
    paths: [
      'apps/session-host/integration/localPlay.ts',
      'apps/session-host/src/dependencies.ts',
      'apps/session-host/src/liveSessionRoom.ts',
      'apps/session-host/src/sessionHost.test.ts',
      'apps/session-worker/src/liveSessionRoom.ts',
      'apps/session-worker/test/liveSessionRoom.test.ts',
      'apps/web/src/domains/campaigns/vtt/CampaignVttStage.tsx',
      'apps/web/src/domains/campaigns/vtt/liveSessionClient.test.ts',
      'apps/web/src/domains/campaigns/vtt/liveSessionClient.ts',
      'apps/web/src/domains/campaigns/vtt/useCampaignLiveSession.test.tsx',
      'apps/web/src/domains/campaigns/vtt/useCampaignLiveSession.ts',
      'packages/functions/src/services/liveSession/liveSessionExecutor.ts',
      'packages/functions/src/services/liveSession/liveSessionService.test.ts',
      'packages/functions/src/services/liveSession/liveSessionService.ts',
      'packages/schema/src/__tests__/live-session-contracts.test.ts',
      'packages/schema/src/api/liveSessions.ts',
      'docs/adr/0022-versioned-domain-documents-and-correctness-projections.md'
    ],
    reason:
      'Gate 5 reimplemented every recovery-changed live-session authority, membership, receipt, reconnect, and projection hunk on the clean aggregate-version contracts while retaining the transport and renderer foundation.'
  },
  {
    decision: 'DROP',
    paths: [
      'apps/session-host/integration/campaignContentSharePostgresProof.ts',
      'apps/session-host/integration/campaignSharedSpellCommandPostgresProof.ts',
      'apps/session-host/integration/runCampaignSharedSpellCommandPostgresProof.ts'
    ],
    reason:
      'The recovery-only proof runners and their approval-era assumptions are superseded by the accepted current-projection and direct-share Gate 2-4 runners.'
  },
  {
    decision: 'DROP',
    paths: [
      'READY.campaignContentChecksum',
      'apps/web/src/domains/campaigns/vtt/CampaignVttStage.tsx:useCampaignRealtime',
      'apps/web/src/data/campaigns/useCampaignRealtime.ts:onContentInvalidated',
      'apps/web/src/data/campaigns/useCampaignRealtime.test.tsx:onContentInvalidated'
    ],
    reason:
      'The clean protocol uses exact aggregate versions and transactional renewal; no duplicate content checksum or Realtime authorization bridge remains.'
  }
]

function parseEnvironment(source) {
  const values = {}
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[match[1]] = value
  }
  return values
}

async function loadLocalEnvironment() {
  const path = resolve(root, '.env.local')
  if (!existsSync(path)) throw new Error('Root .env.local is required.')
  const removedRemoteEnvironmentNames = new Set()
  for (const [name, value] of Object.entries(parseEnvironment(await readFile(path, 'utf8')))) {
    if (isRemoteOnlyEnvironmentName(name)) {
      removedRemoteEnvironmentNames.add(name)
      continue
    }
    if (process.env[name] === undefined) process.env[name] = value
  }

  for (const name of Object.keys(process.env)) {
    if (!isRemoteOnlyEnvironmentName(name)) continue
    delete process.env[name]
    removedRemoteEnvironmentNames.add(name)
  }

  if (process.env.MVP_AUDIT_EMAIL === undefined && process.env.MANAGED_VTT_GM_EMAIL !== undefined) {
    process.env.MVP_AUDIT_EMAIL = process.env.MANAGED_VTT_GM_EMAIL
  }
  if (
    process.env.MVP_AUDIT_PASSWORD === undefined &&
    process.env.MANAGED_VTT_GM_PASSWORD !== undefined
  ) {
    process.env.MVP_AUDIT_PASSWORD = process.env.MANAGED_VTT_GM_PASSWORD
  }

  return [...removedRemoteEnvironmentNames].sort()
}

function isRemoteOnlyEnvironmentName(name) {
  return (
    name.startsWith('NETLIFY_') ||
    name.startsWith('PROD_') ||
    name.startsWith('STAGING_') ||
    name === 'DEPLOY_PRIME_URL' ||
    name === 'DEPLOY_URL' ||
    remoteOnlyEnvironmentNames.has(name)
  )
}

function assertLoopbackUrl(name, value) {
  if (!value) throw new Error(`${name} is required for the local lifecycle.`)
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be URL-shaped.`)
  }
  if (!localHosts.has(url.hostname.toLowerCase())) {
    throw new Error(`Refusing to run against non-loopback ${name}.`)
  }
}

function assertLocalLifecycleTarget(environment = process.env) {
  assertLoopbackUrl('DATABASE_CONNECTION_STRING', environment.DATABASE_CONNECTION_STRING)
  assertLoopbackUrl('SUPABASE_URL', environment.SUPABASE_URL)
  assertLoopbackUrl('VITE_SUPABASE_URL', environment.VITE_SUPABASE_URL)
  for (const name of optionalLocalUrlNames) {
    if (environment[name]) assertLoopbackUrl(name, environment[name])
  }
  if (environment.LIVE_SESSION_ALLOWED_ORIGINS) {
    for (const value of environment.LIVE_SESSION_ALLOWED_ORIGINS.split(',')) {
      assertLoopbackUrl('LIVE_SESSION_ALLOWED_ORIGINS', value.trim())
    }
  }
  for (const name of [
    'CONFIRM_REMOTE_PUBLIC_SCHEMA_RESET',
    'CONFIRM_STAGING_PUBLIC_SCHEMA_RESET',
    'CONFIRM_PRODUCTION_PUBLIC_SCHEMA_RESET'
  ]) {
    if (environment[name]) {
      throw new Error(`${name} must not be armed during the local lifecycle.`)
    }
  }
}

function localChildEnvironment(overrides = {}) {
  const environment = { ...process.env, YARN_ENABLE_NETWORK: '0', ...overrides }
  const remoteNames = Object.keys(environment).filter(isRemoteOnlyEnvironmentName).sort()
  if (remoteNames.length > 0) {
    throw new Error(
      `Remote-only environment variables reached a local stage: ${remoteNames.join(', ')}.`
    )
  }
  assertLocalLifecycleTarget(environment)
  return environment
}

function localTargetMetadata(name, value) {
  const url = new URL(value)
  return { host: url.hostname, name, port: url.port || null, protocol: url.protocol }
}

function run(command, args, { environment = {}, logPath }) {
  return new Promise((resolveRun, rejectRun) => {
    const childEnvironment = localChildEnvironment(environment)
    const useCorepackYarn = process.platform === 'win32' && command === 'yarn'
    const executable = useCorepackYarn ? process.execPath : command
    const spawnArgs = useCorepackYarn
      ? [resolve(dirname(process.execPath), 'node_modules/corepack/dist/yarn.js'), ...args]
      : args
    const log = createWriteStream(logPath, { flags: 'a' })
    const child = spawn(executable, spawnArgs, {
      cwd: root,
      env: childEnvironment,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let settled = false
    let logFailure = null
    const settle = async (error) => {
      if (settled) return
      settled = true
      log.end()
      try {
        await finished(log)
      } catch (logError) {
        rejectRun(logError)
        return
      }
      if (error) rejectRun(error)
      else resolveRun()
    }
    child.stdout.pipe(log, { end: false })
    child.stderr.pipe(log, { end: false })
    log.once('error', (error) => {
      logFailure = error
      if (child.exitCode === null) child.kill()
    })
    child.once('error', (error) => void settle(error))
    child.once(
      'close',
      (code, signal) =>
        void settle(
          logFailure ??
            (code === 0
              ? null
              : new Error(`${command} ${args.join(' ')} failed (${signal ?? `exit ${code}`}).`))
        )
    )
  })
}

function redactSensitiveOutput(value) {
  return value
    .replace(
      /("(?:ANON_KEY|JWT_SECRET|PUBLISHABLE_KEY|S3_PROTOCOL_ACCESS_KEY_ID|S3_PROTOCOL_ACCESS_KEY_SECRET|SECRET_KEY|SERVICE_ROLE_KEY)"\s*:\s*)"[^"]*"/gu,
      '$1"[REDACTED]"'
    )
    .replace(/((?:https?|postgres(?:ql)?):\/\/)[^@\s"]+@/giu, '$1[REDACTED]@')
}

function runSanitized(command, args, { environment = {}, logPath }) {
  return new Promise((resolveRun, rejectRun) => {
    const childEnvironment = localChildEnvironment(environment)
    const useCorepackYarn = process.platform === 'win32' && command === 'yarn'
    const executable = useCorepackYarn ? process.execPath : command
    const spawnArgs = useCorepackYarn
      ? [resolve(dirname(process.execPath), 'node_modules/corepack/dist/yarn.js'), ...args]
      : args
    const child = spawn(executable, spawnArgs, {
      cwd: root,
      env: childEnvironment,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const chunks = []
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => chunks.push(chunk))
    child.once('error', rejectRun)
    child.once('close', async (code, signal) => {
      try {
        await writeFile(logPath, redactSensitiveOutput(Buffer.concat(chunks).toString('utf8')), {
          flag: 'a'
        })
      } catch (error) {
        rejectRun(error)
        return
      }
      if (code === 0) resolveRun()
      else
        rejectRun(new Error(`${command} ${args.join(' ')} failed (${signal ?? `exit ${code}`}).`))
    })
  })
}

async function gitOutput(...args) {
  const chunks = []
  await new Promise((resolveGit, rejectGit) => {
    const child = spawn('git', args, {
      cwd: root,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => chunks.push(chunk))
    child.once('error', rejectGit)
    child.once('close', (code) =>
      code === 0 ? resolveGit() : rejectGit(new Error(`git ${args.join(' ')} failed.`))
    )
  })
  return Buffer.concat(chunks)
}

async function git(...args) {
  return (await gitOutput(...args)).toString('utf8').trimEnd()
}

function isExcludedArtifact(path) {
  const normalized = path.replaceAll('\\', '/')
  return excludedArtifactPrefixes.some(
    (prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)
  )
}

function checksum(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function fileChecksums(paths) {
  return Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => [path, checksum(await readFile(resolve(root, path)))])
    )
  )
}

async function sourceIdentity() {
  const [head, branch, rawStatus, trackedPatch, rawUntracked] = await Promise.all([
    git('rev-parse', 'HEAD'),
    git('branch', '--show-current'),
    git('status', '--porcelain=v1', '--untracked-files=all'),
    gitOutput('diff', '--binary', 'HEAD', '--'),
    git('ls-files', '--others', '--exclude-standard')
  ])
  const status = rawStatus
    .split(/\r?\n/u)
    .filter(Boolean)
    .filter((entry) => !isExcludedArtifact(entry.slice(3)))
    .join('\n')
  const untrackedSourcePaths = rawUntracked
    .split(/\r?\n/u)
    .filter(Boolean)
    .filter((path) => !isExcludedArtifact(path))
    .sort()
  const untrackedHash = createHash('sha256')
  for (const path of untrackedSourcePaths) {
    untrackedHash.update(`\0${path}\0`)
    untrackedHash.update(await readFile(resolve(root, path)))
  }
  const trackedPatchChecksum = checksum(trackedPatch)
  const untrackedSourceChecksum = untrackedHash.digest('hex')
  return {
    branch,
    head,
    excludedArtifactPrefixes,
    statusChecksum: checksum(status),
    status,
    trackedPatchChecksum,
    untrackedSourceChecksum,
    untrackedSourceFileCount: untrackedSourcePaths.length,
    workingTreeChecksum: checksum(`${head}\0${trackedPatchChecksum}\0${untrackedSourceChecksum}`)
  }
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
}

function stage(name, label, command, args, environment) {
  return { args, command, environment, label, name }
}

function changedPathFromStatus(entry) {
  const path = entry.slice(3)
  return path.includes(' -> ') ? path.split(' -> ').at(-1) : path
}

function acceptedChangedPaths(status) {
  return status
    .split(/\r?\n/u)
    .filter(Boolean)
    .map(changedPathFromStatus)
    .filter(Boolean)
    .filter((path) => !isExcludedArtifact(path))
    .sort()
}

async function cleanRuntimeArtifacts(logPath) {
  const results = []
  for (const path of runtimeArtifactPaths) {
    const target = resolve(root, path)
    const relativeTarget = relative(root, target)
    if (relativeTarget.startsWith('..') || isAbsolute(relativeTarget)) {
      throw new Error(`Refusing to clean an artifact outside the repository: ${path}`)
    }
    const existed = existsSync(target)
    await rm(target, { force: true, recursive: true })
    results.push({ existed, path, removed: !existsSync(target) })
  }
  await writeFile(logPath, `${JSON.stringify({ results })}\n`)
}

async function collectWarningCounts(artifactDirectory, completedStages) {
  const warnings = []
  for (const { log, name } of completedStages) {
    const path = resolve(artifactDirectory, log)
    if (!existsSync(path)) continue
    const count = (await readFile(path, 'utf8'))
      .split(/\r?\n/u)
      .filter((line) => /\bwarn(?:ing)?s?\b/iu.test(line) && !/\b0 warnings?\b/iu.test(line)).length
    if (count > 0) warnings.push({ detectedLineCount: count, stage: name })
  }
  return warnings
}

const stages = [
  stage('supabase-status', 'Local Supabase status', 'yarn', ['supabase', 'status']),
  stage('bootstrap-bundle', 'Generate database bootstrap bundle', 'yarn', [
    'workspace',
    '@artificer-toolkit/db',
    'generate:bootstrap-bundle'
  ]),
  stage('database-reset', 'Reset local Supabase', 'yarn', ['supabase', 'db', 'reset', '--local']),
  stage('migration-parity', 'Require exact local migration parity', 'node', [
    'scripts/verifyLocalMigrationParity.mjs'
  ]),
  stage('database-types', 'Generate local Supabase types', 'yarn', [
    'workspace',
    '@artificer-toolkit/db',
    'gen:types'
  ]),
  stage('generated-parity', 'Require generated artifact byte parity', 'internal', [
    'verify-generated-artifacts-unchanged'
  ]),
  stage('format-check', 'Accepted working-tree format check', 'internal', [
    'verify-accepted-format'
  ]),
  stage('diff-check', 'Working-tree whitespace error check', 'git', [
    'diff',
    '--check',
    'HEAD',
    '--'
  ]),
  stage('clean-runtime-artifacts', 'Clean exact runtime and incremental artifacts', 'internal', [
    'clean-runtime-artifacts'
  ]),
  stage('build', 'Forced serial workspace build', 'yarn', [
    'turbo',
    'run',
    'build',
    '--force',
    '--concurrency=1'
  ]),
  stage('netlify-typecheck', 'Netlify typecheck', 'yarn', ['typecheck:netlify']),
  stage('typecheck', 'Forced serial workspace typecheck', 'yarn', [
    'turbo',
    'run',
    'typecheck',
    '--force',
    '--concurrency=1'
  ]),
  stage('lint', 'Repository lint', 'yarn', ['lint']),
  stage('schema-tests', 'Schema tests', 'yarn', ['workspace', '@artificer-toolkit/schema', 'test']),
  stage('shared-tests', 'Shared tests', 'yarn', ['workspace', '@artificer-toolkit/shared', 'test']),
  stage('db-tests', 'Database tests', 'yarn', ['workspace', '@artificer-toolkit/db', 'test']),
  stage('functions-tests', 'Functions tests', 'yarn', [
    'workspace',
    '@artificer-toolkit/functions',
    'test'
  ]),
  stage('apis-tests', 'API tests', 'yarn', ['workspace', '@artificer-toolkit/apis', 'test']),
  stage('design-system-tests', 'Design system tests', 'yarn', [
    'workspace',
    '@artificer-toolkit/design-system',
    'test'
  ]),
  stage('emails-tests', 'Email tests', 'yarn', ['workspace', '@artificer-toolkit/emails', 'test']),
  stage('session-worker-tests', 'Session Worker tests', 'yarn', [
    'workspace',
    '@artificer-toolkit/session-worker',
    'test'
  ]),
  stage('session-host-tests', 'Session Host tests', 'yarn', [
    'workspace',
    '@artificer-toolkit/session-host',
    'test'
  ]),
  stage('web-unit-tests-1', 'Web unit tests shard 1 of 4', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'test',
    '--maxWorkers=1',
    '--no-file-parallelism',
    '--shard=1/4'
  ]),
  stage('web-unit-tests-2', 'Web unit tests shard 2 of 4', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'test',
    '--maxWorkers=1',
    '--no-file-parallelism',
    '--shard=2/4'
  ]),
  stage('web-unit-tests-3', 'Web unit tests shard 3 of 4', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'test',
    '--maxWorkers=1',
    '--no-file-parallelism',
    '--shard=3/4'
  ]),
  stage('web-unit-tests-4', 'Web unit tests shard 4 of 4', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'test',
    '--maxWorkers=1',
    '--no-file-parallelism',
    '--shard=4/4'
  ]),
  stage('web-typecheck-tests', 'Web test typecheck', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'typecheck:tests'
  ]),
  stage('web-typecheck-stories', 'Web Storybook typecheck', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'typecheck:stories'
  ]),
  stage('web-typecheck-config', 'Web configuration typecheck', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'typecheck:config'
  ]),
  stage('web-storybook-tests', 'Web Storybook tests', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'test:storybook'
  ]),
  stage('netlify-tests', 'Netlify function tests', 'yarn', [
    'vitest',
    'run',
    '--config',
    'vitest.config.ts',
    'netlify/tests',
    '--maxWorkers=1',
    '--no-file-parallelism'
  ]),
  stage('seed-and-audit', 'Seed local SRD and canonical rules', 'yarn', ['seed:srd:local']),
  stage('srd-audit-after-seed', 'Audit freshly seeded local SRD', 'yarn', ['audit:srd']),
  stage('srd-integration', 'SRD integration', 'yarn', ['test:srd:integration']),
  stage('character-integration', 'Character lifecycle integration', 'yarn', [
    'test:character:integration'
  ]),
  stage('character-sheet-integration', 'Character Sheet integration', 'yarn', [
    'test:character-sheet:integration'
  ]),
  stage('authored-rate-limit-integration', 'Authored creation rate-limit integration', 'yarn', [
    'workspace',
    '@artificer-toolkit/db',
    'test:authored-creation-rate-limit:integration'
  ]),
  stage('social-hub-integration', 'Social Hub integration', 'yarn', [
    'test:social-hub:integration'
  ]),
  stage('campaign-announcement-integration', 'Campaign announcement integration', 'yarn', [
    'test:campaign-announcement:integration'
  ]),
  stage('notifications-integration', 'Notifications integration', 'yarn', [
    'test:notifications:integration'
  ]),
  stage('vtt-map-integration', 'VTT map integration', 'yarn', ['test:vtt-map:integration']),
  stage('session-host-integration-typecheck', 'Session Host integration typecheck', 'yarn', [
    'workspace',
    '@artificer-toolkit/session-host',
    'typecheck:integration'
  ]),
  stage('character-caster-postgres', 'Representative Character caster PostgreSQL proof', 'yarn', [
    'tsx',
    'apps/session-host/integration/characterCasterLifecyclePostgresProof.ts'
  ]),
  stage(
    'authored-current-catalog-postgres',
    'Authored current projection catalog PostgreSQL proof',
    'yarn',
    [
      'tsx',
      'apps/session-host/integration/runAuthoredCurrentProjectionPostgresProof.ts',
      '--group=catalog'
    ]
  ),
  stage(
    'authored-current-mechanics-postgres',
    'Authored current projection mechanics PostgreSQL proof',
    'yarn',
    [
      'tsx',
      'apps/session-host/integration/runAuthoredCurrentProjectionPostgresProof.ts',
      '--group=mechanics'
    ]
  ),
  stage(
    'authored-current-concurrency-postgres',
    'Authored current projection concurrency PostgreSQL proof',
    'yarn',
    [
      'tsx',
      'apps/session-host/integration/runAuthoredCurrentProjectionPostgresProof.ts',
      '--group=concurrency'
    ]
  ),
  stage(
    'campaign-share-foundation-postgres',
    'Campaign direct-share foundation PostgreSQL proof',
    'yarn',
    ['tsx', 'apps/session-host/integration/runCampaignContentShareFoundationPostgresProof.ts']
  ),
  ...['unshare', 'membership', 'vehicle', 'activation', 'deletion'].map((group) =>
    stage(
      `campaign-share-${group}-postgres`,
      `Campaign direct-share ${group} PostgreSQL proof`,
      'yarn',
      [
        'tsx',
        'apps/session-host/integration/runCampaignContentShareRemovalPostgresProof.ts',
        `--group=${group}`
      ]
    )
  ),
  stage(
    'campaign-gate4-closeout-postgres',
    'Campaign/Social/Notifications/Media PostgreSQL closeout proof',
    'yarn',
    ['tsx', 'apps/session-host/integration/runCampaignGate4CloseoutPostgresProof.ts']
  ),
  stage(
    'phase-8-1-postgres',
    'Phase 8.1 lifecycle, replay, rollback, concurrency, privacy, and cleanup proof',
    'yarn',
    ['workspace', '@artificer-toolkit/session-host', 'proof:phase-8-1:local']
  ),
  stage('authored-projection-verify-pre-vtt', 'Verify local authored projections', 'yarn', [
    'workspace',
    '@artificer-toolkit/functions',
    'projections:verify:authored:local'
  ]),
  stage('character-projection-verify-pre-vtt', 'Verify local Character projections', 'yarn', [
    'workspace',
    '@artificer-toolkit/functions',
    'projections:verify:characters:local'
  ]),
  stage(
    'vtt-provision',
    'Provision local managed VTT fixture',
    'yarn',
    ['provision:vtt-managed-smoke:local'],
    { CONFIRM_MANAGED_VTT_SMOKE_PROVISION: 'provision-managed-vtt-smoke' }
  ),
  stage('web-e2e', 'Web end-to-end suite', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'test:e2e'
  ]),
  stage('vtt-host', 'Local authoritative VTT host gate', 'yarn', ['test:session-host:local']),
  stage('vtt-browser', 'Local exact browser VTT gate', 'yarn', ['test:web:e2e:vtt-local']),
  stage('vtt-load', 'Local VTT renderer load gate', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'test:e2e:vtt-load'
  ]),
  stage('authored-projection-verify-post-vtt', 'Reverify local authored projections', 'yarn', [
    'workspace',
    '@artificer-toolkit/functions',
    'projections:verify:authored:local'
  ]),
  stage('character-projection-verify-post-vtt', 'Reverify local Character projections', 'yarn', [
    'workspace',
    '@artificer-toolkit/functions',
    'projections:verify:characters:local'
  ]),
  stage('srd-audit-post-vtt', 'Reaudit local SRD', 'yarn', ['audit:srd'])
]

function auditLocalStageCommands() {
  const forbiddenTokens = []
  for (const current of stages) {
    for (const token of [current.command, ...current.args]) {
      if (
        /(?:^|:)(?:staging|production)(?::|$)/iu.test(token) ||
        /(?:^|:)deploy(?::|$)/iu.test(token) ||
        /^--(?:linked|project-ref|remote|staging|production)$/iu.test(token)
      ) {
        forbiddenTokens.push({ stage: current.name, token })
      }
    }
  }
  if (forbiddenTokens.length > 0) {
    throw new Error('The local lifecycle includes a hosted or deployment command token.')
  }
  return { hostedOperationCount: 0, reviewedStageCount: stages.length }
}

function sanitizeLogExcerpt(value) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/giu, '[REDACTED_CONNECTION_STRING]')
    .replace(
      /\b(?:access[_-]?token|api[_-]?key|password|secret|token)\s*[:=]\s*[^\s'"`]+/giu,
      (match) => {
        const separator = match.search(/[:=]/u)
        return `${match.slice(0, separator + 1)} [REDACTED]`
      }
    )
}

async function failureExcerpt(logPath) {
  const contents = await readFile(logPath, 'utf8').catch(() => '')
  return sanitizeLogExcerpt(contents.slice(-2000)).trim()
}

async function main() {
  const listing = process.argv.includes('--list')
  if (listing) {
    for (const [index, current] of stages.entries()) {
      console.log(`${index + 1}. ${current.name}: ${current.label}`)
      console.log(`   ${current.command} ${current.args.join(' ')}`)
    }
    console.log(
      `${stages.length + 1}. vtt-hardware (optional): existing hardware gate when PRE_STAGING_INCLUDE_VTT_HARDWARE=1`
    )
    console.log('   VTT_HARDWARE_FPS_GATE=1 yarn test:web:e2e:vtt-load:hardware')
    return
  }

  const startAtArgument = process.argv.find((argument) => argument.startsWith('--start-at='))
  const provenanceArgument = process.argv.find((argument) =>
    argument.startsWith('--provenance-manifest=')
  )
  const startAt = startAtArgument?.slice('--start-at='.length)
  const provenanceManifestPath = provenanceArgument?.slice('--provenance-manifest='.length)
  const reuseDatabaseEvidence = process.argv.includes('--reuse-database-evidence')
  if (Boolean(startAt) !== Boolean(provenanceManifestPath)) {
    throw new Error('--start-at and --provenance-manifest must be provided together.')
  }
  if (reuseDatabaseEvidence && !startAt) {
    throw new Error('--reuse-database-evidence requires a resumed lifecycle.')
  }
  const requestedStartIndex = startAt ? stages.findIndex(({ name }) => name === startAt) : 0
  if (requestedStartIndex < 0) throw new Error(`Unknown resume stage: ${startAt}.`)

  const removedRemoteEnvironmentNames = await loadLocalEnvironment()
  assertLocalLifecycleTarget()
  const commandAudit = auditLocalStageCommands()
  const databaseResetIndex = stages.findIndex(({ name }) => name === 'database-reset')
  if (
    requestedStartIndex <= databaseResetIndex &&
    process.env.CONFIRM_PRE_STAGING_LOCAL_RESET !== confirmation
  ) {
    throw new Error(
      `Set CONFIRM_PRE_STAGING_LOCAL_RESET=${confirmation} in the environment or .env.local.`
    )
  }

  const artifactDirectory = resolve(
    root,
    process.env.PRE_STAGING_VALIDATION_DIR ??
      `.codex/validation/pre-staging-lifecycle/${timestamp()}`
  )
  await mkdir(artifactDirectory, { recursive: true })
  const manifestPath = resolve(artifactDirectory, 'manifest.json')
  const generatedBaseline = await fileChecksums(generatedFiles)
  const packageMetadata = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  const sourceStart = await sourceIdentity()
  let selectedStages = stages
  let provenance = null
  let provenanceStageLogPaths = new Map()
  if (startAt && provenanceManifestPath) {
    const visitedProvenance = new Set()
    const loadProvenanceChain = async (manifestPath) => {
      const resolvedPath = resolve(root, manifestPath)
      const relativePath = relative(root, resolvedPath).replaceAll('\\', '/')
      if (
        relativePath.startsWith('..') ||
        isAbsolute(relativePath) ||
        !relativePath.startsWith('.codex/validation/')
      ) {
        throw new Error('The provenance manifest must be retained under .codex/validation/.')
      }
      if (visitedProvenance.has(relativePath)) {
        throw new Error('The provenance manifest chain contains a cycle.')
      }
      visitedProvenance.add(relativePath)
      const current = JSON.parse(await readFile(resolvedPath, 'utf8'))
      if (
        current.source?.start?.branch !== sourceStart.branch ||
        current.source?.start?.head !== sourceStart.head
      ) {
        throw new Error('The provenance manifest does not match the current branch and HEAD.')
      }
      const inherited = current.provenance?.manifest
        ? await loadProvenanceChain(current.provenance.manifest)
        : []
      return [
        ...inherited,
        ...(current.stages ?? []).map((stage) => ({
          ...stage,
          artifactDirectory: current.artifactDirectory ?? dirname(resolvedPath)
        }))
      ]
    }
    const resolvedProvenancePath = resolve(root, provenanceManifestPath)
    const relativeProvenancePath = relative(root, resolvedProvenancePath).replaceAll('\\', '/')
    const prior = JSON.parse(await readFile(resolvedProvenancePath, 'utf8'))
    const recordedStages = await loadProvenanceChain(provenanceManifestPath)
    const recordedByName = new Map(recordedStages.map((stage) => [stage.name, stage]))
    provenanceStageLogPaths = new Map(
      recordedStages
        .filter((stage) => stage.status === 'passed' && stage.log)
        .map((stage) => [stage.name, resolve(stage.artifactDirectory, stage.log)])
    )
    const requiredPriorStages = stages.slice(0, requestedStartIndex)
    for (const required of requiredPriorStages) {
      const recorded = recordedByName.get(required.name)
      if (recorded?.status !== 'passed') {
        throw new Error(`The provenance manifest does not prove passed stage ${required.name}.`)
      }
    }
    selectedStages = stages.slice(requestedStartIndex)
    const retainedDatabaseStages = reuseDatabaseEvidence
      ? ['seed-and-audit', 'srd-audit-after-seed', 'srd-audit-post-vtt']
      : []
    selectedStages = selectedStages.filter(({ name }) => !retainedDatabaseStages.includes(name))
    provenance = {
      acceptedPassedStageCount: requiredPriorStages.length,
      manifest: relativeProvenancePath,
      priorWorkingTreeChecksum: prior.source.start.workingTreeChecksum,
      retainedDatabaseStages,
      resumeFromStage: startAt
    }
  }
  const manifest = {
    artifactDirectory,
    environment: {
      architecture: process.arch,
      localTargets: [
        localTargetMetadata('DATABASE_CONNECTION_STRING', process.env.DATABASE_CONNECTION_STRING),
        localTargetMetadata('SUPABASE_URL', process.env.SUPABASE_URL),
        localTargetMetadata('VITE_SUPABASE_URL', process.env.VITE_SUPABASE_URL),
        ...optionalLocalUrlNames
          .filter((name) => process.env[name])
          .map((name) => localTargetMetadata(name, process.env[name]))
      ],
      nodeVersion: process.version,
      packageManager: packageMetadata.packageManager,
      platform: process.platform,
      remoteAccessFreeze: {
        commandAudit,
        removedRemoteEnvironmentNames,
        stagingState: 'UNTOUCHED_AND_FROZEN',
        target: 'LOCAL_LOOPBACK_ONLY'
      },
      target: 'LOCAL_LOOPBACK_ONLY'
    },
    phase08RecoveryMap,
    promotionContract,
    provenance,
    startedAt: new Date().toISOString(),
    source: { start: sourceStart },
    stages: []
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  for (const current of selectedStages) {
    assertLocalLifecycleTarget()
    const logPath = resolve(artifactDirectory, `${current.name}.log`)
    const stageStart = Date.now()
    const entry = {
      command: [current.command, ...current.args],
      name: current.name,
      label: current.label,
      startedAt: new Date().toISOString(),
      status: 'running',
      log: basename(logPath)
    }
    manifest.stages.push(entry)
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`[pre-staging] ${current.label}`)
    try {
      if (current.name === 'generated-parity') {
        const generatedCurrent = await fileChecksums(generatedFiles)
        await writeFile(
          logPath,
          `${JSON.stringify({
            files: generatedFiles,
            generatedBaseline,
            generatedCurrent,
            matches: JSON.stringify(generatedBaseline) === JSON.stringify(generatedCurrent)
          })}\n`
        )
        if (JSON.stringify(generatedBaseline) !== JSON.stringify(generatedCurrent)) {
          throw new Error('Generated artifacts changed after canonical regeneration.')
        }
      } else if (current.name === 'supabase-status') {
        await runSanitized(current.command, current.args, {
          logPath,
          environment: current.environment
        })
      } else if (current.name === 'format-check') {
        const changedPaths = acceptedChangedPaths(manifest.source.start.status).filter(
          (path) => !generatedFiles.includes(path)
        )
        const oxfmtPaths = changedPaths.filter((path) =>
          /\.(?:js|jsx|md|mjs|mts|ts|tsx)$/iu.test(path)
        )
        const sqlPaths = changedPaths.filter(
          (path) =>
            path.endsWith('.sql') &&
            !generatedFiles.includes(path) &&
            path !== 'packages/db/src/domains/utils/create_database.sql' &&
            path !== 'supabase/migrations/20260825061000_campaign_catalogue_content_binding.sql'
        )
        await writeFile(logPath, `${JSON.stringify({ oxfmtPaths, sqlPaths })}\n`)
        for (let index = 0; index < oxfmtPaths.length; index += 50) {
          await run('yarn', ['oxfmt', '--check', ...oxfmtPaths.slice(index, index + 50)], {
            logPath
          })
        }
        if (sqlPaths.length > 0) {
          await run(
            'yarn',
            [
              'prettier',
              '--plugin',
              'prettier-plugin-sql-cst',
              '--parser',
              'postgresql',
              '--check',
              ...sqlPaths
            ],
            { logPath }
          )
        }
      } else if (current.name === 'clean-runtime-artifacts') {
        await cleanRuntimeArtifacts(logPath)
      } else {
        await run(current.command, current.args, {
          logPath,
          environment: current.environment
        })
      }
      entry.status = 'passed'
      entry.completedAt = new Date().toISOString()
      entry.durationMs = Date.now() - stageStart
    } catch {
      entry.status = 'failed'
      entry.completedAt = new Date().toISOString()
      entry.durationMs = Date.now() - stageStart
      entry.error = 'Command failed; inspect the stage log.'
      manifest.completedAt = entry.completedAt
      manifest.status = 'failed'
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      const excerpt = await failureExcerpt(logPath)
      console.error(`[pre-staging] FAILED: ${current.label}; see ${logPath}`)
      if (excerpt) console.error(excerpt)
      process.exitCode = 1
      return
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }

  if (process.env.PRE_STAGING_INCLUDE_VTT_HARDWARE === '1') {
    assertLocalLifecycleTarget()
    const name = 'vtt-hardware'
    const logPath = resolve(artifactDirectory, `${name}.log`)
    const stageStart = Date.now()
    const entry = {
      command: ['yarn', 'test:web:e2e:vtt-load:hardware'],
      name,
      label: 'Optional VTT hardware gate',
      startedAt: new Date().toISOString(),
      status: 'running',
      log: basename(logPath)
    }
    manifest.stages.push(entry)
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log('[pre-staging] Optional VTT hardware gate')
    try {
      await run('yarn', ['test:web:e2e:vtt-load:hardware'], {
        logPath,
        environment: { VTT_HARDWARE_FPS_GATE: '1' }
      })
      entry.status = 'passed'
      entry.completedAt = new Date().toISOString()
      entry.durationMs = Date.now() - stageStart
    } catch {
      entry.status = 'failed'
      entry.completedAt = new Date().toISOString()
      entry.durationMs = Date.now() - stageStart
      entry.error = 'Command failed; inspect the stage log.'
      manifest.completedAt = entry.completedAt
      manifest.status = 'failed'
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      const excerpt = await failureExcerpt(logPath)
      console.error(`[pre-staging] FAILED: ${entry.label}; see ${logPath}`)
      if (excerpt) console.error(excerpt)
      process.exitCode = 1
      return
    }
  }

  try {
    const end = await sourceIdentity()
    manifest.source.end = end
    if (JSON.stringify(manifest.source.start) !== JSON.stringify(end)) {
      manifest.source.error = 'Source identity changed during validation.'
      throw new Error(
        'Source identity changed during validation; inspect the manifest before staging.'
      )
    }
    const currentHostLogPath = resolve(artifactDirectory, 'vtt-host.log')
    const hostLogPath = existsSync(currentHostLogPath)
      ? currentHostLogPath
      : provenanceStageLogPaths.get('vtt-host')
    if (!hostLogPath) throw new Error('The local VTT host log was not retained in the lifecycle.')
    const hostLog = await readFile(hostLogPath, 'utf8')
    const hostResult = hostLog
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('{') && line.includes('"hostMode"'))
      .map((line) => JSON.parse(line))
      .at(-1)
    if (!hostResult?.timings) {
      throw new Error('The local VTT host log did not contain bounded performance metrics.')
    }
    manifest.performance = {
      coldCommandReady: {
        budgetMs: 500,
        observedMs: hostResult.timings.coldCommandMs,
        passed: hostResult.timings.coldCommandMs < 500
      },
      ruleBoundHostP95: {
        budgetMs: 250,
        observedMs: hostResult.timings.ruleBoundHostP95Ms,
        passed: hostResult.timings.ruleBoundHostP95Ms < 250
      },
      sceneOnlyHostP95: {
        budgetMs: 100,
        observedMs: hostResult.timings.sceneHostP95Ms,
        passed: hostResult.timings.sceneHostP95Ms < 100
      }
    }
    if (Object.values(manifest.performance).some(({ passed }) => !passed)) {
      throw new Error('One or more retained local VTT performance budgets failed.')
    }
    manifest.warnings = await collectWarningCounts(artifactDirectory, manifest.stages)
    manifest.completedAt = new Date().toISOString()
    manifest.releaseReadiness = 'READY_TO_RESUME_VTT_EXPANSION'
    manifest.status = 'passed'
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`[pre-staging] PASSED: ${artifactDirectory}`)
  } catch (error) {
    manifest.completedAt = new Date().toISOString()
    manifest.finalizationError = error instanceof Error ? error.message : String(error)
    manifest.releaseReadiness = 'NOT_READY'
    manifest.status = 'failed'
    manifest.warnings = await collectWarningCounts(artifactDirectory, manifest.stages)
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    throw error
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
