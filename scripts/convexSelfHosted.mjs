// Shared by the scripts that drive the self-hosted Convex backend container (the local Docker backend
// or an ephemeral container on a GitHub runner): the single loopback guard, the instance check, the
// admin key and the Convex CLI invocation. The admin key is generated inside the container for each
// run. It is never printed or written; the CLI receives it as an explicit `--admin-key` argument.
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

export const localConvex = {
  container: 'phase82-convex-local-linux',
  instance: 'phase82-local-linux',
  url: 'http://127.0.0.1:3210'
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

export const convexCliArguments = (url, adminKey) => ['--url', url, '--admin-key', adminKey]
