// Provisions a just-started throwaway Convex container for browser proofs on a GitHub runner
// (.github/workflows/browser-journeys.yml), so scripts/runLocalBrowserProof.mjs runs against it
// unchanged. The container takes the local container and instance names. This script generates the
// application and Worker secrets in memory, sets the deployment env the local Docker deployment holds,
// and writes the ignored files the local runner reads: an empty root .env.local and the application
// env (no admin key). It refuses a deployment that already has env, so it never touches the user's
// local container. Secrets are masked in the runner log and never printed. --secrets-file writes them,
// one per line, outside the repository for the evidence scan before upload.
//   node scripts/throwawayConvexStack.mjs --secrets-file=<path outside the repository>
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import {
  assertConvexInstance,
  convexCliArguments,
  convexCliEnvironment,
  generateAdminKey,
  localConvex,
  yarnSpawn
} from './convexSelfHosted.mjs'
import { localEnvironmentDefault } from './validatePreStagingLocal.mjs'

const root = resolve(import.meta.dirname, '..')
const secretsFile = process.argv
  .find((argument) => argument.startsWith('--secrets-file='))
  ?.slice('--secrets-file='.length)
if (!secretsFile || !relative(root, resolve(secretsFile)).startsWith('..')) {
  throw new Error('Pass --secrets-file=<path outside the repository>.')
}

await assertConvexInstance(localConvex.url, localConvex.instance)
const adminKey = generateAdminKey(localConvex.container)
const secrets = Object.fromEntries(
  [
    'AUTH_PROXY_SECRET',
    'BETTER_AUTH_SECRET',
    'CONTENT_SNAPSHOT_TOKEN_SECRET',
    'LIVE_SESSION_TICKET_SECRET',
    'LIVE_SESSION_WORKER_SECRET'
  ].map((name) => [name, randomBytes(48).toString('hex')])
)
if (process.env.GITHUB_ACTIONS === 'true') {
  for (const secret of [adminKey, adminKey.split('|').at(-1), ...Object.values(secrets)])
    console.log(`::add-mask::${secret}`)
}

const convex = (args, stdout = 'inherit') => {
  const [executable, spawnArgs] = yarnSpawn([
    'workspace',
    '@artificer-toolkit/apis',
    'exec',
    'convex',
    ...args,
    ...convexCliArguments(localConvex.url, adminKey)
  ])
  const result = spawnSync(executable, spawnArgs, {
    cwd: root,
    encoding: 'utf8',
    env: convexCliEnvironment(),
    shell: false,
    stdio: ['ignore', stdout, 'inherit']
  })
  if (result.status !== 0) throw new Error(`convex ${args[0]} ${args[1]} failed.`)
  return result.stdout
}

if (convex(['env', 'list'], 'pipe').trim()) {
  throw new Error('The deployment already has env; this script provisions only a fresh container.')
}
// What the local Docker deployment holds (apps/apis/README.md, docs/runbooks/phase-8-2-release.md).
// JWKS is empty to select the database-backed signing keys; the container reaches the host Worker
// through host.docker.internal and serves the R2 substitute and email sink itself.
const deploymentEnvironment = {
  ...secrets,
  JWKS: '',
  LIVE_SESSION_WORKER_URL: 'http://host.docker.internal:8787',
  LOCAL_EMAIL_SINK_URL: 'http://127.0.0.1:8025/email',
  LOCAL_R2_ENDPOINT: 'http://127.0.0.1:8026',
  MAIL_DELIVERY_MODE: 'local',
  MEDIA_STORAGE_MODE: 'local',
  SITE_URL: 'http://localhost:3000'
}
for (const [name, value] of Object.entries(deploymentEnvironment))
  convex(['env', 'set', name, value])

const applicationEnvironment = {
  AUTH_PROXY_SECRET: secrets.AUTH_PROXY_SECRET,
  BETTER_AUTH_SECRET: secrets.BETTER_AUTH_SECRET,
  CONVEX_DEPLOYMENT: `local:${localConvex.instance}`,
  CONVEX_SELF_HOSTED_URL: localConvex.url,
  CONVEX_SITE_URL: 'http://127.0.0.1:3211',
  CONVEX_URL: localConvex.url,
  MANAGED_LIVE_SESSION_ENDPOINT: 'http://127.0.0.1:8787',
  SITE_URL: deploymentEnvironment.SITE_URL,
  VITE_CONVEX_URL: localConvex.url,
  VITE_LIVE_SESSION_WEBSOCKET_URL: 'ws://127.0.0.1:8787',
  VITE_MEDIA_STORAGE_ORIGIN: deploymentEnvironment.LOCAL_R2_ENDPOINT
}
const applicationFile = resolve(root, localEnvironmentDefault)
if (existsSync(applicationFile) || existsSync(resolve(root, '.env.local'))) {
  throw new Error('The local environment files already exist; this script writes them only once.')
}
await mkdir(dirname(applicationFile), { recursive: true })
const lines = (entries) => entries.map((entry) => `${entry}\n`).join('')
await writeFile(
  applicationFile,
  lines(Object.entries(applicationEnvironment).map(([name, value]) => `${name}=${value}`)),
  { mode: 0o600 }
)
await writeFile(resolve(root, '.env.local'), '', { mode: 0o600 })
await writeFile(secretsFile, lines(Object.values(secrets)), { mode: 0o600 })
console.log(`Provisioned ${Object.keys(deploymentEnvironment).length} deployment env values.`)
