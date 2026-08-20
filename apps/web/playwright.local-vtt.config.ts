import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

import { defineConfig, devices } from '@playwright/test'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const localAppOrigin = 'http://127.0.0.1:3000'
const localWorkerOrigin = 'http://127.0.0.1:8787'
const localExecutorOrigin = 'http://127.0.0.1:8888'
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1'])

function localEnvironmentFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  return Object.entries(parseEnv(readFileSync(path, 'utf8'))).reduce<Record<string, string>>(
    (result, [key, value]) => {
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
Object.assign(process.env, localEnvironment)

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

function requireLocalExecutorUrl(name: string): void {
  const value = requireLoopbackUrl(name, 'http:')
  if (
    value.port !== '8888' ||
    value.pathname !== '/.netlify/functions/live-session-executor' ||
    value.search ||
    value.hash
  ) {
    throw new Error(`${name} must target the local live-session executor on port 8888.`)
  }
}

requireLoopbackUrl('DATABASE_CONNECTION_STRING')
requireLoopbackUrl('SUPABASE_URL', 'http:')
requireLocalExecutorUrl('LIVE_SESSION_EXECUTOR_URL')
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

const localTestOverrides = {
  MANAGED_LIVE_SESSION_ENDPOINT: localWorkerOrigin,
  MANAGED_VTT_CAMPAIGN_NAME: 'Artificer managed VTT smoke',
  MANAGED_VTT_GM_ONLY_TOKEN_LABEL: 'Managed VTT GM-only sentinel',
  MANAGED_VTT_TOPOLOGY: 'LOCAL',
  VITE_LIVE_SESSION_WEBSOCKET_URL: localWorkerOrigin
}
Object.assign(process.env, localTestOverrides)

const sharedEnvironment = {
  ...process.env,
  ...localEnvironment,
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
      command: 'yarn workspace @artificer-toolkit/web dev --host 127.0.0.1 --port 3000',
      cwd: repoRoot,
      env: sharedEnvironment,
      name: 'local-vtt-web',
      reuseExistingServer: false,
      url: localAppOrigin
    },
    {
      command: 'yarn tsx apps/session-host/integration/localExecutorServer.ts',
      cwd: repoRoot,
      env: sharedEnvironment,
      name: 'local-vtt-executor',
      reuseExistingServer: false,
      stdout: 'pipe',
      url: `${localExecutorOrigin}/health`
    },
    {
      command: 'yarn workspace @artificer-toolkit/session-worker dev --ip 127.0.0.1 --port 8787',
      cwd: repoRoot,
      env: sharedEnvironment,
      name: 'local-vtt-worker',
      reuseExistingServer: false,
      stdout: 'pipe',
      url: `${localWorkerOrigin}/health`
    }
  ],
  workers: 1
})
