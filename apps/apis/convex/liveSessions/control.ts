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
import { internalAction } from '../_generated/server'

const uuidSchema = z.string().check(z.uuid())
const membershipEpochSchema = z.iso.datetime({ offset: true })
const evictionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  userId: uuidSchema,
  membershipEpoch: membershipEpochSchema
})
const openSessionIds = makeFunctionReference<'query', { campaignId: string }, string[]>(
  'liveSessions/controlQueries:openSessionIds'
)

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

async function post(input: LiveSessionControlInput) {
  const body = liveSessionControlInputSchema.parse(input)
  const { secret, url } = configuration()
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret
    },
    method: 'POST'
  })
  if (!response.ok)
    throw new Error(`Live Session Worker control request failed with status ${response.status}.`)
  return response
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
  args: zodToConvexFields(liveSessionControlInputSchema.shape),
  returns: v.null(),
  handler: async (_ctx, args) => {
    await post(liveSessionControlInputSchema.parse(args))
    return null
  }
})

export const evictUser = internalAction({
  args: zodToConvexFields(evictionInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = evictionInputSchema.parse(args)
    const sessionIds = await ctx.runQuery(openSessionIds, { campaignId: input.campaignId })
    for (const sessionId of sessionIds)
      await post({
        campaignId: input.campaignId,
        sessionId,
        operation: {
          type: 'EVICT_USER',
          userId: input.userId,
          membershipEpoch: input.membershipEpoch
        }
      })
    return null
  }
})
