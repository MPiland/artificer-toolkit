import { RateLimiter } from '@convex-dev/rate-limiter'
import type { SOCIAL_RATE_LIMITS } from '@artificer-toolkit/shared/social/rateLimits'
import type { TestConvex } from 'convex-test'
import { components } from '../../convex/_generated/api'
import { consumeSocialRateLimit, socialRateLimits } from '../../convex/lib/rateLimits'
import type schema from '../../convex/schema'

type Harness = Pick<TestConvex<typeof schema>, 'run'>
type Action = keyof typeof SOCIAL_RATE_LIMITS

const reader = new RateLimiter(components.rateLimiter)

/** Remaining allowance per policy window, in policy order. */
export function readSocialRateLimits(t: Harness, userId: string, action: Action) {
  return t.run((ctx) =>
    Promise.all(
      socialRateLimits(action).map(async ({ name, config }) => {
        const { value, ts } = await reader.getValue(ctx, name, { key: userId, config })
        return { value, ts }
      })
    )
  )
}

/** Moves one policy window independently: `count` tokens consumed, or the window reset. */
export function adjustSocialRateLimitWindow(
  t: Harness,
  userId: string,
  action: Action,
  window: number,
  count: number | 'RESET'
) {
  const { name, config } = socialRateLimits(action)[window]!
  return t.run(async (ctx) => {
    if (count === 'RESET') await reader.reset(ctx, name, { key: userId })
    else await reader.limit(ctx, name, { key: userId, config, count, throws: true })
  })
}

/** Consumes successful actions until the first policy window has `remaining` allowance left. */
export async function exhaustSocialRateLimit(
  t: Harness,
  userId: string,
  action: Action,
  remaining = 0
) {
  const [first] = await readSocialRateLimits(t, userId, action)
  for (let index = remaining; index < first!.value; index++)
    await t.run((ctx) => consumeSocialRateLimit(ctx, userId, action))
}
