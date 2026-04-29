import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
    alias: {
      '#authored': resolve(__dirname, 'packages/shared/src/barrels/authored/index.ts'),
      '#compilers': resolve(__dirname, 'packages/shared/src/barrels/compilers/index.ts'),
      '#core': resolve(__dirname, 'packages/shared/src/barrels/core/index.ts'),
      '#maps': resolve(__dirname, 'packages/shared/src/barrels/maps/index.ts'),
      '#utils': resolve(__dirname, 'packages/shared/src/utils/index.ts'),
      '#types': resolve(__dirname, 'packages/db/src/types/index.ts'),
      '#services': resolve(__dirname, 'packages/functions/src/services/index.ts'),
      '#runtime': resolve(__dirname, 'packages/functions/src/runtime/index.ts')
    }
  },
  test: {
    environment: 'node',
    pool: 'threads',
    include: [
      'packages/shared/src/__tests__/**/*.test.ts',
      'packages/schema/src/__tests__/**/*.test.ts',
      'packages/db/src/__tests__/**/*.test.ts',
      'packages/functions/src/__tests__/**/*.test.ts',
      'packages/functions/src/**/*.test.ts',
      'apps/apis/src/**/*.test.ts'
    ]
  }
})
