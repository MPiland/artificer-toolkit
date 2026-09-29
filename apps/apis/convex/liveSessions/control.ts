'use node'

import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { z } from 'zod'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  liveSessionControlInputSchema,
  liveSessionPresentationControlInputSchema,
  type LiveSessionPresentationControlInput,
  type LiveSessionControlInput
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  setCampaignLiveScenePresentationResultDtoSchema,
  type SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { internalAction, type ActionCtx } from '../_generated/server'

const CONTROL_MAX_ATTEMPTS = 5
const CONTROL_RETRY_BASE_DELAY_MS = 1_000
const EVICTION_RETRY_MAX_DELAY_MS = 60_000
const retryReference = makeFunctionReference<
  'action',
  LiveSessionControlInput & { attempt: number },
  null
>('liveSessions/control:send')
const authorityHeld = makeFunctionReference<'query', { campaignId: string }, boolean>(
  'liveSessions/authority:held'
)

const uuidSchema = z.string().check(z.uuid())
const membershipEpochSchema = z.iso.datetime({ offset: true })
const evictionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  userId: uuidSchema,
  membershipEpoch: membershipEpochSchema
})

function configuration() {
  const configuredUrl = process.env.LIVE_SESSION_WORKER_URL
  if (!configuredUrl) throw new Error('LIVE_SESSION_WORKER_URL is required for live-room control.')
  let url: URL
  try {
    url = new URL(LIVE_SESSION_CONTROL_PATH, configuredUrl)
  } catch {
    throw new Error('LIVE_SESSION_WORKER_URL must be an absolute URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('LIVE_SESSION_WORKER_URL must use HTTP or HTTPS.')

  const secret = process.env.LIVE_SESSION_WORKER_SECRET
  if (!secret || new TextEncoder().encode(secret).byteLength < 32)
    throw new Error('LIVE_SESSION_WORKER_SECRET must contain at least 32 bytes.')
  return { secret, url }
}

function prepareRequest(input: LiveSessionControlInput) {
  const body = liveSessionControlInputSchema.parse(input)
  const { secret, url } = configuration()
  return () =>
    fetch(url, {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret
      },
      method: 'POST'
    })
}

function rejected(status: number) {
  return new Error(`Live Session Worker control request failed with status ${status}.`)
}

async function post(input: LiveSessionControlInput) {
  const response = await prepareRequest(input)()
  if (!response.ok) throw rejected(response.status)
  return response
}

/**
 * Room control is fire-and-forget from its producing mutation, so network failures and transient
 * Worker statuses retry with exponential backoff (1s, 2s, 4s, 8s). An eviction keeps retrying, at
 * most a minute apart, until the room acknowledges it or no room holds the Campaign's authority: a
 * lost eviction is the one gap the room's authorization lease must cover (ADR 0035 Amendment 14).
 * Other control stops after five attempts. Configuration errors and contract rejections fail
 * immediately.
 */
async function deliver(ctx: ActionCtx, input: LiveSessionControlInput, attempt: number) {
  const dispatch = prepareRequest(input)
  const response = await dispatch().catch(() => null)
  if (response?.ok) return
  const transient =
    !response || response.status === 408 || response.status === 429 || response.status >= 500
  const retry =
    transient &&
    (input.operation.type === 'EVICT_USER'
      ? await ctx.runQuery(authorityHeld, { campaignId: input.campaignId })
      : attempt + 1 < CONTROL_MAX_ATTEMPTS)
  if (retry)
    await ctx.scheduler.runAfter(
      Math.min(CONTROL_RETRY_BASE_DELAY_MS * 2 ** attempt, EVICTION_RETRY_MAX_DELAY_MS),
      retryReference,
      { ...input, attempt: attempt + 1 }
    )
  throw response ? rejected(response.status) : new Error('Live Session Worker is unreachable.')
}

export const present = internalAction({
  args: zodToConvexFields(liveSessionPresentationControlInputSchema.shape),
  returns: zodToConvex(setCampaignLiveScenePresentationResultDtoSchema),
  handler: async (_ctx, args): Promise<SetCampaignLiveScenePresentationResultDto> => {
    const input: LiveSessionPresentationControlInput =
      liveSessionPresentationControlInputSchema.parse(args)
    const response = await post(input)
    return setCampaignLiveScenePresentationResultDtoSchema.parse(await response.json())
  }
})

export const send = internalAction({
  args: {
    ...zodToConvexFields(liveSessionControlInputSchema.shape),
    attempt: v.optional(v.number())
  },
  returns: v.null(),
  handler: async (ctx, { attempt, ...args }) => {
    await deliver(ctx, liveSessionControlInputSchema.parse(args), attempt ?? 0)
    return null
  }
})

export const evictUser = internalAction({
  args: zodToConvexFields(evictionInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = evictionInputSchema.parse(args)
    await deliver(
      ctx,
      {
        campaignId: input.campaignId,
        operation: {
          type: 'EVICT_USER',
          userId: input.userId,
          membershipEpoch: input.membershipEpoch
        }
      },
      0
    )
    return null
  }
})
