import { defineConfig, devices } from '@playwright/test'

const appWebServer = {
  name: 'app',
  command: 'yarn exec vite dev --host 127.0.0.1 --port 3000',
  url: 'http://127.0.0.1:3000',
  reuseExistingServer: !process.env.CI,
  cwd: '.'
}

const storybookWebServer = {
  name: 'storybook',
  command: 'yarn exec storybook dev --port 6006 --ci --host 127.0.0.1',
  url: 'http://127.0.0.1:6006',
  reuseExistingServer: !process.env.CI,
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

    if (arg === '--project' && argv[index + 1]) {
      requestedProjects.add(argv[index + 1])
      index += 1
    }
  }

  return requestedProjects
}

function getScopedWebServers() {
  const requestedProjects = getRequestedProjects(process.argv)

  if (requestedProjects.size === 0) {
    return [appWebServer, storybookWebServer]
  }

  return [
    requestedProjects.has('app') ? appWebServer : null,
    requestedProjects.has('storybook') ? storybookWebServer : null
  ].filter((server): server is typeof appWebServer | typeof storybookWebServer => Boolean(server))
}

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
  webServer: getScopedWebServers()
})
