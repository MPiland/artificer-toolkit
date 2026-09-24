import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    allowOnly: false,
    environment: 'edge-runtime',
    // The first fixture lazily transforms the backend and auth component modules.
    testTimeout: 30_000,
    include: ['apps/apis/convex/**/*.test.ts'],
    server: {
      deps: {
        inline: [
          'convex-test',
          '@convex-dev/migrations',
          '@convex-dev/better-auth',
          '@convex-dev/resend',
          '@convex-dev/r2',
          '@convex-dev/action-retrier'
        ]
      }
    },
    fileParallelism: false,
    maxWorkers: 1
  }
})
