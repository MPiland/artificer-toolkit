import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@artificer-toolkit/rules-runtime': resolve(__dirname, 'packages/rules-runtime/src'),
      '#authored': resolve(__dirname, 'packages/shared/src/barrels/authored/index.ts'),
      '#compilers': resolve(__dirname, 'packages/shared/src/barrels/compilers/index.ts'),
      '#core': resolve(__dirname, 'packages/shared/src/barrels/core/index.ts'),
      '#maps': resolve(__dirname, 'packages/shared/src/barrels/maps/index.ts'),
      '#utils': resolve(__dirname, 'packages/shared/src/utils/index.ts')
    }
  },
  test: {
    allowOnly: false,
    server: {
      deps: { inline: ['@netlify/vite-plugin'] }
    },
    environment: 'node',
    pool: 'threads',
    include: [
      'packages/design-system/src/__tests__/**/*.test.ts',
      'packages/emails/src/__tests__/**/*.test.ts?(x)',
      'packages/shared/src/__tests__/**/*.test.ts',
      'packages/schema/src/__tests__/**/*.test.ts',
      'packages/authoring/src/**/*.test.ts',
      'packages/source-data/src/**/*.test.ts',
      'packages/rules-runtime/src/**/*.test.ts',
      'packages/encounter-persistence/src/**/*.test.ts',
      'apps/apis/src/**/*.test.ts',
      'apps/session-worker/src/**/*.test.ts',
      'netlify/tests/**/*.test.ts'
    ]
  }
})
