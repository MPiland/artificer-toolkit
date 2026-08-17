import { defineConfig, devices } from '@playwright/test'

const confirmation = 'run-managed-vtt-smoke'
if (process.env.CONFIRM_MANAGED_VTT_SMOKE !== confirmation) {
  throw new Error(`Set CONFIRM_MANAGED_VTT_SMOKE=${confirmation} to run the managed VTT smoke.`)
}

const baseURL = process.env.MANAGED_VTT_BASE_URL
if (!baseURL) throw new Error('MANAGED_VTT_BASE_URL is required.')
const parsedBaseUrl = new URL(baseURL)
if (parsedBaseUrl.protocol !== 'https:' || parsedBaseUrl.origin !== baseURL.replace(/\/$/, '')) {
  throw new Error('MANAGED_VTT_BASE_URL must be an exact HTTPS origin.')
}
const liveSessionEndpoint = process.env.MANAGED_LIVE_SESSION_ENDPOINT
if (!liveSessionEndpoint) throw new Error('MANAGED_LIVE_SESSION_ENDPOINT is required.')
const parsedLiveSessionEndpoint = new URL(liveSessionEndpoint)
if (
  parsedLiveSessionEndpoint.protocol !== 'https:' ||
  parsedLiveSessionEndpoint.origin !== liveSessionEndpoint.replace(/\/$/, '')
) {
  throw new Error('MANAGED_LIVE_SESSION_ENDPOINT must be an exact HTTPS origin.')
}

export default defineConfig({
  expect: { timeout: 15_000 },
  forbidOnly: true,
  fullyParallel: false,
  projects: [
    {
      name: 'managed-vtt',
      use: { ...devices['Desktop Chrome'], baseURL }
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
  workers: 1
})
