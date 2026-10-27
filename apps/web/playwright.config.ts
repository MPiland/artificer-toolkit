import { defineConfig, devices } from '@playwright/test'

const appBaseURL = process.env.APP_E2E_BASE_URL ?? 'http://127.0.0.1:3000'
const appUrl = new URL(appBaseURL)
const appPort = appUrl.port || (appUrl.protocol === 'https:' ? '443' : '80')

const appWebServer = {
  name: 'app',
  command: `yarn exec vite dev --host ${appUrl.hostname} --port ${appPort}`,
  url: new URL('/zod-csp-bootstrap.js', appBaseURL).toString(),
  // APP_E2E_BASE_URL names a web app a proof harness already started (developmentCharacterBrowser.ts).
  reuseExistingServer: !process.env.CI || Boolean(process.env.APP_E2E_BASE_URL),
  timeout: 120_000,
  cwd: '.'
}

const storybookWebServer = {
  name: 'storybook',
  command: 'yarn exec storybook dev --port 6006 --ci --host 127.0.0.1',
  url: 'http://127.0.0.1:6006',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  cwd: '.'
}

function getRequestedProjects(argv: string[]) {
  const requestedProjects = new Set<string>()

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg.startsWith('--project=')) {
      requestedProjects.add(arg.slice('--project='.length))
      continue
    }

    if (arg === '--project') {
      while (argv[index + 1] && !argv[index + 1].startsWith('-')) {
        requestedProjects.add(argv[index + 1])
        index += 1
      }
    }
  }

  return requestedProjects
}

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

function matchesProjectSelection(projectName: string, requestedProjects: Set<string>) {
  for (const projectPattern of requestedProjects) {
    const matcher = new RegExp(
      `^${escapeRegex(projectPattern).replace(/\\\*/g, '.*').replace(/\\\?/g, '.')}$`
    )

    if (matcher.test(projectName)) {
      return true
    }
  }

  return false
}

function getScopedWebServers() {
  const requestedProjects = getRequestedProjects(process.argv)

  if (requestedProjects.size === 0) {
    return [appWebServer, storybookWebServer]
  }

  return [
    matchesProjectSelection('app', requestedProjects) ? appWebServer : null,
    matchesProjectSelection('storybook', requestedProjects) ||
    matchesProjectSelection('storybook-vtt-hardware', requestedProjects)
      ? storybookWebServer
      : null
  ].filter((server): server is typeof appWebServer | typeof storybookWebServer => Boolean(server))
}

const vttHardwareProject =
  process.env.VTT_HARDWARE_FPS_GATE === '1'
    ? [
        {
          name: 'storybook-vtt-hardware',
          testMatch: /vttLoad\.spec\.ts/,
          use: {
            ...devices['Desktop Chrome'],
            baseURL: 'http://127.0.0.1:6006',
            launchOptions: {
              headless: false
            }
          }
        }
      ]
    : []

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  forbidOnly: true,
  fullyParallel: false,
  reporter: 'list',
  workers: 1,
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
        baseURL: appBaseURL
      }
    },
    {
      name: 'storybook',
      testDir: './tests/e2e/storybook',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:6006'
      }
    },
    ...vttHardwareProject
  ],
  webServer: getScopedWebServers()
})
