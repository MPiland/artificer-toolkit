import { defineConfig, devices } from '@playwright/test'
import { STORY_WARMUP_PATH } from './src/test/storybook/storyWarmup'

const appBaseURL = process.env.APP_E2E_BASE_URL ?? 'http://127.0.0.1:3000'
const appUrl = new URL(appBaseURL)
const appPort = appUrl.port || (appUrl.protocol === 'https:' ? '443' : '80')

const appWebServer = {
  name: 'app',
  command: `yarn exec vite dev --host ${appUrl.hostname} --port ${appPort}`,
  url: new URL('/zod-csp-bootstrap.js', appBaseURL).toString(),
  // APP_E2E_BASE_URL names a web app a proof harness already started (developmentAppBrowser.ts).
  reuseExistingServer: !process.env.CI || Boolean(process.env.APP_E2E_BASE_URL),
  timeout: 120_000,
  cwd: '.'
}

const storybookWebServer = {
  name: 'storybook',
  command: 'yarn exec storybook dev --port 6006 --ci --host 127.0.0.1',
  // Answers 503 until every story module is transformed, so no first test pays the cold compile.
  url: `http://127.0.0.1:6006${STORY_WARMUP_PATH}`,
  // Keeps the `[story-warmup]` summary in the run log.
  stdout: 'pipe' as const,
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
    ['storybook', 'storybook-vtt-load', 'storybook-vtt-hardware'].some((project) =>
      matchesProjectSelection(project, requestedProjects)
    )
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
      // The VTT load workload is a perf record (D210), not a correctness journey.
      testIgnore: /vttLoad\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:6006'
      }
    },
    {
      name: 'storybook-vtt-load',
      testDir: './tests/e2e/storybook',
      testMatch: /vttLoad\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:6006'
      }
    },
    ...vttHardwareProject
  ],
  webServer: getScopedWebServers()
})
