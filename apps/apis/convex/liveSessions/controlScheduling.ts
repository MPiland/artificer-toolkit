import { makeFunctionReference } from 'convex/server'
import type {
  LiveSessionControlInput,
  LiveSessionInputScope
} from '@artificer-toolkit/schema/api/liveSessions'
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

export function scheduleLiveSessionRoomClosure(ctx: MutationCtx, campaignId: string) {
  return ctx.scheduler.runAfter(0, send, { campaignId, operation: { type: 'CLOSE_ROOM' } })
}

export function scheduleLiveSessionInputInvalidation(
  ctx: Pick<MutationCtx, 'scheduler'>,
  campaignId: string,
  scopes: LiveSessionInputScope[]
) {
  return ctx.scheduler.runAfter(0, send, {
    campaignId,
    operation: { type: 'INVALIDATE_INPUTS', scopes }
  })
}
