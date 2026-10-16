import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: './test/nativeWorker.ts',
      miniflare: {
        bindings: {
          CONTENT_SNAPSHOT_TOKEN_SECRET: `${secret}-content`,
          CONVEX_SITE_URL: 'https://native.test',
          LIVE_SESSION_ALLOWED_ORIGINS: 'https://app.test',
          LIVE_SESSION_TICKET_SECRET: secret,
          LIVE_SESSION_WORKER_SECRET: secret,
          RULES_CONTINUATION_SECRET: `${secret}-rules`
        }
      },
      wrangler: { configPath: './wrangler.jsonc' }
    })
  ],
  test: {
    include: ['test/native*.test.ts'],
    // obscenity ships a CommonJS build behind an ESM wrapper that workerd cannot link.
    deps: { optimizer: { ssr: { enabled: true, include: ['obscenity'] } } }
  }
})
