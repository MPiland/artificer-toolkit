import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: './test/nativeWorker.ts',
      miniflare: {
        bindings: {
          CONVEX_SITE_URL: 'https://native.test',
          LIVE_SESSION_ALLOWED_ORIGINS: 'https://app.test',
          LIVE_SESSION_TICKET_SECRET: secret,
          LIVE_SESSION_WORKER_SECRET: secret
        }
      },
      wrangler: { configPath: './wrangler.jsonc' }
    })
  ],
  test: { include: ['test/native*.test.ts'] }
})
