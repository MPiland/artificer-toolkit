import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { LIVE_SESSION_TICKET_TTL_SECONDS } from '@artificer-toolkit/schema/api/liveSessionIdentity'

export function isExpiredActivatingAuthority(authority: Doc<'campaignLiveAuthorities'>) {
  return (
    authority.phase === 'ACTIVATING' &&
    (authority.activationExpiresAt ??
      Date.parse(authority.updatedAt) + LIVE_SESSION_TICKET_TTL_SECONDS * 1_000) <= Date.now()
  )
}

export async function readCampaignLiveAuthority(ctx: QueryCtx, campaignId: string) {
  return ctx.db
    .query('campaignLiveAuthorities')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId.toLowerCase()))
    .unique()
}

export async function assertConvexOwnsCampaignLiveState(ctx: QueryCtx, campaignId: string) {
  const authority = await readCampaignLiveAuthority(ctx, campaignId)
  if (authority && !isExpiredActivatingAuthority(authority))
    throw new Error('This Campaign is currently owned by its live Session.')
}

export async function requireCampaignLiveAuthority(
  ctx: QueryCtx,
  input: { campaignId: string; sessionId: string; epoch: string }
) {
  const authority = await readCampaignLiveAuthority(ctx, input.campaignId)
  if (
    !authority ||
    isExpiredActivatingAuthority(authority) ||
    authority.sessionId !== input.sessionId.toLowerCase() ||
    authority.epoch !== input.epoch.toLowerCase()
  )
    throw new Error('Live Session authority is stale.')
  return authority
}

export async function requireActiveCampaignLiveAuthority(
  ctx: QueryCtx,
  input: { campaignId: string; sessionId: string; epoch: string }
) {
  const authority = await requireCampaignLiveAuthority(ctx, input)
  if (authority.phase !== 'DO_ACTIVE') throw new Error('Live Session authority is not active.')
  return authority
}
