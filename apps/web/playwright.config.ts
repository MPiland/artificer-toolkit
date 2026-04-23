import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'app',
      testDir: './tests/e2e/app',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:3000'
      }
    },
    {
      name: 'storybook',
      testDir: './tests/e2e/storybook',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:6006'
      }
    }
  ],
  webServer: [
    {
      command: 'yarn exec vite dev --host 127.0.0.1 --port 3000',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      cwd: '.'
    },
    {
      command: 'yarn exec storybook dev --port 6006 --ci --host 127.0.0.1',
      url: 'http://127.0.0.1:6006',
      reuseExistingServer: !process.env.CI,
      cwd: '.'
    }
  ]
})
