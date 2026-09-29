import { zodToConvex } from 'convex-helpers/server/zod4'
import { LIVE_SESSION_TICKET_TTL_SECONDS } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import { v } from 'convex/values'
import { projectionChecksumSchema } from '@artificer-toolkit/schema/projections/identity'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { internalQuery } from '../lib/queries'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import {
  isExpiredActivatingAuthority,
  readCampaignLiveAuthority,
  readLiveCampaignAuthority,
  requireCampaignLiveAuthority
} from './authorityGuard'

const authorityValue = v.object({
  campaignId: v.string(),
  epoch: v.string(),
  phase: v.union(v.literal('ACTIVATING'), v.literal('DO_ACTIVE'), v.literal('DRAINING')),
  activationFingerprint: v.string(),
  activationExpiresAt: v.optional(v.number()),
  persistedSequence: v.number(),
  persistedStateChecksum: v.string(),
  finalSequence: v.optional(v.number()),
  finalStateChecksum: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string()
})

const ACTIVATION_RESERVATION_MAX_LIFETIME_MS = 5 * 60_000

const authorityIdentityFields = {
  campaignId: zodToConvex(postgresUuidSchema),
  epoch: zodToConvex(postgresUuidSchema)
}

export function presentCampaignLiveAuthority(authority: Doc<'campaignLiveAuthorities'>) {
  const { _id, _creationTime, ...value } = authority
  return value
}

async function activationFingerprint(ctx: MutationCtx, campaign: Doc<'campaigns'>) {
  const presentation = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .unique()
  const scene = presentation?.sceneId
    ? await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', presentation.sceneId!))
        .unique()
    : null
  if (scene && scene.campaignId !== campaign.id)
    throw new Error('Live Session presentation Scene belongs to another Campaign.')
  if (presentation?.sceneId && !scene)
    throw new Error('Live Session presentation Scene is missing.')
  const live = scene
    ? await ctx.db
        .query('sceneLiveStates')
        .withIndex('by_sceneId', (q) => q.eq('sceneId', scene.id))
        .unique()
    : null
  return checksumCanonicalJson({
    campaign: { id: campaign.id, version: campaign.version },
    presentation: presentation
      ? { sceneId: presentation.sceneId, version: presentation.version }
      : null,
    scene: scene
      ? {
          definitionSaveId: scene.definitionSaveId,
          definitionVersion: scene.definitionVersion,
          id: scene.id,
          version: live?.version ?? 0
        }
      : null
  })
}

export async function commitCampaignLiveAuthorityActivation(
  ctx: MutationCtx,
  args: {
    campaignId: string
    epoch: string
    activationFingerprint: string
    stateChecksum: string
  }
) {
  const deletion = await ctx.db
    .query('campaignDeletionJobs')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', args.campaignId.toLowerCase()))
    .unique()
  if (deletion) throw new Error('Campaign not found.')
  const authority = await requireCampaignLiveAuthority(ctx, args)
  if (authority.activationFingerprint !== args.activationFingerprint)
    throw new Error('Live Session activation fingerprint is stale.')
  if (authority.phase === 'DRAINING') throw new Error('Live Session authority is draining.')
  if (authority.phase === 'DO_ACTIVE') {
    if (
      authority.persistedSequence !== 0 ||
      authority.persistedStateChecksum !== args.stateChecksum
    )
      throw new Error('Live Session activation state checksum is stale.')
    return authority
  }
  const updatedAt = new Date().toISOString()
  const active = {
    ...authority,
    phase: 'DO_ACTIVE' as const,
    activationExpiresAt: undefined,
    persistedStateChecksum: args.stateChecksum,
    updatedAt
  }
  await ctx.db.patch(authority._id, {
    phase: active.phase,
    activationExpiresAt: undefined,
    persistedStateChecksum: active.persistedStateChecksum,
    updatedAt
  })
  return active
}

export async function advanceCampaignLiveAuthorityPersisted(
  ctx: MutationCtx,
  args: {
    campaignId: string
    epoch: string
    expectedStateChecksum: string
    sequence: number
    stateChecksum: string
  }
) {
  if (!Number.isSafeInteger(args.sequence) || args.sequence < 0)
    throw new Error('Live Session persisted sequence is invalid.')
  const authority = await requireCampaignLiveAuthority(ctx, args)
  if (authority.phase === 'ACTIVATING') throw new Error('Live Session authority is not active.')
  if (
    args.sequence === authority.persistedSequence &&
    args.stateChecksum === authority.persistedStateChecksum
  )
    return authority
  if (
    args.sequence !== authority.persistedSequence + 1 ||
    args.expectedStateChecksum !== authority.persistedStateChecksum
  )
    throw new Error('Live Session persisted publication is not contiguous.')
  if (
    authority.phase === 'DRAINING' &&
    (authority.finalSequence === undefined ||
      args.sequence > authority.finalSequence ||
      (args.sequence === authority.finalSequence &&
        args.stateChecksum !== authority.finalStateChecksum))
  )
    throw new Error('Live Session persisted publication exceeds its drain fence.')
  const updatedAt = new Date().toISOString()
  const advanced = {
    ...authority,
    persistedSequence: args.sequence,
    persistedStateChecksum: args.stateChecksum,
    updatedAt
  }
  await ctx.db.patch(authority._id, {
    persistedSequence: args.sequence,
    persistedStateChecksum: args.stateChecksum,
    updatedAt
  })
  return advanced
}
export async function claimCampaignLiveAuthority(
  ctx: MutationCtx,
  input: { campaignId: string; userId: string; expiresAt: number }
) {
  if (!Number.isSafeInteger(input.expiresAt) || input.expiresAt <= Date.now())
    throw new Error('Live Session activation expiry is invalid.')
  const { campaign, membership } = await requireCampaignAuthority(
    ctx,
    input.campaignId.toLowerCase(),
    input.userId
  )
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  const fingerprint = await activationFingerprint(ctx, campaign)
  const current = await readCampaignLiveAuthority(ctx, campaign.id)
  if (current && !isExpiredActivatingAuthority(current)) {
    if (current.phase === 'DRAINING') throw new Error('Live Session authority is draining.')
    if (current.phase === 'ACTIVATING' && current.activationFingerprint !== fingerprint)
      throw new Error('Live Session activation inputs changed.')
    // Reissued tickets extend an unused reservation only up to its absolute startup lifetime.
    const activationExpiresAt = Math.min(
      input.expiresAt,
      Date.parse(current.createdAt) + ACTIVATION_RESERVATION_MAX_LIFETIME_MS
    )
    if (
      current.phase === 'ACTIVATING' &&
      activationExpiresAt >
        (current.activationExpiresAt ??
          Date.parse(current.updatedAt) + LIVE_SESSION_TICKET_TTL_SECONDS * 1_000)
    ) {
      await ctx.db.patch(current._id, { activationExpiresAt })
      return {
        authority: { ...current, activationExpiresAt },
        campaign,
        membership
      }
    }
    return { authority: current, campaign, membership }
  }
  if (current) await ctx.db.delete(current._id)
  const now = new Date().toISOString()
  const id = await ctx.db.insert('campaignLiveAuthorities', {
    campaignId: campaign.id,
    epoch: crypto.randomUUID(),
    phase: 'ACTIVATING',
    activationFingerprint: fingerprint,
    activationExpiresAt: input.expiresAt,
    persistedSequence: 0,
    persistedStateChecksum: fingerprint,
    createdAt: now,
    updatedAt: now
  })
  const authority = await ctx.db.get(id)
  if (!authority) throw new Error('Live Session authority claim failed.')
  return { authority, campaign, membership }
}

export const claim = internalMutation({
  args: { campaignId: zodToConvex(postgresUuidSchema) },
  returns: authorityValue,
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { authority } = await claimCampaignLiveAuthority(ctx, {
      ...args,
      userId,
      expiresAt: (Math.floor(Date.now() / 1_000) + LIVE_SESSION_TICKET_TTL_SECONDS) * 1_000
    })
    return presentCampaignLiveAuthority(authority)
  }
})

export const commitActivation = internalMutation({
  args: {
    ...authorityIdentityFields,
    activationFingerprint: zodToConvex(projectionChecksumSchema),
    stateChecksum: zodToConvex(projectionChecksumSchema)
  },
  returns: authorityValue,
  handler: async (ctx, args) =>
    presentCampaignLiveAuthority(await commitCampaignLiveAuthorityActivation(ctx, args))
})

export const advancePersisted = internalMutation({
  args: {
    ...authorityIdentityFields,
    expectedStateChecksum: zodToConvex(projectionChecksumSchema),
    sequence: v.number(),
    stateChecksum: zodToConvex(projectionChecksumSchema)
  },
  returns: authorityValue,
  handler: async (ctx, args) =>
    presentCampaignLiveAuthority(await advanceCampaignLiveAuthorityPersisted(ctx, args))
})
export const beginDrain = internalMutation({
  args: {
    ...authorityIdentityFields,
    finalSequence: v.number(),
    finalStateChecksum: zodToConvex(projectionChecksumSchema)
  },
  returns: authorityValue,
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.finalSequence) || args.finalSequence < 0)
      throw new Error('Live Session final sequence is invalid.')
    const authority = await requireCampaignLiveAuthority(ctx, args)
    if (authority.phase === 'ACTIVATING') throw new Error('Live Session authority is not active.')
    if (authority.phase === 'DRAINING') {
      if (
        authority.finalSequence !== args.finalSequence ||
        authority.finalStateChecksum !== args.finalStateChecksum
      )
        throw new Error('Live Session drain fence is already set.')
      return presentCampaignLiveAuthority(authority)
    }
    if (
      args.finalSequence < authority.persistedSequence ||
      (args.finalSequence === authority.persistedSequence &&
        args.finalStateChecksum !== authority.persistedStateChecksum)
    )
      throw new Error('Live Session drain fence is behind persisted state.')
    const updatedAt = new Date().toISOString()
    await ctx.db.patch(authority._id, {
      phase: 'DRAINING',
      finalSequence: args.finalSequence,
      finalStateChecksum: args.finalStateChecksum,
      updatedAt
    })
    return presentCampaignLiveAuthority({
      ...authority,
      phase: 'DRAINING',
      finalSequence: args.finalSequence,
      finalStateChecksum: args.finalStateChecksum,
      updatedAt
    })
  }
})

export const release = internalMutation({
  args: {
    ...authorityIdentityFields,
    finalSequence: v.number(),
    finalStateChecksum: zodToConvex(projectionChecksumSchema)
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.finalSequence) || args.finalSequence < 0)
      throw new Error('Live Session final sequence is invalid.')
    const current = await readCampaignLiveAuthority(ctx, args.campaignId)
    if (!current) return null
    const authority = await requireCampaignLiveAuthority(ctx, args)
    if (
      authority.phase !== 'DRAINING' ||
      authority.finalSequence !== args.finalSequence ||
      authority.persistedSequence !== args.finalSequence ||
      authority.finalStateChecksum !== args.finalStateChecksum ||
      authority.persistedStateChecksum !== args.finalStateChecksum
    )
      throw new Error('Live Session final publication is incomplete.')
    await ctx.db.delete(authority._id)
    return null
  }
})

/** Whether a room still holds the Campaign's live authority, so its evictions keep retrying. */
export const held = internalQuery({
  args: { campaignId: zodToConvex(postgresUuidSchema) },
  returns: v.boolean(),
  handler: async (ctx, { campaignId }) =>
    (await readLiveCampaignAuthority(ctx, campaignId)) !== null
})
