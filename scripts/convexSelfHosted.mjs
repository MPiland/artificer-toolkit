// Shared by the scripts that drive the self-hosted Convex backend container (the local Docker backend
// or an ephemeral container on a GitHub runner): the single loopback guard, the instance check, the
// admin key and the Convex CLI invocation. The admin key is generated inside the container for each
// run. It is never printed or written; the CLI receives it as an explicit `--admin-key` argument.
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

export const localConvex = {
  container: 'phase82-convex-local-linux',
  instance: 'phase82-local-linux',
  url: 'http://127.0.0.1:3210',
  siteUrl: 'http://127.0.0.1:3211'
}

// `URL.hostname` keeps the brackets of an IPv6 literal. `host.docker.internal` reaches this machine
// from a container.
const loopbackHostnames = new Set(['127.0.0.1', '[::1]', 'host.docker.internal', 'localhost'])

/** Throws unless `value` is a URL on a loopback host, so no script can reach Convex Cloud (ADR 0035). */
export function assertLoopbackUrl(name, value) {
  if (!value) throw new Error(`${name} is required.`)
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be URL-shaped.`)
  }
  if (!loopbackHostnames.has(url.hostname.toLowerCase())) {
    throw new Error(`Refusing to run against non-loopback ${name}.`)
  }
}

/** Throws unless the backend at `url` reports the expected instance name. */
export async function assertConvexInstance(url, instance) {
  const response = await fetch(new URL('/instance_name', url), {
    signal: AbortSignal.timeout(10_000)
  })
  if (!response.ok || (await response.text()) !== instance) {
    throw new Error('The target is not the local Convex deployment.')
  }
}

export function generateAdminKey(container) {
  const generated = spawnSync('docker', ['exec', container, './generate_admin_key.sh'], {
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true
  })
  const adminKey = generated.stdout?.trim().split(/\r?\n/u).at(-1)?.trim()
  if (generated.status !== 0 || !adminKey) throw new Error('Could not generate the admin key.')
  return adminKey
}

/**
 * Runs Yarn without a shell, as [executable, args] for `spawn`. On Windows a `yarn.cmd` shim would pass
 * the admin key through cmd.exe, which splits it at its `|` and echoes the secret half into the log,
 * so Corepack's yarn.js runs under the real node.exe.
 */
export function yarnSpawn(args) {
  return process.platform === 'win32'
    ? [
        process.execPath,
        [resolve(dirname(process.execPath), 'node_modules/corepack/dist/yarn.js'), ...args]
      ]
    : ['yarn', args]
}

/**
 * The environment for a Convex CLI child. The deployment selectors are removed and the target is passed
 * as explicit `--url`/`--admin-key` arguments (convexCliArguments), which beat every env source,
 * including the `.env.local` files that Yarn and the CLI load.
 */
export function convexCliEnvironment() {
  const environment = { ...process.env }
  delete environment.CONVEX_DEPLOYMENT
  delete environment.CONVEX_DEPLOY_KEY
  return environment
}

/** The deploy command every local runner uses; append convexCliArguments so the target is explicit. */
export const convexDeployArguments = [
  'workspace',
  '@artificer-toolkit/apis',
  'exec',
  'convex',
  'deploy',
  '--yes',
  '--typecheck',
  'disable',
  '--codegen',
  'disable'
]

export const convexCliArguments = (url, adminKey) => ['--url', url, '--admin-key', adminKey]

/**
 * The deployment's Better Auth signing keys as the static `JWKS` value a managed deployment pins. With
 * an empty `JWKS` the backend fetches /api/auth/convex/jwks from itself to verify every token. The
 * first read of that route creates the key. Returns the value plus every secret it carries (the value
 * and each private key) for the caller to mask; nothing is printed.
 */
export async function readSigningKeysJwks({ url, siteUrl, adminKey }) {
  assertLoopbackUrl('Convex URL', url)
  assertLoopbackUrl('Convex site URL', siteUrl)
  const created = await fetch(new URL('/api/auth/convex/jwks', siteUrl), {
    signal: AbortSignal.timeout(30_000)
  })
  if (!created.ok) throw new Error(`The signing key read failed (HTTP ${created.status}).`)
  const [executable, args] = yarnSpawn([
    'workspace',
    '@artificer-toolkit/apis',
    'exec',
    'convex',
    'run',
    '--component',
    'betterAuth',
    'adapter:findMany',
    JSON.stringify({ model: 'jwks', paginationOpts: { cursor: null, numItems: 20 } }),
    ...convexCliArguments(url, adminKey)
  ])
  const stored = spawnSync(executable, args, {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    env: convexCliEnvironment(),
    shell: false,
    windowsHide: true
  })
  if (stored.status !== 0) throw new Error(`The signing key query failed (exit ${stored.status}).`)
  const keys = JSON.parse(stored.stdout).page.map((row) => ({
    id: row._id,
    publicKey: row.publicKey,
    privateKey: row.privateKey,
    createdAt: row.createdAt,
    alg: 'RS256'
  }))
  if (keys.length === 0) throw new Error('The deployment holds no signing key.')
  const jwks = JSON.stringify(keys)
  return { jwks, secrets: [jwks, ...keys.map((key) => key.privateKey)] }
}

/**
 * Reads one environment value of the selected local deployment (CONVEX_SELF_HOSTED_URL) through its
 * admin query API, with no shell or CLI child that could split the admin key. The value and the key
 * stay in memory; errors name the variable and the cause, never either secret.
 */
export async function convexEnvironmentValue(name) {
  const url = process.env.CONVEX_SELF_HOSTED_URL
  const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
  assertLoopbackUrl('CONVEX_SELF_HOSTED_URL', url)
  if (!adminKey) throw new Error(`CONVEX_SELF_HOSTED_ADMIN_KEY is required to read ${name}.`)
  const unreadable = `${name} could not be read from the selected local Convex deployment`
  let response
  try {
    response = await fetch(new URL('/api/query', url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Convex ${adminKey}` },
      body: JSON.stringify({
        path: '_system/cli/queryEnvironmentVariables:get',
        args: { name },
        format: 'json'
      }),
      signal: AbortSignal.timeout(30_000)
    })
  } catch (error) {
    throw new Error(`${unreadable}.`, { cause: error })
  }
  if (!response.ok) throw new Error(`${unreadable} (HTTP ${response.status}).`)
  const result = await response.json()
  if (result.status !== 'success') throw new Error(`${unreadable} (query ${result.status}).`)
  const value = result.value?.value
  if (typeof value !== 'string') {
    throw new Error(`${name} is not set in the selected local Convex deployment.`)
  }
  if (Buffer.byteLength(value, 'utf8') < 32 || /[\r\n]/u.test(value)) {
    throw new Error(`${name} must be one line of at least 32 bytes.`)
  }
  return value
}
