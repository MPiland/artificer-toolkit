import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

/** Reads one live-session secret from the selected local Convex deployment; never print it. */
export async function convexEnvironmentValue(
  name:
    | 'LIVE_SESSION_TICKET_SECRET'
    | 'LIVE_SESSION_WORKER_SECRET'
    | 'CONTENT_SNAPSHOT_TOKEN_SECRET'
): Promise<string> {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    CONVEX_DEPLOYMENT: '',
    CONVEX_ENV_NAME: name
  }
  delete environment.YARN_INJECT_ENVIRONMENT_FILES
  let stdout: string
  try {
    ;({ stdout } = await promisify(execFile)(
      'pwsh',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'yarn workspace @artificer-toolkit/apis exec convex env get $env:CONVEX_ENV_NAME --url $env:CONVEX_SELF_HOSTED_URL --admin-key $env:CONVEX_SELF_HOSTED_ADMIN_KEY'
      ],
      {
        cwd: repoRoot,
        env: environment,
        windowsHide: true,
        timeout: 30_000
      }
    ))
  } catch {
    throw new Error(`${name} could not be read from the selected local Convex deployment.`)
  }
  const value = stdout.trim()
  assert.ok(Buffer.byteLength(value, 'utf8') >= 32, `${name} must contain at least 32 bytes.`)
  assert.equal(/[\r\n]/u.test(value), false, `${name} must be one line.`)
  return value
}
