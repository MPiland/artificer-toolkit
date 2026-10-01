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

/** A stale activation or retired epoch never owns a Character's current play state. */
export async function readCharacterLiveHold(ctx: QueryCtx, characterId: string) {
  const holds = await ctx.db
    .query('liveCharacterHolds')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId.toLowerCase()))
    .collect()
  for (const hold of holds) {
    const authority = await readLiveCampaignAuthority(ctx, hold.campaignId)
    if (authority?.epoch === hold.epoch) return hold
  }
  return null
}

export async function assertConvexOwnsCharacterPlay(ctx: QueryCtx, characterId: string) {
  if (await readCharacterLiveHold(ctx, characterId))
    throw new Error('This Character is held by its live table; use the room for play commands.')
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
  const deletion = await ctx.db
    .query('campaignDeletionJobs')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', authority.campaignId))
    .unique()
  if (deletion) throw new Error('Campaign not found.')
  return authority
}
