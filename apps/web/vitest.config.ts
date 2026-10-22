import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import viteReact from '@vitejs/plugin-react'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { sourceResolve, workspaceSourceAliases } from '../../scripts/vitestSource.mjs'

const configDir = join(dirname(fileURLToPath(import.meta.url)), '.storybook')

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
          fileParallelism: false,
          maxWorkers: 1,
          browser: {
            // Vitest's default browser port (63315) sits in the dynamic range Windows reserves for
            // Hyper-V, so the story runner pins a port below it.
            api: {
              host: '127.0.0.1',
              port: 6106,
              strictPort: true
            },
            enabled: true,
            fileParallelism: false,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }]
          }
        }
      }
    ]
  }
})
