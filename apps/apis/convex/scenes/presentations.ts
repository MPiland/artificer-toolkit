import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { nullable } from 'zod/mini'
import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import type {
  LiveSessionPresentationCommitInput,
  LiveSessionPresentationControlInput
} from '@artificer-toolkit/schema/api/liveSessions'
import { liveSessionPresentationCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessions'
import {
  campaignLiveScenePresentationReceiptDtoSchema,
  campaignSessionScenePresentationDtoSchema,
  getCampaignSessionScenePresentationInputSchema,
  setCampaignLiveScenePresentationInputDtoSchema,
  setCampaignLiveScenePresentationResultDtoSchema,
  type CampaignSessionScenePresentationDto,
  type SetCampaignLiveScenePresentationInputDto,
  type SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { encodeCampaignEvent } from '@artificer-toolkit/schema/api/campaignEventTransport'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { sceneStoredPresentationSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { action, internalQuery, query, type MutationCtx } from '../_generated/server'
import { internalMutation, mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireSceneMap } from '../media/vttMapDocuments'
import {
  assertConvexOwnsCampaignLiveState,
  isExpiredActivatingAuthority,
  readCampaignLiveAuthority,
  requireCampaignLiveAuthority
} from '../liveSessions/authorityGuard'

const preflightReference = makeFunctionReference<
  'query',
  SetCampaignLiveScenePresentationInputDto,
  { campaignId: string; actorUserId: string; epoch: string | null }
>('scenes/presentations:preflight')
const setReference = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')
const presentReference = makeFunctionReference<
  'action',
  LiveSessionPresentationControlInput,
  SetCampaignLiveScenePresentationResultDto
>('liveSessions/control:present')

export const get = query({
  args: zodToConvexFields(getCampaignSessionScenePresentationInputSchema.shape),
  get returns() {
    return zodToConvex(nullable(campaignSessionScenePresentationDtoSchema))
  },
  handler: async (ctx, args): Promise<CampaignSessionScenePresentationDto | null> => {
    const input = getCampaignSessionScenePresentationInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign } = await requireCampaignAuthority(ctx, input.campaignId.toLowerCase(), userId)
    const session = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', input.sessionId.toLowerCase()))
      .unique()
    if (!session || session.campaignId !== campaign.id) return null
    const row = await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId_sessionId', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionId', session.id)
      )
      .unique()
    if (!row) return null
    return campaignSessionScenePresentationDtoSchema.parse({
      sessionId: row.sessionId,
      sceneId: row.sceneId,
      version: row.version
    })
  }
})

export const preflight = internalQuery({
  args: zodToConvexFields(setCampaignLiveScenePresentationInputDtoSchema.shape),
  returns: v.object({
    campaignId: v.string(),
    actorUserId: v.string(),
    epoch: v.union(v.string(), v.null())
  }),
  handler: async (ctx, args) => {
    const input = setCampaignLiveScenePresentationInputDtoSchema.parse(args)
    const session = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', input.sessionId.toLowerCase()))
      .unique()
    if (!session) throw new Error('Campaign Session is unavailable.')
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, session.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (session.status !== 'OPEN') throw new Error('Finished Sessions cannot present Scenes.')
    const authority = await readCampaignLiveAuthority(ctx, campaign.id)
    if (authority && !isExpiredActivatingAuthority(authority) && authority.sessionId !== session.id)
      throw new Error('Another Session owns this Campaign live state.')
    return {
      campaignId: campaign.id,
      actorUserId: userId,
      epoch: authority && !isExpiredActivatingAuthority(authority) ? authority.epoch : null
    }
  }
})

export const setLive = action({
  args: zodToConvexFields(setCampaignLiveScenePresentationInputDtoSchema.shape),
  returns: zodToConvex(setCampaignLiveScenePresentationResultDtoSchema),
  handler: async (ctx, args): Promise<SetCampaignLiveScenePresentationResultDto> => {
    const input = setCampaignLiveScenePresentationInputDtoSchema.parse(args)
    const preflight = await ctx.runQuery(preflightReference, input)
    if (preflight.epoch === null) return ctx.runMutation(setReference, input)
    return ctx.runAction(presentReference, {
      campaignId: preflight.campaignId,
      sessionId: input.sessionId,
      operation: {
        type: 'SET_SCENE_PRESENTATION',
        actorUserId: preflight.actorUserId,
        epoch: preflight.epoch,
        input
      }
    })
  }
})

export const set = mutation({
  args: zodToConvexFields(setCampaignLiveScenePresentationInputDtoSchema.shape),
  returns: zodToConvex(setCampaignLiveScenePresentationResultDtoSchema),
  handler: async (ctx, args): Promise<SetCampaignLiveScenePresentationResultDto> => {
    const { userId } = await requireIdentity(ctx)
    return setPresentation(
      ctx,
      setCampaignLiveScenePresentationInputDtoSchema.parse(args),
      userId,
      null
    )
  }
})

export const setFromRoom = internalMutation({
  args: zodToConvexFields(liveSessionPresentationCommitInputSchema.shape),
  returns: zodToConvex(setCampaignLiveScenePresentationResultDtoSchema),
  handler: async (ctx, args): Promise<SetCampaignLiveScenePresentationResultDto> => {
    const commit = liveSessionPresentationCommitInputSchema.parse(args)
    if (commit.sessionId.toLowerCase() !== commit.input.sessionId.toLowerCase())
      throw new Error('Live Session presentation Session mismatch.')
    return setPresentation(ctx, commit.input, commit.actorUserId, commit)
  }
})

async function setPresentation(
  ctx: MutationCtx,
  input: SetCampaignLiveScenePresentationInputDto,
  userId: string,
  commit: LiveSessionPresentationCommitInput | null
): Promise<SetCampaignLiveScenePresentationResultDto> {
  const commandId = input.commandId.toLowerCase()
  const sessionId = input.sessionId.toLowerCase()
  const session = await ctx.db
    .query('campaignSessions')
    .withIndex('by_publicId', (q) => q.eq('id', sessionId))
    .unique()
  if (!session) throw new Error('Campaign Session is unavailable.')
  const { campaign, membership } = await requireCampaignAuthority(ctx, session.campaignId, userId)
  if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (session.status !== 'OPEN') throw new Error('Finished Sessions cannot present Scenes.')
  if (commit && commit.campaignId.toLowerCase() !== campaign.id)
    throw new Error('Live Session presentation Campaign mismatch.')
  const commandFingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('campaignEvents')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', commandId)
    )
    .unique()
  if (prior) {
    const receipt = campaignLiveScenePresentationReceiptDtoSchema.parse(
      JSON.parse(prior.payloadJson) as unknown
    )
    if (
      prior.type !== 'SESSION_SCENE_PRESENTATION_SET' ||
      prior.inputFingerprint !== commandFingerprint ||
      receipt.commandFingerprint !== commandFingerprint ||
      receipt.result.commandId !== commandId ||
      receipt.result.sessionId !== sessionId
    )
      throw new Error('This command ID was already used with different input.')
    return setCampaignLiveScenePresentationResultDtoSchema.parse({
      ...receipt.result,
      replayed: true
    })
  }
  if (commit) {
    const authority = await requireCampaignLiveAuthority(ctx, commit)
    if (authority.phase === 'DRAINING') throw new Error('Live Session authority is draining.')
    if (
      authority.persistedSequence !== commit.expectedSequence ||
      (authority.phase === 'ACTIVATING'
        ? commit.expectedSequence !== 0 || commit.expectedStateChecksum !== null
        : authority.persistedStateChecksum !== commit.expectedStateChecksum)
    )
      throw new Error('Live Session presentation state is stale.')
  } else await assertConvexOwnsCampaignLiveState(ctx, campaign.id)
  let activeMapAssetId: string | null = null
  const sceneId = input.sceneId === null ? null : input.sceneId.toLowerCase()
  if (sceneId !== null) {
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', sceneId))
      .unique()
    if (!scene || scene.campaignId !== campaign.id)
      throw new Error('Campaign live Scene was not found.')
    await requireSceneMap(ctx, campaign.id, scene.map)
    activeMapAssetId = scene.map.assetId.toLowerCase()
  }
  const current = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId_sessionId', (q) =>
      q.eq('campaignId', campaign.id).eq('sessionId', session.id)
    )
    .unique()
  if (
    current
      ? current.version !== input.expectedPresentationVersion
      : input.expectedPresentationVersion !== null
  )
    throw new Error('Session Scene presentation version is stale.')
  const now = new Date().toISOString()
  const presentation = sceneStoredPresentationSchema.parse({
    campaignId: campaign.id,
    sessionId: session.id,
    sceneId,
    version: current ? current.version + 1 : 0,
    activeMapAssetId,
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  })
  if (current) await ctx.db.patch(current._id, presentation)
  else await ctx.db.insert('campaignScenePresentations', presentation)
  const result = setCampaignLiveScenePresentationResultDtoSchema.parse({
    commandId,
    replayed: false,
    sessionId: session.id,
    sceneId,
    version: presentation.version
  })
  const receipt = campaignLiveScenePresentationReceiptDtoSchema.parse({
    commandFingerprint,
    result
  })
  await ctx.db.insert(
    'campaignEvents',
    campaignStoredEventSchema.parse({
      ...encodeCampaignEvent({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        type: 'SESSION_SCENE_PRESENTATION_SET',
        visibility: 'TABLE',
        subjectCharacterId: null,
        payload: receipt,
        createdAt: now
      }),
      actorUserId: userId,
      visibleInHistory: true,
      commandId,
      inputFingerprint: commandFingerprint
    })
  )
  return result
}
