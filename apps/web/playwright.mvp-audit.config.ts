import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.MVP_AUDIT_BASE_URL ?? 'http://127.0.0.1:3000'
const appUrl = new URL(baseURL)
const appPort = appUrl.port || (appUrl.protocol === 'https:' ? '443' : '80')

export default defineConfig({
  testDir: './tests/mvp-audit',
  timeout: 30_000,
  forbidOnly: true,
  fullyParallel: false,
  reporter: 'list',
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'mvp-audit',
      testDir: './tests/mvp-audit',
      use: {
        ...devices['Desktop Chrome'],
        baseURL
      }
    },
    {
      name: 'mvp-audit-mobile',
      testDir: './tests/mvp-audit',
      use: {
        ...devices['Pixel 7'],
        baseURL
      }
    }
  ],
  webServer: {
    command: `yarn exec vite dev --host ${appUrl.hostname} --port ${appPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    cwd: '.',
    env: {
      ARTIFICER_API_PROCEDURE_TRACE: '1',
      ARTIFICER_DB_QUERY_TRACE: '1'
    }
  }
})
