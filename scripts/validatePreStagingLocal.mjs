import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { createConnection } from 'node:net'
import { finished } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'
import { verifyBuilderBudgets } from './builderBudgets.mjs'
import { verifyV15Budgets } from './v15Budgets.mjs'
import { generatedStatus } from './generatedDrift.mjs'
import {
  assertConvexInstance,
  assertLoopbackUrl,
  convexCliArguments,
  convexCliEnvironment,
  convexDeployArguments,
  generateAdminKey,
  localConvex,
  yarnSpawn
} from './convexSelfHosted.mjs'

const root = resolve(import.meta.dirname, '..')
// The local Docker deployment (localConvex) is shared with scripts/resetLocalConvex.ps1 and scripts/runLocalConvexProof.ps1.
// The documented local Session Worker (apps/session-worker README). Proofs that send Encounter
// commands or open the tabletop need it. The VTT browser proof starts its own Worker on this port
// (apps/web/playwright.local-vtt.config.ts), so the lifecycle stops its Worker before that stage.
export const selfManagedBrowserProof = 'vtt-browser'
const localSessionWorker = {
  allowedOrigins: 'http://localhost:3000,http://127.0.0.1:3000',
  host: '127.0.0.1',
  port: 8787,
  secretNames: [
    'LIVE_SESSION_TICKET_SECRET',
    'LIVE_SESSION_WORKER_SECRET',
    'CONTENT_SNAPSHOT_TOKEN_SECRET'
  ]
}
// The browser proofs open the web app here; the VTT browser proof starts its own on the same port.
const localWebApp = { port: 3000 }
// Application secrets loaded from the local environment files; the Worker child does not receive them.
const loadedEnvironmentNames = new Set()
export const localEnvironmentDefault = 'local-validation/local-convex/local.application.env'
const localProofDirectory = 'local-validation/local-convex-proofs'
const localResetDirectory = 'local-validation/convex-reset'
const remoteOnlyEnvironmentNames = new Set([
  'CLOUDFLARE_API_TOKEN',
  'CONFIRM_MANAGED_VTT_SMOKE',
  'MANAGED_LIVE_SESSION_ENDPOINT',
  'MANAGED_VTT_BASE_URL',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_DSN',
  'VITE_SENTRY_DSN'
])
const requiredLocalUrlNames = [
  'CONVEX_SITE_URL',
  'CONVEX_URL',
  'CONVEX_SELF_HOSTED_URL',
  'VITE_CONVEX_URL'
]
const optionalLocalUrlNames = [
  'APP_E2E_BASE_URL',
  'SITE_URL',
  'VITE_LIVE_SESSION_WEBSOCKET_URL',
  'VITE_MEDIA_STORAGE_ORIGIN'
]
const promotionContract = {
  localAuthority:
    'Local is the complete functional correctness environment for native Convex generation, fresh outputs, package checks, canonical seed/audit, transaction/replay/rollback/privacy proofs, and end-to-end journeys.',
  production:
    'Production requires a separate approval after staging and is never a discovery environment.',
  staging: {
    approval:
      'Every bounded staging attempt requires explicit user approval immediately before execution.',
    parity:
      'Staging receives the exact locally accepted source, canonical seed shape, generated contracts, and built artifacts without staging-only fixes or overrides.',
    responseToFailure:
      'Any functional failure that local could exercise stops promotion, adds or repairs local coverage, and requires the complete local lifecycle before one new staging attempt.',
    scope:
      'One bounded managed-environment gate covers deployment packaging, managed secrets, external integrations, permissions, real network behavior, and managed performance.',
    state: 'FROZEN_PENDING_SEPARATE_USER_APPROVAL'
  }
}
const excludedArtifactPrefixes = [
  '.codex/validation/',
  '.impeccable/review/',
  'local-validation/',
  'apps/session-worker/.wrangler/',
  'apps/session-worker/dist-staging/',
  'codex/'
]
const generatedFiles = [
  'apps/apis/convex/_generated/api.d.ts',
  'apps/apis/convex/_generated/api.js',
  'apps/apis/convex/_generated/dataModel.d.ts',
  'apps/apis/convex/_generated/server.d.ts',
  'apps/apis/convex/_generated/server.js',
  'apps/apis/convex/betterAuth/schema.ts'
]
// Where codegen writes: a file it newly adds there is untracked, so only the status of these roots sees it.
const generatedRoots = [
  'apps/apis/convex/_generated',
  'apps/apis/convex/betterAuth/_generated',
  'apps/apis/convex/betterAuth/schema.ts'
]
const runtimeArtifactPaths = [
  'apps/apis/dist',
  'apps/apis/tsconfig.build.tsbuildinfo',
  'apps/session-worker/dist',
  'apps/session-worker/dist-staging',
  'apps/web/.cache/tsc',
  'apps/web/dist',
  'packages/authoring/dist',
  'packages/authoring/tsconfig.build.tsbuildinfo',
  'packages/design-system/dist',
  'packages/design-system/tsconfig.build.tsbuildinfo',
  'packages/emails/dist',
  'packages/emails/tsconfig.build.tsbuildinfo',
  'packages/encounter-persistence/dist',
  'packages/encounter-persistence/tsconfig.build.tsbuildinfo',
  'packages/rules-runtime/dist',
  'packages/rules-runtime/tsconfig.build.tsbuildinfo',
  'packages/schema/dist',
  'packages/schema/tsconfig.build.tsbuildinfo',
  'packages/shared/dist',
  'packages/shared/tsconfig.build.tsbuildinfo',
  'packages/source-data/dist',
  'packages/source-data/tsconfig.build.tsbuildinfo'
]
const phase08RecoveryMap = [
  {
    decision: 'KEEP',
    paths: [
      'apps/web/src/domains/campaigns/vtt/CampaignTabletop.stories.fixtures.ts',
      'apps/web/src/domains/campaigns/vtt/CampaignTabletopWindow.stories.tsx'
    ],
    reason:
      'The retained tabletop fixtures and role-separated surface remain current and are exercised by the final native browser lifecycle.'
  },
  {
    decision: 'REIMPLEMENT',
    paths: [
      'apps/apis/convex/liveSessions',
      'apps/session-worker/src/durableCommandJournal.ts',
      'apps/session-worker/src/nativeLiveSessionRoom.ts',
      'apps/session-worker/src/nativeLiveSessionState.ts',
      'apps/web/src/domains/campaigns/vtt/liveSessionClient.ts',
      'apps/web/src/domains/campaigns/vtt/useCampaignLiveSession.ts',
      'packages/schema/src/api/liveSessionState.ts',
      'packages/schema/src/api/liveSessions.ts'
    ],
    reason:
      'The Session Durable Object is the active live-command authority: one SQLite transaction commits live state, the replay receipt and the ordered publication outbox before broadcast. Convex remains the durable product store and independently verifies each ordered publication for subscriptions and reconnect recovery.'
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
      'The native protocol uses exact aggregate versions and transactional renewal; no duplicate content checksum or authorization bridge remains.'
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

export async function loadLocalEnvironment(localEnvironmentFile = localEnvironmentDefault) {
  const path = resolve(root, '.env.local')
  if (!existsSync(path)) throw new Error('Root .env.local is required.')
  const removedRemoteEnvironmentNames = new Set()
  for (const [name, value] of Object.entries(parseEnvironment(await readFile(path, 'utf8')))) {
    if (isRemoteOnlyEnvironmentName(name)) {
      removedRemoteEnvironmentNames.add(name)
      continue
    }
    loadedEnvironmentNames.add(name)
    if (process.env[name] === undefined) process.env[name] = value
  }

  const resolvedPath = resolve(root, localEnvironmentFile)
  const relativePath = relative(root, resolvedPath).replaceAll('\\', '/')
  if (
    relativePath.startsWith('..') ||
    isAbsolute(relativePath) ||
    !relativePath.startsWith('local-validation/')
  ) {
    throw new Error('The local environment file must be retained under local-validation/.')
  }
  if (!existsSync(resolvedPath)) {
    throw new Error(`The local environment file does not exist: ${relativePath}.`)
  }
  // Yarn injects this whole file into every child and its values override the process environment,
  // so it must not store an admin key and any remote-only name in it must hold a loopback URL.
  const source = await readFile(resolvedPath, 'utf8')
  const loopbackRemoteNames = []
  for (const [name, value] of Object.entries(parseEnvironment(source))) {
    if (name === 'CONVEX_SELF_HOSTED_ADMIN_KEY') {
      throw new Error(
        'The local environment file must not store CONVEX_SELF_HOSTED_ADMIN_KEY; it is generated at run time.'
      )
    }
    if (name === 'CONVEX_DEPLOY_KEY') {
      throw new Error('The local environment file must not store CONVEX_DEPLOY_KEY.')
    }
    if (isRemoteOnlyEnvironmentName(name)) {
      assertLoopbackUrl(name, value)
      loopbackRemoteNames.push(name)
      continue
    }
    loadedEnvironmentNames.add(name)
    process.env[name] = value
  }
  delete process.env.CONVEX_DEPLOYMENT
  delete process.env.CONVEX_DEPLOY_KEY
  process.env.YARN_INJECT_ENVIRONMENT_FILES = resolvedPath
  const localEnvironment = {
    loopbackRemoteNames: loopbackRemoteNames.sort(),
    path: relativePath,
    sha256: checksum(source)
  }

  for (const name of Object.keys(process.env)) {
    if (!isRemoteOnlyEnvironmentName(name)) continue
    delete process.env[name]
    removedRemoteEnvironmentNames.add(name)
  }

  return {
    localEnvironment,
    removedRemoteEnvironmentNames: [...removedRemoteEnvironmentNames].sort()
  }
}

function isRemoteOnlyEnvironmentName(name) {
  return (
    name.startsWith('MANAGED_') ||
    name.startsWith('PROD_') ||
    name.startsWith('STAGING_') ||
    remoteOnlyEnvironmentNames.has(name)
  )
}

export function assertLocalLifecycleTarget(environment = process.env) {
  for (const name of requiredLocalUrlNames) assertLoopbackUrl(name, environment[name])
  for (const name of optionalLocalUrlNames) {
    if (environment[name]) assertLoopbackUrl(name, environment[name])
  }
  if (environment.LIVE_SESSION_ALLOWED_ORIGINS) {
    for (const value of environment.LIVE_SESSION_ALLOWED_ORIGINS.split(',')) {
      assertLoopbackUrl('LIVE_SESSION_ALLOWED_ORIGINS', value.trim())
    }
  }
  if (
    environment.CONVEX_DEPLOYMENT &&
    !/^local:[a-z0-9][a-z0-9_-]*$/u.test(environment.CONVEX_DEPLOYMENT)
  ) {
    throw new Error('CONVEX_DEPLOYMENT may select only an explicit local deployment.')
  }
  if (new URL(environment.CONVEX_URL).href !== new URL(environment.CONVEX_SELF_HOSTED_URL).href) {
    throw new Error('CONVEX_URL and CONVEX_SELF_HOSTED_URL must identify the same local backend.')
  }
}

export async function useGeneratedLocalAdminKey() {
  const url = process.env.CONVEX_SELF_HOSTED_URL
  if (!url || new URL(url).href !== new URL(localConvex.url).href) {
    throw new Error(
      `CONVEX_SELF_HOSTED_URL must be the local Docker deployment ${localConvex.url}.`
    )
  }
  await assertConvexInstance(url, localConvex.instance)
  // Generated inside the container for this run; never written to disk or printed.
  process.env.CONVEX_SELF_HOSTED_ADMIN_KEY = generateAdminKey(localConvex.container)
}

export function localChildEnvironment(overrides = {}) {
  const environment = {
    ...convexCliEnvironment(),
    YARN_ENABLE_NETWORK: '0',
    ...overrides,
    GOMAXPROCS: '2'
  }
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

export function run(command, args, { environment = {}, logPath, sensitiveArgs = [] }) {
  return new Promise((resolveRun, rejectRun) => {
    const childEnvironment = localChildEnvironment(environment)
    const commandArgs = [...args, ...sensitiveArgs]
    const [executable, spawnArgs] =
      command === 'yarn' ? yarnSpawn(commandArgs) : [command, commandArgs]
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
              : Object.assign(
                  new Error(`${command} ${args.join(' ')} failed (${signal ?? `exit ${code}`}).`),
                  { exitCode: code, signal }
                ))
        )
    )
  })
}

// Read in memory for the Worker child only; the value is never logged or written.
function localConvexEnvironmentValue(name) {
  const [executable, args] = yarnSpawn([
    'workspace',
    '@artificer-toolkit/apis',
    'exec',
    'convex',
    'env',
    'get',
    name,
    ...convexCliArguments(
      process.env.CONVEX_SELF_HOSTED_URL,
      process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
    )
  ])
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    env: localChildEnvironment(),
    shell: false,
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true
  })
  const value = result.stdout?.trim()
  if (result.status !== 0 || !value || Buffer.byteLength(value) < 32 || /[\r\n]/u.test(value)) {
    throw new Error(`${name} must be provisioned in the local Convex deployment for the Worker.`)
  }
  return value
}

function localPortInUse(host, port) {
  return new Promise((resolvePort) => {
    const socket = createConnection({ host, port })
    socket.once('connect', () => {
      socket.destroy()
      resolvePort(true)
    })
    socket.once('error', () => resolvePort(false))
  })
}

// Starts a local dev server once on a free loopback port, waits for its health URL and returns a
// stop function that ends only its process tree.
async function startLocalService({
  artifactDirectory,
  environment,
  healthUrl,
  name,
  port,
  yarnArgs
}) {
  if ((await localPortInUse('127.0.0.1', port)) || (await localPortInUse('::1', port))) {
    throw new Error(`Port ${port} is in use; stop that process so the lifecycle can own ${name}.`)
  }
  const logPath = resolve(artifactDirectory, `local-${name}.log`)
  const log = createWriteStream(logPath, { flags: 'a' })
  const [executable, args] = yarnSpawn(yarnArgs)
  const child = spawn(executable, args, {
    cwd: root,
    env: environment,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })
  child.stdout.pipe(log, { end: false })
  child.stderr.pipe(log, { end: false })
  const exited = new Promise((resolveExit) => {
    child.once('error', resolveExit)
    child.once('close', resolveExit)
  })
  let running = true
  exited.then(() => (running = false))
  const killTree = () => {
    if (!running) return
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      })
    } else child.kill('SIGTERM')
  }
  // A thrown lifecycle error must not leave the service running.
  process.once('exit', killTree)
  const stop = async () => {
    process.off('exit', killTree)
    killTree()
    await exited
    log.end()
    await finished(log)
  }
  const deadline = Date.now() + 5 * 60_000
  while (true) {
    const ready = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) }).then(
      (response) => response.ok,
      () => false
    )
    if (ready) return { log: basename(logPath), pid: child.pid, stop }
    if (!running || Date.now() > deadline) {
      await stop()
      throw new Error(`The local ${name} did not become ready; see ${logPath}.`)
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000))
  }
}

// The documented local Worker, with its secrets read in memory from the local Convex deployment.
export async function startLocalSessionWorker(artifactDirectory) {
  const { allowedOrigins, host, port, secretNames } = localSessionWorker
  const secrets = Object.fromEntries(
    secretNames.map((name) => [name, localConvexEnvironmentValue(name)])
  )
  // Wrangler binds these from process.env; the empty env file keeps the ignored .dev.vars out.
  const environmentFile = resolve(artifactDirectory, 'local-session-worker.env')
  await writeFile(environmentFile, '')
  const environment = convexCliEnvironment()
  for (const name of loadedEnvironmentNames) delete environment[name]
  delete environment.CONVEX_SELF_HOSTED_ADMIN_KEY
  environment.YARN_INJECT_ENVIRONMENT_FILES = environmentFile
  Object.assign(environment, secrets, {
    CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
    CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
    LOCAL_CONTENT_SNAPSHOT_ORIGIN: 'http://127.0.0.1:8026',
    LIVE_SESSION_ALLOWED_ORIGINS: allowedOrigins
  })
  return startLocalService({
    artifactDirectory,
    environment,
    healthUrl: `http://${host}:${port}/health`,
    name: 'session-worker',
    port,
    yarnArgs: [
      'workspace',
      '@artificer-toolkit/session-worker',
      'dev',
      '--env-file',
      environmentFile,
      '--ip',
      host,
      '--port',
      String(port),
      '--persist-to',
      resolve(artifactDirectory, 'local-session-worker-state')
    ]
  })
}

// The web app the browser proofs open at http://localhost:3000. Yarn injects the local application
// environment, so Vite serves the local Convex, Worker and media URLs; it never sees the admin key.
// Browser proofs exercise the production bundle: the dev server's React development runtime and
// devtools load the browser enough to skew V15 timings. The `proof` mode reads no `.env` files.
export async function startLocalWebApp(artifactDirectory) {
  const environment = localChildEnvironment()
  delete environment.CONVEX_SELF_HOSTED_ADMIN_KEY
  await run('yarn', ['workspace', '@artificer-toolkit/web', 'vite', 'build', '--mode', 'proof'], {
    // Spawn drops undefined values, so the build does not inherit the admin key either.
    environment: { CONVEX_SELF_HOSTED_ADMIN_KEY: undefined },
    logPath: resolve(artifactDirectory, 'web-app-build.log')
  })
  return startLocalService({
    artifactDirectory,
    environment,
    healthUrl: `http://localhost:${localWebApp.port}/zod-csp-bootstrap.js`,
    name: 'web-app',
    port: localWebApp.port,
    yarnArgs: [
      'workspace',
      '@artificer-toolkit/web',
      'vite',
      'preview',
      '--mode',
      'proof',
      '--host',
      'localhost',
      '--port',
      String(localWebApp.port),
      '--strictPort'
    ]
  })
}

// Map uploads, browser proofs and local email delivery need the fixtures the Convex container serves
// (scripts/localConvexFixtures.ps1: R2 substitute and email sink). Starting is idempotent; they stay
// running afterwards because scheduled fixture deletions still reach them after the lifecycle ends.
export async function ensureLocalConvexFixtures(artifactDirectory) {
  const logPath = resolve(artifactDirectory, 'local-convex-fixtures.log')
  await run(
    'pwsh',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      'scripts/localConvexFixtures.ps1',
      '-Action',
      'start'
    ],
    { logPath }
  )
  return { log: basename(logPath), readyAt: new Date().toISOString() }
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

function acceptedChangedPaths(status) {
  return status
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((entry) => entry.slice(3).split(' -> ').at(-1))
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

const localConvexStageNames = new Set([
  'convex-codegen',
  'convex-local-deploy',
  'convex-seed',
  'convex-audit-after-seed',
  'convex-audit-post-browser'
])

const releaseProofAttempt = Date.now().toString(36)
const nativeProofModes = [
  'encounter-blueprints',
  'character-concurrency',
  'receipt-ledgers',
  'notification-delivery',
  'session-control',
  'campaign-inventory',
  'equipment-capacity',
  'equipment-character',
  'publication',
  'publication-class',
  'publication-feat',
  'publication-equipment',
  'encounter-lifecycle',
  'checkpoint',
  'checkpoint-large',
  'encounter-action-contention',
  'encounter-reaction-contention',
  'campaign-item-producers',
  'campaign-vehicle-producers',
  'campaign-inventory-read-probe',
  'campaign-membership-custody',
  'campaign-currency-lifecycle',
  'campaign-assignment-lifecycle',
  'campaign-qualified-currency',
  'campaign-custody-authored-delete'
]
const browserProofModes = [
  'auth-browser',
  'signed-in-request-audit',
  'profile-browser',
  'recovery-browser',
  'social-browser',
  'account-entitlements',
  'publication-browser',
  'publication-class-browser',
  'publication-feat-browser',
  'publication-equipment-browser',
  'campaign-lifecycle',
  'campaign-custody-browser',
  'campaign-membership-browser',
  'campaign-collaboration-browser',
  'campaign-content-browser',
  'scene-live-browser',
  'vtt-map-retention',
  'movement',
  'passage',
  'disarm-browser',
  'effects-browser',
  'area-browser',
  'hide-browser',
  'player-browser',
  'heat-metal-browser',
  'delegated-attack-browser',
  'account-deletion-browser',
  'builder-browser',
  'character-sheet-browser',
  'character-sheet-spells-browser',
  'v15-workload',
  'vtt-browser' // Last: it starts its own Worker on the lifecycle Worker's port.
]
function localProofStage(proof, kind) {
  const proofName =
    proof === 'account-deletion-browser'
      ? `account-deletion-browser${releaseProofAttempt}`
      : `r08-${releaseProofAttempt}-${kind}-${proof}`
  return {
    ...stage(`r08-${kind}-${proof}`, `Native local ${kind} proof: ${proof}`, 'pwsh', [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      'scripts/runLocalConvexProof.ps1',
      '-Name',
      proofName,
      '-Proof',
      proof
    ]),
    proofName,
    environment: proof === 'v15-workload' ? { V15_BROWSER_PROOF: '1' } : undefined
  }
}
const stages = [
  stage('install', 'Install the immutable dependency graph', 'yarn', ['install', '--immutable']),
  stage('workspace-list', 'List the surviving workspaces', 'yarn', [
    'workspaces',
    'list',
    '--json'
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
  stage('auth-codegen', 'Generate Better Auth schema', 'yarn', [
    'workspace',
    '@artificer-toolkit/apis',
    'codegen:auth'
  ]),
  stage('srd-manifest', 'Generate compressed SRD seed manifest', 'yarn', [
    'workspace',
    '@artificer-toolkit/apis',
    'generate:srd:manifest'
  ]),
  // Prelaunch schema changes can reject old fixtures before codegen finishes its push.
  stage('convex-reset', 'Back up and reset disposable local Convex fixture tables', 'pwsh', [
    '-NoProfile',
    '-NonInteractive',
    '-File',
    'scripts/resetLocalConvex.ps1',
    '-Name',
    `r08-reset-${releaseProofAttempt}`
  ]),
  stage('convex-codegen', 'Generate native Convex bindings', 'yarn', [
    'workspace',
    '@artificer-toolkit/apis',
    'codegen:convex',
    '--typecheck',
    'disable'
  ]),
  stage('generated-parity', 'Require generated artifact byte parity', 'internal', [
    'verify-generated-artifacts-unchanged'
  ]),
  stage('native-boundary-audit', 'Audit final native runtime boundaries', 'node', [
    'scripts/auditNativeBoundaries.mjs'
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
  stage('typecheck', 'Forced serial workspace typecheck', 'yarn', [
    'turbo',
    'run',
    'typecheck',
    '--force',
    '--concurrency=1',
    '--env-mode=loose'
  ]),
  stage('convex-typecheck', 'Native Convex typecheck', 'yarn', [
    'workspace',
    '@artificer-toolkit/apis',
    'typecheck:convex'
  ]),
  stage('lint', 'Repository lint', 'yarn', ['lint']),
  stage('schema-tests', 'Schema tests', 'yarn', ['workspace', '@artificer-toolkit/schema', 'test']),
  stage('shared-tests', 'Shared tests', 'yarn', ['workspace', '@artificer-toolkit/shared', 'test']),

  stage('source-data-tests', 'Source data tests', 'yarn', [
    'workspace',
    '@artificer-toolkit/source-data',
    'test'
  ]),
  stage('authoring-tests', 'Authoring tests', 'yarn', [
    'workspace',
    '@artificer-toolkit/authoring',
    'test'
  ]),
  // The tests resolve sibling packages through their dist output, which the `build` stage produced.
  stage('rules-runtime-tests', 'Rules runtime tests', 'yarn', [
    'workspace',
    '@artificer-toolkit/rules-runtime',
    'test'
  ]),
  stage('encounter-persistence-tests', 'Encounter persistence tests', 'yarn', [
    'workspace',
    '@artificer-toolkit/encounter-persistence',
    'test'
  ]),
  stage('apis-tests', 'API transport tests', 'yarn', [
    'workspace',
    '@artificer-toolkit/apis',
    'test'
  ]),
  ...[1, 2, 3, 4].map((shard) =>
    stage(
      `convex-tests-${shard}`,
      `Native Convex transaction, replay, rollback, and privacy tests shard ${shard} of 4`,
      'yarn',
      [
        'workspace',
        '@artificer-toolkit/apis',
        'test:convex',
        '--maxWorkers=1',
        '--no-file-parallelism',
        `--shard=${shard}/4`
      ]
    )
  ),
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
  stage(
    'session-worker-deployed-config',
    'Deployed Worker config carries no local marker',
    'yarn',
    ['workspace', '@artificer-toolkit/session-worker', 'check:deployed-config']
  ),
  ...[1, 2, 3, 4].map((shard) =>
    stage(`web-unit-tests-${shard}`, `Web unit tests shard ${shard} of 4`, 'yarn', [
      'workspace',
      '@artificer-toolkit/web',
      'test',
      '--maxWorkers=1',
      '--no-file-parallelism',
      `--shard=${shard}/4`
    ])
  ),
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
  stage(
    'convex-local-deploy',
    'Deploy final source to the isolated Convex backend',
    'yarn',
    convexDeployArguments
  ),
  stage('convex-seed', 'Seed canonical source into the isolated Convex deployment', 'yarn', [
    'workspace',
    '@artificer-toolkit/apis',
    'exec',
    'convex',
    'run',
    'content/seed:seed'
  ]),
  stage('convex-audit-after-seed', 'Audit freshly seeded Convex source', 'yarn', [
    'workspace',
    '@artificer-toolkit/apis',
    'exec',
    'convex',
    'run',
    'content/seed:audit'
  ]),
  ...nativeProofModes.map((proof) => localProofStage(proof, 'native')),
  stage('web-e2e', 'Public web and Storybook end-to-end suite', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'test:e2e',
    'tests/e2e/app/authConfirmation.spec.ts',
    'tests/e2e/storybook/authoringWalkthrough.spec.ts',
    'tests/e2e/storybook/mobileCatalogueLayout.spec.ts',
    'tests/e2e/storybook/notifications.spec.ts'
  ]),
  ...browserProofModes.map((proof) => localProofStage(proof, 'browser')),

  stage('vtt-load', 'Local VTT renderer load gate', 'yarn', [
    'workspace',
    '@artificer-toolkit/web',
    'test:e2e:vtt-load'
  ]),
  stage('convex-audit-post-browser', 'Reaudit Convex source after browser journeys', 'yarn', [
    'workspace',
    '@artificer-toolkit/apis',
    'exec',
    'convex',
    'run',
    'content/seed:audit'
  ])
]

function auditLocalStageCommands() {
  const forbiddenTokens = []
  for (const current of stages) {
    for (const token of [current.command, ...current.args]) {
      const reviewedLocalDeploy = current.name === 'convex-local-deploy' && token === 'deploy'
      if (
        /(?:^|:)(?:staging|production)(?::|$)/iu.test(token) ||
        (!reviewedLocalDeploy && /(?:^|:)deploy(?::|$)/iu.test(token)) ||
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

async function readLocalProofEvidence(proofName) {
  const stem = `${localProofDirectory}/${proofName}`
  const paths = {
    command: `${stem}.command.txt`,
    guard: `${stem}.guard.json`,
    metadata: `${stem}.metadata.json`,
    nativeCapture: `${stem}.native-capture.json`,
    nativeCaptureStatus: `${stem}.native-capture-status.json`,
    nativeExecutions: `${stem}.native-executions.jsonl`,
    proofExit: `${stem}.exit.txt`,
    proofLog: `${stem}.log`,
    sourceBefore: `${stem}.source-before.json`,
    sourceParity: `${stem}.source-parity.json`
  }
  for (const path of Object.values(paths)) {
    if (!existsSync(resolve(root, path))) throw new Error(`Missing native proof evidence: ${path}`)
  }
  const [metadata, capture, status, parity] = await Promise.all([
    readFile(resolve(root, paths.metadata), 'utf8').then(JSON.parse),
    readFile(resolve(root, paths.nativeCapture), 'utf8').then(JSON.parse),
    readFile(resolve(root, paths.nativeCaptureStatus), 'utf8').then(JSON.parse),
    readFile(resolve(root, paths.sourceParity), 'utf8').then(JSON.parse)
  ])
  if (
    metadata.exitCode !== 0 ||
    metadata.target !== localConvex.instance ||
    status.proofExit !== 0 ||
    status.collectorReady !== true ||
    status.collectorCompleted !== true ||
    status.collectorTimedOut !== false ||
    status.collectorState !== 'Completed' ||
    parity.matches !== true ||
    !Number.isInteger(capture.entryCount) ||
    capture.entryCount < 1
  ) {
    throw new Error(`Incomplete native proof, collector, or source parity: ${proofName}`)
  }
  return { paths, nativeExitCode: metadata.exitCode, nativeEntryCount: capture.entryCount }
}
function sanitizeLogExcerpt(value) {
  return value.replace(
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
  const stopAfterArgument = process.argv.find((argument) => argument.startsWith('--stop-after='))
  const provenanceArgument = process.argv.find((argument) =>
    argument.startsWith('--provenance-manifest=')
  )
  const localEnvironmentArgument = process.argv.find((argument) =>
    argument.startsWith('--local-env-file=')
  )
  const startAt = startAtArgument?.slice('--start-at='.length)
  const stopAfter = stopAfterArgument?.slice('--stop-after='.length)
  const provenanceManifestPath = provenanceArgument?.slice('--provenance-manifest='.length)
  if ((startAt === undefined) !== (provenanceManifestPath === undefined))
    throw new Error('Resume requires both --start-at and --provenance-manifest.')
  const requestedStartIndex = startAt ? stages.findIndex((current) => current.name === startAt) : 0
  if (requestedStartIndex < 0) throw new Error(`Unknown resume stage: ${startAt}.`)
  const requestedStopIndex = stopAfterArgument
    ? stages.findIndex((current) => current.name === stopAfter)
    : stages.length - 1
  if (requestedStopIndex < requestedStartIndex)
    throw new Error(`Checkpoint stage must follow the start stage: ${stopAfter}.`)

  const { localEnvironment, removedRemoteEnvironmentNames } = await loadLocalEnvironment(
    localEnvironmentArgument?.slice('--local-env-file='.length)
  )
  await useGeneratedLocalAdminKey()
  assertLocalLifecycleTarget()
  const commandAudit = auditLocalStageCommands()

  const artifactDirectory = resolve(
    root,
    process.env.PRE_STAGING_VALIDATION_DIR ?? `local-validation/pre-staging/${timestamp()}`
  )
  if (!relative(root, artifactDirectory).replaceAll('\\', '/').startsWith('local-validation/')) {
    throw new Error('Pre-staging evidence must be retained under local-validation/.')
  }
  await mkdir(artifactDirectory, { recursive: true })
  const manifestPath = resolve(artifactDirectory, 'manifest.json')
  const generatedBaseline = await fileChecksums(generatedFiles)
  const generatedStatusBaseline = generatedStatus(root, generatedRoots)
  for (const path of generatedFiles) {
    const beforePath = resolve(artifactDirectory, 'generated-before', path)
    await mkdir(dirname(beforePath), { recursive: true })
    await copyFile(resolve(root, path), beforePath)
  }
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
        !relativePath.startsWith('local-validation/')
      ) {
        throw new Error('The provenance manifest must be retained under local-validation/.')
      }
      if (visitedProvenance.has(relativePath)) {
        throw new Error('The provenance manifest chain contains a cycle.')
      }
      visitedProvenance.add(relativePath)
      const current = JSON.parse(await readFile(resolvedPath, 'utf8'))
      if (
        current.source?.start?.branch !== sourceStart.branch ||
        current.source?.start?.head !== sourceStart.head ||
        current.source?.start?.workingTreeChecksum !== sourceStart.workingTreeChecksum
      ) {
        throw new Error('The provenance manifest does not match the current source identity.')
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
    const vttTimingStage = recordedStages.find((stage) => stage.name === 'r08-browser-vtt-browser')
    if (vttTimingStage?.status === 'passed' && vttTimingStage.proofEvidence?.paths.browserTimings) {
      provenanceStageLogPaths.set(
        'r08-browser-vtt-browser-timings',
        resolve(root, vttTimingStage.proofEvidence.paths.browserTimings)
      )
    }
    selectedStages = stages.slice(requestedStartIndex)
    provenance = {
      acceptedPassedStageCount: requiredPriorStages.length,
      manifest: relativeProvenancePath,
      priorWorkingTreeChecksum: prior.source.start.workingTreeChecksum,
      resumeFromStage: startAt
    }
  }
  if (stopAfter)
    selectedStages = selectedStages.slice(0, requestedStopIndex - requestedStartIndex + 1)
  const manifest = {
    artifactDirectory,
    generatedBefore: { directory: 'generated-before', checksums: generatedBaseline },
    environment: {
      architecture: process.arch,
      localTargets: [
        ...requiredLocalUrlNames.map((name) => localTargetMetadata(name, process.env[name])),
        ...optionalLocalUrlNames
          .filter((name) => process.env[name])
          .map((name) => localTargetMetadata(name, process.env[name]))
      ],
      nodeVersion: process.version,
      packageManager: packageMetadata.packageManager,
      platform: process.platform,
      remoteAccessFreeze: {
        commandAudit,
        localEnvironment,
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

  const verifySourceEnd = async () => {
    const end = await sourceIdentity()
    manifest.source.end = end
    // The proof and reset scripts are source; the ignored local environment is checked here.
    const localEnvironmentEnd = await readFile(resolve(root, localEnvironment.path), 'utf8')
    if (checksum(localEnvironmentEnd) !== localEnvironment.sha256)
      throw new Error('The ignored local environment file changed during validation.')
    if (JSON.stringify(manifest.source.start) !== JSON.stringify(end)) {
      manifest.source.error = 'Source identity changed during validation.'
      throw new Error(
        'Source identity changed during validation; inspect the manifest before staging.'
      )
    }
  }

  const executeStage = async (current, entry, logPath, stageStart) => {
    try {
      if (current.name === 'generated-parity') {
        const generatedCurrent = await fileChecksums(generatedFiles)
        const generatedStatusCurrent = generatedStatus(root, generatedRoots)
        const matches =
          JSON.stringify(generatedBaseline) === JSON.stringify(generatedCurrent) &&
          generatedStatusBaseline === generatedStatusCurrent
        await writeFile(
          logPath,
          `${JSON.stringify({
            files: generatedFiles,
            generatedBaseline,
            generatedCurrent,
            generatedStatusBaseline,
            generatedStatusCurrent,
            matches
          })}\n`
        )
        if (!matches) {
          throw new Error('Generated artifacts changed after canonical regeneration.')
        }
      } else if (current.name === 'format-check') {
        const changedPaths = acceptedChangedPaths(manifest.source.start.status).filter(
          (path) =>
            !generatedFiles.includes(path) &&
            !path.startsWith('apps/apis/convex/_generated/') &&
            !path.startsWith('apps/apis/convex/betterAuth/_generated/')
        )
        const oxfmtPaths = changedPaths.filter(
          (path) =>
            existsSync(resolve(root, path)) && /\.(?:js|jsx|md|mjs|mts|ts|tsx)$/iu.test(path)
        )
        await writeFile(logPath, `${JSON.stringify({ oxfmtPaths })}\n`)
        for (let index = 0; index < oxfmtPaths.length; index += 50) {
          await run('yarn', ['oxfmt', '--check', ...oxfmtPaths.slice(index, index + 50)], {
            logPath
          })
        }
      } else if (current.name === 'clean-runtime-artifacts') {
        await cleanRuntimeArtifacts(logPath)
      } else {
        if (current.name === 'convex-local-deploy') await verifySourceEnd()
        await run(current.command, current.args, {
          logPath,
          environment: current.environment,
          sensitiveArgs: localConvexStageNames.has(current.name)
            ? convexCliArguments(
                process.env.CONVEX_SELF_HOSTED_URL,
                process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
              )
            : []
        })
        if (current.name === 'convex-local-deploy') await verifySourceEnd()
      }
      if (current.proofName) entry.proofEvidence = await readLocalProofEvidence(current.proofName)
      if (current.name === 'r08-browser-builder-browser')
        entry.builderBudgets = await verifyBuilderBudgets(current.proofName)
      if (current.name === 'r08-browser-v15-workload')
        entry.v15Budgets = await verifyV15Budgets(current.proofName)
      if (current.name === 'convex-reset') {
        const resetStem = `${localResetDirectory}/r08-reset-${releaseProofAttempt}`
        const reset = JSON.parse(await readFile(resolve(root, `${resetStem}.reset.json`), 'utf8'))
        if (
          reset.status !== 'passed' ||
          reset.target !== localConvex.instance ||
          reset.clearedTableCount !== reset.plannedTables?.length
        ) {
          throw new Error('The local reset did not complete its table audit.')
        }
        entry.resetEvidence = {
          manifest: `${resetStem}.reset.json`,
          backup: `${resetStem}.before.zip`,
          backupSha256: reset.backupSha256,
          postReset: `${resetStem}.after.zip`,
          postResetSha256: reset.postResetSha256,
          clearedTableCount: reset.clearedTableCount
        }
      }
      if (current.name === 'r08-browser-vtt-browser') {
        // Written by apps/apis/tests/developmentVttBrowser.ts, which owns this output folder.
        const source = resolve(root, `${localProofDirectory}/phase82-vtt-browser/playwright.log`)
        const timingPath = resolve(artifactDirectory, 'r08-browser-vtt-browser.playwright.log')
        if ((await stat(source)).mtimeMs < stageStart - 2000) {
          throw new Error('The VTT browser timing log was not written by this proof.')
        }
        await copyFile(source, timingPath)
        entry.proofEvidence.paths.browserTimings = relative(root, timingPath).replaceAll('\\', '/')
      }
      if (current.name === 'r08-browser-signed-in-request-audit') {
        // R05.2: written by apps/web/tests/live-backend/signedInRequestAudit.ts, which owns this path.
        const source = resolve(
          root,
          `${localProofDirectory}/phase82-signed-in-request-audit/request-audit.json`
        )
        const auditPath = resolve(artifactDirectory, 'r08-browser-signed-in-request-audit.json')
        if ((await stat(source)).mtimeMs < stageStart - 2000) {
          throw new Error('The signed-in request audit was not written by this proof.')
        }
        const audit = JSON.parse(await readFile(source, 'utf8'))
        if (audit.verdict !== 'passed' || !(audit.pages?.length > 0)) {
          throw new Error('The signed-in request audit did not pass.')
        }
        await copyFile(source, auditPath)
        entry.requestAudit = {
          pageCount: audit.pages.length,
          path: relative(root, auditPath).replaceAll('\\', '/')
        }
      }
      entry.exitCode = 0
      entry.status = 'passed'
      entry.completedAt = new Date().toISOString()
      entry.durationMs = Date.now() - stageStart
    } catch (error) {
      entry.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : null
      entry.status = 'failed'
      entry.completedAt = new Date().toISOString()
      entry.durationMs = Date.now() - stageStart
      entry.error = 'Command failed; inspect the stage log.'
      return { current, logPath }
    }
    return null
  }

  // Proof stages need the local Worker, and browser proofs the web app. Each starts before the first
  // stage that needs it and stops before the self-managed VTT proof, after a failure and at the end.
  const localServices = [
    {
      key: 'localSessionWorker',
      label: 'Session Worker',
      needed: ({ proofName }) => Boolean(proofName),
      start: startLocalSessionWorker
    },
    {
      key: 'localWebApp',
      label: 'web app',
      needed: ({ name }) => name.startsWith('r08-browser-'),
      start: startLocalWebApp
    }
  ]
  const runningServices = new Map()
  const stopLocalServices = async () => {
    for (const [key, service] of runningServices) {
      await service.stop()
      manifest[key].stoppedAt = new Date().toISOString()
    }
    runningServices.clear()
  }

  for (let index = 0; index < selectedStages.length;) {
    const current = selectedStages[index]
    const batch = [current]
    if (!manifest.localConvexFixtures && batch.some(({ proofName }) => proofName)) {
      console.log('[pre-staging] Ensure the local Convex fixtures')
      try {
        manifest.localConvexFixtures = await ensureLocalConvexFixtures(artifactDirectory)
      } catch (error) {
        manifest.completedAt = new Date().toISOString()
        manifest.localConvexFixtures = { error: error instanceof Error ? error.message : 'failed' }
        manifest.status = 'failed'
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        throw error
      }
    }
    if (batch.some(({ name }) => name === `r08-browser-${selfManagedBrowserProof}`)) {
      await stopLocalServices()
    } else {
      for (const service of localServices) {
        if (runningServices.has(service.key) || !batch.some(service.needed)) continue
        console.log(`[pre-staging] Start the local ${service.label}`)
        try {
          const started = await service.start(artifactDirectory)
          runningServices.set(service.key, started)
          manifest[service.key] = {
            log: started.log,
            pid: started.pid,
            startedAt: new Date().toISOString()
          }
        } catch (error) {
          await stopLocalServices()
          manifest.completedAt = new Date().toISOString()
          manifest[service.key] = { error: error instanceof Error ? error.message : 'failed' }
          manifest.status = 'failed'
          await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
          throw error
        }
      }
    }
    const prepared = batch.map((stage) => {
      assertLocalLifecycleTarget()
      const logPath = resolve(artifactDirectory, `${stage.name}.log`)
      const stageStart = Date.now()
      const entry = {
        command: [stage.command, ...stage.args],
        name: stage.name,
        label: stage.label,
        startedAt: new Date().toISOString(),
        status: 'running',
        log: basename(logPath)
      }
      manifest.stages.push(entry)
      console.log(`[pre-staging] ${stage.label}`)
      return { current: stage, entry, logPath, stageStart }
    })
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    const results = await Promise.all(
      prepared.map(({ current, entry, logPath, stageStart }) =>
        executeStage(current, entry, logPath, stageStart)
      )
    )
    const failures = results.filter(Boolean)
    if (failures.length > 0) {
      await stopLocalServices()
      manifest.completedAt = new Date().toISOString()
      manifest.status = 'failed'
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    if (failures.length > 0) {
      for (const { current, logPath } of failures) {
        const excerpt = await failureExcerpt(logPath)
        console.error(`[pre-staging] FAILED: ${current.label}; see ${logPath}`)
        if (excerpt) console.error(excerpt)
      }
      process.exitCode = 1
      return
    }
    index += batch.length
  }
  await stopLocalServices()

  if (stopAfter) {
    try {
      await verifySourceEnd()
      manifest.completedAt = new Date().toISOString()
      manifest.nextStage = stages[requestedStopIndex + 1]?.name ?? null
      manifest.status = 'checkpoint'
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      console.log(`[pre-staging] CHECKPOINT: ${artifactDirectory}`)
    } catch (error) {
      manifest.completedAt = new Date().toISOString()
      manifest.finalizationError = error instanceof Error ? error.message : String(error)
      manifest.status = 'failed'
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      throw error
    }
    return
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
      entry.exitCode = 0
      entry.status = 'passed'
      entry.completedAt = new Date().toISOString()
      entry.durationMs = Date.now() - stageStart
    } catch (error) {
      entry.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : null
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
    await verifySourceEnd()
    const currentBrowserLogPath = resolve(
      artifactDirectory,
      'r08-browser-vtt-browser.playwright.log'
    )
    const browserLogPath = existsSync(currentBrowserLogPath)
      ? currentBrowserLogPath
      : provenanceStageLogPaths.get('r08-browser-vtt-browser-timings')
    if (!browserLogPath) throw new Error('The native local VTT browser log was not retained.')
    const browserLog = await readFile(browserLogPath, 'utf8')
    const timingPrefix = 'Managed VTT convergence timings: '
    const browserResult = browserLog
      .split(/\r?\n/u)
      .filter((line) => line.includes(timingPrefix))
      .map((line) => JSON.parse(line.slice(line.indexOf(timingPrefix) + timingPrefix.length)))
      .at(-1)
    if (
      !browserResult?.authoritative ||
      !browserResult?.durable ||
      !browserResult?.ephemeral ||
      !browserResult?.ruleBound ||
      !browserResult?.sceneOnly
    ) {
      throw new Error(
        'The native local VTT browser log did not contain the frozen workload metrics.'
      )
    }
    manifest.performance = {
      authoritativeBrowserConvergenceP95: {
        budgetMs: 1000,
        observedMs: browserResult.authoritative.p95,
        passed: browserResult.authoritative.p95 < 1000
      },
      durableBrowserConvergenceP95: {
        budgetMs: 250,
        observedMs: browserResult.durable.p95,
        passed: browserResult.durable.p95 <= 250
      },
      durableBrowserConvergenceP99: {
        budgetMs: 500,
        observedMs: browserResult.durable.p99,
        passed: browserResult.durable.p99 <= 500
      },
      ephemeralBrowserConvergenceP95: {
        budgetMs: 150,
        observedMs: browserResult.ephemeral.p95,
        passed: browserResult.ephemeral.p95 <= 150
      },
      ruleBrowserConvergenceP95: {
        budgetMs: 1000,
        observedMs: browserResult.ruleBound.p95,
        passed: browserResult.ruleBound.p95 < 1000
      },
      sceneBrowserConvergenceP95: {
        budgetMs: 1000,
        observedMs: browserResult.sceneOnly.p95,
        passed: browserResult.sceneOnly.p95 < 1000
      }
    }
    if (Object.values(manifest.performance).some(({ passed }) => !passed)) {
      throw new Error('One or more frozen local VTT performance budgets failed.')
    }
    manifest.warnings = await collectWarningCounts(artifactDirectory, manifest.stages)
    manifest.completedAt = new Date().toISOString()
    manifest.releaseReadiness = 'READY_FOR_BOUNDED_STAGING_REVIEW'
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
