import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import viteReact from '@vitejs/plugin-react'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const configDir = join(dirname(fileURLToPath(import.meta.url)), '.storybook')

export default defineConfig({
  resolve: {
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
            api: {
              host: '127.0.0.1'
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
