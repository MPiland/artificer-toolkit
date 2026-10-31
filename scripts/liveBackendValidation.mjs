// Manifest, codegen push, deploy, first-use schema cost probe, seed, in-place replace probe, reseed and SRD audit against the
// self-hosted Convex backend container at http://127.0.0.1:3210: the local Docker backend by default, or an ephemeral container on a GitHub
// runner (.github/workflows/live-backend.yml). Stops at the first failing step; with --log-dir each
// step's log and duration are written there. The admin key never reaches a log or a file.
//   node scripts/liveBackendValidation.mjs [--container=<name>] [--fresh]
//     [--steps=manifest,codegen,deploy,schemaCost,seed,replace,reseed,audit] [--log-dir=<dir>]
// --fresh is for a just-started ephemeral container: it first sets the deployment env the auth config
// needs. It is refused for the local container, which keeps its own. The opt-in `snapshots` step
// waits until every Content snapshot the seed marked is built, for browser proofs on a fresh stack.
// The opt-in `signing-keys` step, CI only, pins the deployment's signing keys into JWKS as a managed
// deployment does, so token verification stops fetching them from the backend's own HTTP actions.
// --secrets-file appends what that step generates to a throwaway stack's secret list.
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { finished } from 'node:stream/promises'
import { setTimeout as delay } from 'node:timers/promises'
import {
  assertConvexInstance,
  convexCliArguments,
  convexCliEnvironment,
  convexDeployArguments,
  generateAdminKey,
  localConvex,
  yarnSpawn
} from './convexSelfHosted.mjs'

const root = resolve(import.meta.dirname, '..')
const defaultSteps = [
  'manifest',
  'codegen',
  'deploy',
  'schemaCost',
  'seed',
  'replace',
  'reseed',
  'audit'
]

const options = {
  container: localConvex.container,
  fresh: false,
  logDir: undefined,
  secretsFile: undefined,
  steps: defaultSteps
}
for (const argument of process.argv.slice(2)) {
  const match = /^--(container|steps|log-dir|secrets-file)=(.+)$/u.exec(argument)
  if (argument === '--fresh') options.fresh = true
  else if (match?.[1] === 'container') options.container = match[2]
  else if (match?.[1] === 'steps') options.steps = match[2].split(',')
  else if (match?.[1] === 'log-dir') options.logDir = resolve(match[2])
  else if (match?.[1] === 'secrets-file') options.secretsFile = resolve(match[2])
  else throw new Error(`Unknown or malformed argument: ${argument}`)
}
for (const name of options.steps) {
  if (!defaultSteps.includes(name) && name !== 'snapshots' && name !== 'signing-keys')
    throw new Error(`Unknown step: "${name}".`)
}
// The ephemeral container takes the local container's name, so the runner is what tells them apart.
if (options.steps.includes('signing-keys') && process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('signing-keys would change the local deployment env; it is for CI stacks.')
}
if (options.fresh && options.container === localConvex.container) {
  throw new Error(
    '--fresh would reset the local container deployment env; it is for an ephemeral container.'
  )
}

await assertConvexInstance(localConvex.url, localConvex.instance)
const adminKey = generateAdminKey(options.container)
// The key is `<instance>|<secret>`; both the whole key and the secret half are kept out of every log.
const secrets = [adminKey, adminKey.split('|').at(-1)].filter((secret) => secret.length >= 8)
// Keeps the secrets out of the runner's log even if a tool were to echo them.
if (process.env.GITHUB_ACTIONS === 'true') {
  for (const secret of secrets) console.log(`::add-mask::${secret}`)
}

const convex = (...args) => [
  'workspace',
  '@artificer-toolkit/apis',
  'exec',
  'convex',
  ...args,
  ...convexCliArguments(localConvex.url, adminKey)
]
// Each step is a list of Yarn commands run from the repository root.
const allSteps = {
  manifest: [['workspace', '@artificer-toolkit/apis', 'generate:srd:manifest']],
  // auth.config.ts needs JWKS before any push; an empty value selects the database-backed signing keys.
  env: [convex('env', 'set', 'JWKS', '')],
  codegen: [convex('codegen', '--typecheck', 'disable')],
  deploy: [[...convexDeployArguments, ...convexCliArguments(localConvex.url, adminKey)]],
  // The first schema parses after the deploy, so their cold cost is what the probe reports.
  schemaCost: [
    [
      'exec',
      'tsx',
      'apps/apis/scripts/liveBackendSchemaProbe.ts',
      `--container=${options.container}`
    ]
  ],
  seed: [convex('run', 'content/seed:seed')],
  // Replaces canonical subjects, the System, content source, catalogue and a reusable definition in
  // place and times each mutation; the reseed then replaces the one subject the probe leaves
  // changed, and the audit proves the corpus is exact again.
  replace: [
    [
      'exec',
      'tsx',
      'apps/apis/scripts/liveBackendReplaceProbe.ts',
      `--container=${options.container}`
    ]
  ],
  reseed: [convex('run', 'content/seed:seed')],
  audit: [convex('run', 'content/seed:audit')],
  snapshots: awaitSnapshotBuilds,
  'signing-keys': pinSigningKeys
}

// Database-backed keys make the backend fetch /api/auth/convex/jwks from itself to verify tokens, up
// to 2,000 requests a proof. The first read creates the key; the redeploy applies both auth configs.
async function pinSigningKeys(log) {
  const created = await fetch('http://127.0.0.1:3211/api/auth/convex/jwks')
  if (!created.ok) {
    log?.write(`Signing key read failed: ${created.status}\n`)
    return 1
  }
  const [executable, args] = yarnSpawn(
    convex(
      'run',
      '--component',
      'betterAuth',
      'adapter:findMany',
      JSON.stringify({ model: 'jwks', paginationOpts: { cursor: null, numItems: 20 } })
    )
  )
  const stored = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    env: convexCliEnvironment(),
    shell: false
  })
  if (stored.status !== 0) {
    log?.write(redact(stored.stderr ?? ''))
    return stored.status ?? 1
  }
  const keys = JSON.parse(stored.stdout).page.map((row) => ({
    id: row._id,
    publicKey: row.publicKey,
    privateKey: row.privateKey,
    createdAt: row.createdAt,
    alg: 'RS256'
  }))
  if (keys.length === 0) {
    log?.write('The deployment holds no signing key.\n')
    return 1
  }
  const jwks = JSON.stringify(keys)
  const generated = [jwks, ...keys.map((key) => key.privateKey)]
  secrets.push(...generated)
  for (const secret of generated) console.log(`::add-mask::${secret}`)
  if (options.secretsFile)
    await appendFile(options.secretsFile, generated.map((secret) => `${secret}\n`).join(''))
  const status = await runCommand(convex('env', 'set', 'JWKS', jwks), log)
  return status === 0 ? runCommand(allSteps.deploy[0], log) : status
}

// Builds run in the background after the seed marks each head; a head is built once its
// builtRevision reaches its revision (apps/apis/convex/contentSnapshots/heads.ts).
async function awaitSnapshotBuilds(log) {
  const [executable, args] = yarnSpawn(
    convex('data', 'contentSnapshotHeads', '--format', 'jsonl', '--limit', '1000')
  )
  const deadline = Date.now() + 15 * 60_000
  while (Date.now() < deadline) {
    const result = spawnSync(executable, args, {
      cwd: root,
      encoding: 'utf8',
      env: convexCliEnvironment(),
      shell: false
    })
    if (result.status !== 0) {
      log?.write(redact(result.stderr ?? ''))
      return result.status ?? 1
    }
    const heads = result.stdout
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
    const unbuilt = heads.filter((head) => head.revision > head.builtRevision)
    const line = `${heads.length} snapshot heads, ${unbuilt.length} unbuilt\n`
    process.stdout.write(line)
    log?.write(line)
    if (heads.length > 0 && unbuilt.length === 0) return 0
    await delay(5000)
  }
  log?.write('Content snapshot builds did not finish in 15 minutes.\n')
  return 1
}
const stepNames = options.fresh ? ['env', ...options.steps] : options.steps

const redact = (line) => secrets.reduce((text, secret) => text.replaceAll(secret, '***'), line)

async function runCommand(yarnArguments, log) {
  const [executable, args] = yarnSpawn(yarnArguments)
  const child = spawn(executable, args, {
    cwd: root,
    env: convexCliEnvironment(),
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const forward = (stream, target) => {
    stream.setEncoding('utf8')
    const lines = createInterface({ input: stream })
    lines.on('line', (line) => {
      const text = `${redact(line)}\n`
      target.write(text)
      log?.write(text)
    })
    return once(lines, 'close')
  }
  const closed = once(child, 'close')
  await Promise.all([forward(child.stdout, process.stdout), forward(child.stderr, process.stderr)])
  const [status] = await closed
  return status ?? 1
}

async function runStep(name) {
  const log = options.logDir ? createWriteStream(join(options.logDir, `${name}.log`)) : undefined
  let status = 0
  if (typeof allSteps[name] === 'function') status = await allSteps[name](log)
  else
    for (const command of allSteps[name]) {
      status = await runCommand(command, log)
      if (status !== 0) break
    }
  if (log) {
    log.end()
    await finished(log)
  }
  return status
}

if (options.logDir) await mkdir(options.logDir, { recursive: true })
const summary = []
let failed = false
for (const name of stepNames) {
  const started = Date.now()
  const status = await runStep(name)
  const seconds = Math.round((Date.now() - started) / 1000)
  summary.push({ step: name, status, seconds })
  console.log(`step ${name} exit ${status} ${seconds}s`)
  if (status !== 0) {
    failed = true
    break
  }
}
if (options.logDir) {
  await writeFile(join(options.logDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
}
process.exit(failed ? 1 : 0)
