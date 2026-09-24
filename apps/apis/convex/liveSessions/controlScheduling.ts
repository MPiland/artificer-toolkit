import { makeFunctionReference } from 'convex/server'
import type { LiveSessionControlInput } from '@artificer-toolkit/schema/api/liveSessions'
import type { MutationCtx } from '../_generated/server'

const send = makeFunctionReference<'action', LiveSessionControlInput, null>(
  'liveSessions/control:send'
)
const evictUser = makeFunctionReference<
  'action',
  { campaignId: string; userId: string; membershipEpoch: string },
  null
>('liveSessions/control:evictUser')

export function scheduleLiveSessionUserEviction(
  ctx: MutationCtx,
  input: { campaignId: string; userId: string; membershipEpoch: string }
) {
  return ctx.scheduler.runAfter(0, evictUser, input)
}

export async function openLiveSessionIds(ctx: MutationCtx, campaignId: string) {
  const ids: string[] = []
  for await (const session of ctx.db
    .query('campaignSessions')
    .withIndex('by_campaignId_status_sessionNumber', (q) =>
      q.eq('campaignId', campaignId).eq('status', 'OPEN')
    ))
    ids.push(session.id)
  return ids
}

export async function scheduleLiveSessionRoomClosures(
  ctx: MutationCtx,
  campaignId: string,
  sessionIds: readonly string[]
) {
  for (const sessionId of sessionIds)
    await ctx.scheduler.runAfter(0, send, {
      campaignId,
      sessionId,
      operation: { type: 'CLOSE_ROOM' }
    })
}
