import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    allowOnly: false,
    environment: 'edge-runtime',
    // The first fixture lazily transforms the backend and auth component modules.
    testTimeout: 30_000,
    // Convex functions and the in-process Worker planners must seal with the same secret.
    env: { RULES_CONTINUATION_SECRET: 'test-rules-continuation-secret-with-at-least-32-bytes' },
    include: ['apps/apis/convex/**/*.test.ts'],
    setupFiles: ['apps/apis/tests/convexTest.ts'],
    server: {
      deps: {
        inline: [
          'convex-test',
          '@convex-dev/migrations',
          '@convex-dev/better-auth',
          '@convex-dev/resend',
          '@convex-dev/r2',
          '@convex-dev/action-retrier',
          '@convex-dev/rate-limiter',
          '@convex-dev/batch-worker'
        ]
      }
    },
    fileParallelism: false,
    maxWorkers: 1
  }
})
