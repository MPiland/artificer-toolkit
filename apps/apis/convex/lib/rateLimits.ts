import { DAY, HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import type { RateLimitedErrorData } from '@artificer-toolkit/schema/api/rateLimits'
import { ConvexError } from 'convex/values'
import { SOCIAL_RATE_LIMITS } from '@artificer-toolkit/shared/social/rateLimits'
import { components } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import { requireIdentity } from './identity'

/**
 * Every limit is keyed only by the authenticated user ID so account deletion can erase each counter
 * without enumerating Campaigns. Callers consume inside the authorized mutation before any write;
 * a rejection throws and rolls back every earlier counter and source write.
 */
const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Reconnect backoff reissues tickets; bursts stay small while a steady reconnect loop keeps working.
  liveSessionTicket: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 10 },
  // One maximum fog save is begin + 32 appends + publish; the burst admits two back to back.
  sceneWrite: { kind: 'token bucket', rate: 240, period: MINUTE, capacity: 80 },
  // Chat text and public rolls share the prior 30-per-minute author allowance.
  campaignConversation: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 30 }
})

type UserRateLimit = 'liveSessionTicket' | 'sceneWrite' | 'campaignConversation'
type SocialRateLimitAction = keyof typeof SOCIAL_RATE_LIMITS

const userRateLimitMessages: Record<UserRateLimit, string> = {
  liveSessionTicket: 'Too many live table connection attempts. Try again shortly.',
  sceneWrite: 'Too many Scene changes. Try again shortly.',
  campaignConversation: 'Chat is temporarily rate limited.'
}

function socialRateLimitName(action: string, window: string) {
  return `social${action}${window}`
}

/** Fixed UTC windows (start 0) preserve the Social policy windows. */
export function socialRateLimits(action: SocialRateLimitAction) {
  return SOCIAL_RATE_LIMITS[action].map(({ window, limit }) => ({
    name: socialRateLimitName(action, window),
    config: {
      kind: 'fixed window',
      rate: limit,
      period: window === 'HOUR' ? HOUR : DAY,
      start: 0
    } as const
  }))
}

export async function consumeUserRateLimit(ctx: MutationCtx, name: UserRateLimit, userId: string) {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key: userId })
  if (!ok) throwRateLimited(userRateLimitMessages[name], retryAfter)
}

// ConvexError data survives production error redaction, so clients can show the message.
function throwRateLimited(message: string, retryAfter: number | undefined): never {
  throw new ConvexError({
    code: 'RATE_LIMITED',
    message,
    retryAfterMs: Math.ceil(retryAfter ?? 0)
  } satisfies RateLimitedErrorData)
}

/** Public Scene write entry points share one allowance for the authenticated caller. */
export async function consumeSceneWriteRateLimit(ctx: MutationCtx) {
  const { userId } = await requireIdentity(ctx)
  await consumeUserRateLimit(ctx, 'sceneWrite', userId)
}

// Rejected attempts roll back with the source mutation, so counters track successful actions only.
export async function consumeSocialRateLimit(
  ctx: MutationCtx,
  userId: string,
  action: SocialRateLimitAction
) {
  for (const { name, config } of socialRateLimits(action)) {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key: userId, config })
    if (!ok) throwRateLimited('Too many Social actions. Try again later.', retryAfter)
  }
}

export async function resetSocialRateLimit(
  ctx: MutationCtx,
  userId: string,
  action: SocialRateLimitAction
) {
  for (const { name } of socialRateLimits(action))
    await rateLimiter.reset(ctx, name, { key: userId })
}

/** Account deletion erases every user-keyed counter. */
export async function resetAccountRateLimits(ctx: MutationCtx, userId: string) {
  const socialNames = Object.entries(SOCIAL_RATE_LIMITS).flatMap(([action, windows]) =>
    windows.map(({ window }) => socialRateLimitName(action, window))
  )
  for (const name of [...Object.keys(userRateLimitMessages), ...socialNames])
    await rateLimiter.reset(ctx, name, { key: userId })
}
