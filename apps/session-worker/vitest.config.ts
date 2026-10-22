import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

import { sourceResolve } from '../../scripts/vitestSource.mjs'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'

export default defineConfig({
  ...sourceResolve,
  plugins: [
    cloudflareTest({
      main: './test/nativeWorker.ts',
      miniflare: {
        bindings: {
          CONTENT_SNAPSHOT_TOKEN_SECRET: `${secret}-content`,
          CONVEX_SITE_URL: 'https://native.test',
          LIVE_SESSION_ALLOWED_ORIGINS: 'https://app.test',
          LIVE_SESSION_TICKET_SECRET: secret,
          LIVE_SESSION_WORKER_SECRET: secret
        }
      },
      wrangler: { configPath: './wrangler.jsonc' }
    })
  ],
  test: {
    include: ['test/native*.test.ts'],
    // Cancels leaked rooms' alarms after each test so a finished test's room cannot fail inside a later one.
    // Adds what the room logged with console.error to a failing test's output (test/roomFailureLog.ts).
    setupFiles: ['./test/setupRoomTeardown.ts', './test/roomFailureLog.ts'],
    // Building a room takes a loaded runner more than the 5 s default; a room that hangs still fails.
    testTimeout: 30_000,
    // obscenity ships a CommonJS build behind an ESM wrapper that workerd cannot link.
    deps: { optimizer: { ssr: { enabled: true, include: ['obscenity'] } } }
  }
})
