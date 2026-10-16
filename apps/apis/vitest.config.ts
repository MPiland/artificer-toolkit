import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    allowOnly: false,
    environment: 'edge-runtime',
    // The first fixture lazily transforms the backend and auth component modules.
    testTimeout: 30_000,
    // Convex functions and the in-process Worker planners must seal with the same secret.
    env: {
      RULES_CONTINUATION_SECRET: 'test-rules-continuation-secret-with-at-least-32-bytes',
      // The product's local modes (ADR 0035): scheduled jobs find a configured provider, not a throw.
      MEDIA_STORAGE_MODE: 'local',
      CONVEX_SITE_URL: 'http://127.0.0.1:3221',
      MAIL_DELIVERY_MODE: 'local',
      LOCAL_EMAIL_SINK_URL: 'http://127.0.0.1:8025/messages',
      LIVE_SESSION_WORKER_URL: 'http://127.0.0.1:8787',
      LIVE_SESSION_WORKER_SECRET: 'test-live-session-worker-secret-long-enough'
    },
    include: ['apps/apis/convex/**/*.test.ts'],
    setupFiles: ['apps/apis/tests/convexTest.ts', 'apps/apis/tests/localServices.ts'],
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
