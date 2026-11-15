import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import viteReact from '@vitejs/plugin-react'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import type { BrowserConfigOptions } from 'vitest/node'
import type { BrowserContext } from '@playwright/test'
import { sourceResolve, workspaceSourceAliases } from '../../scripts/vitestSource.mjs'
import { storyAuthProxy } from './.storybook/authProxy.ts'
import { routeFromClientAddress } from './tests/live-backend/clientAddress.ts'

const configDir = join(dirname(fileURLToPath(import.meta.url)), '.storybook')

/** The browser contexts that already route through their own client address. */
const routedContexts = new WeakSet<BrowserContext>()
let nextClientAddressSlot = 0

const storyBrowser: BrowserConfigOptions = {
  // Vitest's default browser port (63315) sits in the dynamic range Windows reserves for Hyper-V,
  // so the story runner pins a port below it.
  api: {
    host: '127.0.0.1',
    port: 6106,
    strictPort: true
  },
  commands: {
    // Chromium terminates service workers at will; MockServiceWorker.stories.tsx proves mocking
    // survives it.
    async stopServiceWorkers({ page }) {
      const session = await page.context().newCDPSession(page)
      await session.send('ServiceWorker.enable')
      await session.send('ServiceWorker.stopAllWorkers')
      await session.detach()
    },
    // Every test file runs in its own browser context, and a story file signs in again. Behind one
    // client address the sign-in rate limit (3 per 10s) would reject the files that follow each other
    // quickly, so each context reaches the app from its own address, as separate players do.
    async routeFromOwnClientAddress({ page }) {
      const context = page.context()
      if (routedContexts.has(context)) return
      routedContexts.add(context)
      await routeFromClientAddress(context, new URL(page.url()).origin, nextClientAddressSlot++)
    }
  },
  enabled: true,
  fileParallelism: false,
  headless: true,
  provider: playwright({}),
  instances: [{ browser: 'chromium' }]
}

export default defineConfig({
  ssr: sourceResolve.ssr,
  resolve: {
    ...sourceResolve.resolve,
    alias: workspaceSourceAliases,
    tsconfigPaths: true
  },
  plugins: [
    vanillaExtractPlugin({
      unstable_mode: 'inlineCssInDev'
    }),
    viteReact()
  ],
  test: {
    allowOnly: false,
    coverage: {
      exclude: [
        'src/**/*.stories.{ts,tsx}',
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.css.ts',
        'src/**/fixtures/**',
        'src/routeTree.gen.ts',
        'src/test/**',
        'src/vite-env.d.ts'
      ],
      include: ['src/**/*.{ts,tsx}'],
      provider: 'v8',
      reporter: ['text', 'html']
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          css: true,
          // jsdom + React tests are CPU-bound. Vitest's default (one worker per logical CPU) puts
          // two busy workers on every physical core, which stretches multi-second tests 3-5x and
          // trips their timeouts. One worker per physical core is also faster overall. Node has no
          // physical-core API, so half the logical CPUs stands in for it: GitHub runners and
          // developer machines are two-threads-per-core, and the share scales with the machine.
          maxWorkers: '50%',
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/*.browser.test.tsx'],
          // Workspace packages resolve outside node_modules, so Vitest transforms them, and its
          // module runner then drops `export *` bindings of the shared barrels rules-runtime uses.
          // Load rules-runtime's built ESM natively instead, as Node and the browser bundle do.
          server: {
            deps: {
              external: [/[\\/]packages[\\/]rules-runtime[\\/]dist[\\/]/]
            }
          }
        }
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir,
            storybookScript: 'yarn storybook'
          })
        ],
        test: {
          name: 'storybook',
          // `.storybook/main.ts`'s `stories`, relative to this directory. The plugin applies them only
          // when a run starts, so a tool that resolves this config without running it
          // (scripts/affectedTests.mjs) would otherwise list Vitest's default test files.
          include: ['src/**/!(*.backend).stories.@(ts|tsx)'],
          fileParallelism: false,
          maxWorkers: 1,
          browser: storyBrowser
        }
      },
      {
        extends: true,
        server: { proxy: storyAuthProxy },
        plugins: [
          storybookTest({
            configDir: join(configDir, 'backend'),
            storybookScript: 'yarn storybook --config-dir .storybook/backend'
          })
        ],
        test: {
          // Stories that read the seeded local deployment (D221). They run only in the
          // `storybook-backend-browser` proof, which starts that deployment and the web app.
          // `include` mirrors `.storybook/backend/main.ts`'s `stories`, as above.
          name: 'storybook-backend',
          include: ['src/**/*.backend.stories.@(ts|tsx)'],
          // A story's first read crosses the network, and an authoring walkthrough then drives many
          // steps; the Playwright walkthrough these replace allowed each one a minute.
          testTimeout: 60_000,
          fileParallelism: false,
          maxWorkers: 1,
          browser: storyBrowser
        }
      }
    ]
  }
})
