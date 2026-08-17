import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        bindings: {
          LIVE_SESSION_ALLOWED_ORIGINS: 'https://app.test',
          LIVE_SESSION_EXECUTOR_SECRET: secret,
          LIVE_SESSION_EXECUTOR_URL: 'https://executor.test/command',
          LIVE_SESSION_TICKET_SECRET: secret
        }
      },
      wrangler: { configPath: './wrangler.jsonc' }
    })
  ],
  test: { include: ['test/**/*.test.ts'] }
})
