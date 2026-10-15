// Shared by the scripts that drive a self-hosted Convex backend container (local Docker or a GitHub
// runner): the admin key is generated inside the container for each run and reaches the Convex CLI
// only through its environment. It is never printed or written.
import { spawnSync } from 'node:child_process'

export const localConvex = { container: 'phase82-convex-local-linux', url: 'http://127.0.0.1:3210' }

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** Refuses any target that is not a loopback URL, so no script can reach Convex Cloud (ADR 0035). */
export function assertLoopbackUrl(url) {
  if (!loopbackHosts.has(new URL(url).hostname)) {
    throw new Error(`The Convex backend URL must be loopback, got host ${new URL(url).hostname}.`)
  }
}

export function generateAdminKey(container) {
  const generated = spawnSync('docker', ['exec', container, './generate_admin_key.sh'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true
  })
  const adminKey = generated.stdout?.trim().split(/\r?\n/u).at(-1)?.trim()
  if (generated.status !== 0 || !adminKey) throw new Error('Could not generate the admin key.')
  return adminKey
}

// On Windows the command runs through cmd.exe, which would split an argument at the key's `|`.
export const selfHostedEnv = (url, adminKey) => ({
  ...process.env,
  CONVEX_SELF_HOSTED_URL: url,
  CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey
})
