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

export async function readLiveCampaignAuthority(ctx: QueryCtx, campaignId: string) {
  const authority = await readCampaignLiveAuthority(ctx, campaignId)
  return authority && !isExpiredActivatingAuthority(authority) ? authority : null
}

/** Direct Convex writes are fenced only for the presented Scene while the room owns it. */
export async function assertConvexOwnsSceneLiveState(
  ctx: QueryCtx,
  campaignId: string,
  sceneId: string
) {
  if (!(await readLiveCampaignAuthority(ctx, campaignId))) return
  const presentation = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId.toLowerCase()))
    .unique()
  if (presentation?.sceneId === sceneId.toLowerCase())
    throw new Error('This Scene is currently owned by its Campaign live table.')
}

export async function requireCampaignLiveAuthority(
  ctx: QueryCtx,
  input: { campaignId: string; epoch: string }
) {
  const authority = await readCampaignLiveAuthority(ctx, input.campaignId)
  if (
    !authority ||
    isExpiredActivatingAuthority(authority) ||
    authority.epoch !== input.epoch.toLowerCase()
  )
    throw new Error('Live Session authority is stale.')
  return authority
}

export async function requireActiveCampaignLiveAuthority(
  ctx: QueryCtx,
  input: { campaignId: string; epoch: string }
) {
  const authority = await requireCampaignLiveAuthority(ctx, input)
  if (authority.phase !== 'DO_ACTIVE') throw new Error('Live Session authority is not active.')
  return authority
}
