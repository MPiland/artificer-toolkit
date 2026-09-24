import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

import { defineConfig, devices } from '@playwright/test'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const localAppOrigin = 'http://localhost:3000'
const localWorkerOrigin = 'http://127.0.0.1:8787'
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1'])
const checkpointPath = process.env.MANAGED_VTT_CHECKPOINT_PATH?.trim() || null
const localWorkerValidationPath = join(repoRoot, '.codex', 'validation', 'phase82-vtt-browser')
if (!checkpointPath) mkdirSync(localWorkerValidationPath, { recursive: true })
const localWorkerPersistencePath = checkpointPath
  ? join(dirname(resolve(checkpointPath)), 'worker-state')
  : mkdtempSync(join(localWorkerValidationPath, 'worker-state-'))
if (checkpointPath) mkdirSync(localWorkerPersistencePath, { recursive: true })

function localEnvironmentFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  return Object.entries(parseEnv(readFileSync(path, 'utf8'))).reduce<Record<string, string>>(
    (result, [key, value]) => {
      if (
        key.startsWith('MANAGED_') ||
        key.startsWith('NETLIFY_') ||
        key.startsWith('PROD_') ||
        key.startsWith('STAGING_') ||
        key === 'VITE_SENTRY_DSN'
      ) {
        return result
      }
      if (value !== undefined) result[key] = value
      return result
    },
    {}
  )
}

const localEnvironment = {
  ...localEnvironmentFile(`${repoRoot}/.env.local`),
  ...localEnvironmentFile(`${repoRoot}/apps/session-worker/.dev.vars`)
}
for (const [name, value] of Object.entries(localEnvironment)) {
  if (process.env[name] === undefined) process.env[name] = value
}

function requireLoopbackUrl(name: string, expectedProtocol?: string): URL {
  const rawValue = process.env[name]?.trim()
  if (!rawValue) throw new Error(`${name} is required for the local VTT usage gate.`)
  const value = new URL(rawValue)
  if (!loopbackHosts.has(value.hostname.toLowerCase())) {
    throw new Error(`${name} must target loopback for the local VTT usage gate.`)
  }
  if (expectedProtocol && value.protocol !== expectedProtocol) {
    throw new Error(`${name} must use ${expectedProtocol} for the local VTT usage gate.`)
  }
  return value
}

function requireWorkerSecret(name: string): string {
  const value = process.env[name]?.trim()
  if (!value || Buffer.byteLength(value, 'utf8') < 32 || /[\r\n]/u.test(value)) {
    throw new Error(`${name} must be a one-line secret containing at least 32 bytes.`)
  }
  return value
}

const localTestOverrides = {
  LIVE_SESSION_ALLOWED_ORIGINS: localAppOrigin,
  MANAGED_LIVE_SESSION_ENDPOINT: localWorkerOrigin,
  MANAGED_VTT_CAMPAIGN_NAME:
    process.env.MANAGED_VTT_CAMPAIGN_NAME?.trim() || 'Artificer managed VTT smoke',
  MANAGED_VTT_GM_ONLY_TOKEN_LABEL: 'Managed VTT GM-only sentinel',
  MANAGED_VTT_TOPOLOGY: 'LOCAL',
  VITE_LIVE_SESSION_WEBSOCKET_URL: localWorkerOrigin
}
Object.assign(process.env, localTestOverrides)

const localConvexSiteOrigin = requireLoopbackUrl('CONVEX_SITE_URL', 'http:').origin
const allowedOrigins = process.env.LIVE_SESSION_ALLOWED_ORIGINS?.split(',')
  .map((value) => value.trim())
  .filter(Boolean)
if (!allowedOrigins?.includes(localAppOrigin)) {
  throw new Error(`LIVE_SESSION_ALLOWED_ORIGINS must include ${localAppOrigin}.`)
}
for (const origin of allowedOrigins) {
  const value = new URL(origin)
  if (
    value.protocol !== 'http:' ||
    !loopbackHosts.has(value.hostname.toLowerCase()) ||
    value.origin !== origin
  ) {
    throw new Error('LIVE_SESSION_ALLOWED_ORIGINS may contain only exact loopback HTTP origins.')
  }
}

const localWorkerEnvironmentFile = join(localWorkerPersistencePath, '.dev.vars')
writeFileSync(
  localWorkerEnvironmentFile,
  [
    `CONVEX_SITE_URL=${localConvexSiteOrigin}`,
    `LIVE_SESSION_ALLOWED_ORIGINS=${localAppOrigin}`,
    `LIVE_SESSION_TICKET_SECRET=${requireWorkerSecret('LIVE_SESSION_TICKET_SECRET')}`,
    `LIVE_SESSION_WORKER_SECRET=${requireWorkerSecret('LIVE_SESSION_WORKER_SECRET')}`
  ].join('\n'),
  { encoding: 'utf8', mode: 0o600 }
)

const sharedEnvironment = {
  ...process.env,
  ...localTestOverrides
}

export default defineConfig({
  expect: { timeout: 15_000 },
  forbidOnly: true,
  fullyParallel: false,
  projects: [
    {
      name: 'local-vtt',
      use: { ...devices['Desktop Chrome'], baseURL: localAppOrigin }
    }
  ],
  reporter: 'list',
  retries: 0,
  testDir: './tests/managed-vtt',
  timeout: 180_000,
  use: {
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off'
  },
  webServer: [
    {
      command: 'yarn workspace @artificer-toolkit/web dev --host localhost --port 3000',
      cwd: repoRoot,
      env: sharedEnvironment,
      name: 'local-vtt-web',
      reuseExistingServer: false,
      timeout: 5 * 60_000,
      url: localAppOrigin
    },
    {
      command: `yarn workspace @artificer-toolkit/session-worker dev --env-file "${localWorkerEnvironmentFile}" --ip 127.0.0.1 --port 8787 --persist-to "${localWorkerPersistencePath}"`,
      cwd: repoRoot,
      env: sharedEnvironment,
      name: 'local-vtt-worker',
      reuseExistingServer: false,
      stdout: 'pipe',
      timeout: 5 * 60_000,
      url: `${localWorkerOrigin}/health`
    }
  ],
  workers: 1
})
