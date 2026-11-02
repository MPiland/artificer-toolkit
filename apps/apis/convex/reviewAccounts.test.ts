import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { retryRateLimitedAuth } from '../tests/developmentAuthRequest'
import { convexTest } from '../tests/convexTest'
import { reviewAccountSession } from '../tests/developmentReviewAccounts'
import { REVIEW_GM, REVIEW_PLAYERS } from '../tests/developmentReviewDataScenarios'
import { components } from './_generated/api'
import authSchema from './betterAuth/schema'
import schema from './schema'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.stubEnv('SITE_URL', 'http://localhost:3000')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3231')
  vi.stubEnv('BETTER_AUTH_SECRET', 'review-accounts-test-secret-with-sufficient-length')
  vi.stubEnv('PUBLIC_SIGN_UP_ENABLED', 'false')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// Drives the registered auth HTTP routes from one client IP, as scripts/seedReviewData.mjs does; only
// the clock is faked, so the driver's rate-limit waits jump ahead while real time still passes.
describe('review account sessions', () => {
  it('creates and then re-signs into more accounts than one sign-in window allows', async () => {
    const t = convexTest(schema, import.meta.glob('./**/*.*s'))
    t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
    registerRateLimiter(t)
    const waits: number[] = []
    const auth = retryRateLimitedAuth(
      (path, body, session) =>
        t.withRequestMetadata({ ip: '127.0.0.1' }).fetch(`/api/auth${path}`, {
          method: body ? 'POST' : 'GET',
          headers: {
            origin: 'http://localhost:3000',
            'content-type': 'application/json',
            ...(session ? { authorization: `Bearer ${session}` } : {})
          },
          body: body ? JSON.stringify(body) : undefined
        }),
      async (milliseconds) => {
        waits.push(milliseconds)
        vi.setSystemTime(Date.now() + milliseconds)
      }
    )
    const issueInvitation: Parameters<typeof reviewAccountSession>[2] = (data) =>
      t.run((ctx) =>
        ctx.runMutation(components.betterAuth.adapter.create, {
          input: { model: 'verification', data }
        })
      )
    const specs = [REVIEW_GM, ...REVIEW_PLAYERS].slice(0, 4)

    // A fresh backend: each account is missing, created by invitation, then signed in.
    for (const spec of specs) {
      expect(await reviewAccountSession(spec, auth, issueInvitation)).toEqual(expect.any(String))
    }
    // An idempotent re-run signs in to every account the first run made.
    for (const spec of specs) {
      expect(await reviewAccountSession(spec, auth, issueInvitation)).toEqual(expect.any(String))
    }
    expect(waits.length).toBeGreaterThan(0)
    expect(waits.every((milliseconds) => milliseconds >= 0 && milliseconds <= 10_000)).toBe(true)
  })
})
