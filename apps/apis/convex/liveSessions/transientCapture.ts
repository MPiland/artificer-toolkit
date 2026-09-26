import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  liveSessionTransientCaptureInputSchema,
  liveSessionTransientCaptureSchema,
  liveSessionVisionRevisionsInputSchema,
  liveSessionVisionRevisionsSchema,
  type LiveSessionTransientCapture,
  type LiveSessionTransientMember
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { Doc } from '../_generated/dataModel'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { readEncounterControlledActorIds } from '../encounters/actorController'
import { readRunActors, readRunState } from '../encounters/documents'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { readLiveScene } from '../scenes/liveDocuments'
import { readCompactScene } from '../scenes/recipientReads'
import {
  assertSceneVisionCharacters,
  readSceneVisionFreshness,
  sceneVisionCharactersCurrent
} from '../scenes/visionFreshness'

function activeMember(
  membership: Doc<'campaignMemberships'>,
  ownerUserId: string
): LiveSessionTransientMember | null {
  if (
    membership.status !== 'ACTIVE' ||
    (membership.role === 'OWNER') !== (membership.userId === ownerUserId)
  )
    return null
  return {
    membershipEpoch: membership.accessStartedAt,
    role: membership.role,
    userId: membership.userId
  }
}

/** Each Encounter-bound token and whether this player controls its bound actor. */
async function readBoundTokenControl(
  ctx: QueryCtx,
  input: {
    campaign: Doc<'campaigns'>
    membership: Doc<'campaignMemberships'>
    sceneBinding: Doc<'encounterSceneBindings'>
  }
) {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.sceneBinding.encounterId))
    .unique()
  if (!run || run.campaignId !== input.campaign.id)
    throw new Error('The Scene Encounter binding is stale.')
  const [bindings, actors] = await Promise.all([
    ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_tokenId', (q) => q.eq('encounterId', run.id))
      .collect(),
    readRunActors(ctx, readRunState(run))
  ])
  const controlled = await readEncounterControlledActorIds(ctx, { ...input, actors })
  return bindings.map((binding) => ({
    tokenId: binding.tokenId,
    controlled: controlled.has(binding.actorId)
  }))
}

export const capture = internalQuery({
  args: zodToConvexFields(liveSessionTransientCaptureInputSchema.shape),
  returns: zodToConvex(liveSessionTransientCaptureSchema),
  handler: async (ctx, args): Promise<LiveSessionTransientCapture> => {
    const input = liveSessionTransientCaptureInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (userId !== input.expectedUserId || membership.role !== input.expectedRole)
      throw new Error('Live Session socket identity no longer matches its admission.')

    const fullCapture = input.mode !== 'AUTHORITY'
    if (fullCapture) await assertSceneVisionCharacters(ctx, input.observedCharacterRevisions)

    const presentation = await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
    const scene =
      presentation?.sceneId === null || presentation === null
        ? null
        : await readLiveScene(ctx, presentation.sceneId, 'MEMBER')
    if (scene && scene.campaign.id !== campaign.id)
      throw new Error('Live Session presentation Scene belongs to another Campaign.')
    const sceneBinding = scene
      ? await ctx.db
          .query('encounterSceneBindings')
          .withIndex('by_sceneId', (q) => q.eq('sceneId', scene.header.id))
          .first()
      : null
    const sceneEncounterBound = sceneBinding !== null
    const origin = activeMember(membership, campaign.ownerUserId)
    if (!origin) throw new Error('Stored Campaign membership authority mismatch.')
    const recipients = await Promise.all(
      input.recipientUserIds.map(async (recipientUserId) => {
        const recipient = await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', campaign.id).eq('userId', recipientUserId)
          )
          .unique()
        return recipient ? activeMember(recipient, campaign.ownerUserId) : null
      })
    )
    const sceneSnapshot =
      fullCapture && scene
        ? await readCompactScene(
            ctx,
            {
              header: scene.header,
              viewer: {
                role: scene.membership.role === 'OWNER' ? 'GM' : 'PLAYER',
                userId
              }
            },
            scene
          )
        : fullCapture
          ? null
          : undefined
    return liveSessionTransientCaptureSchema.parse({
      campaignId: campaign.id,
      systemId: campaign.gameSystemId,
      observedCharacterRevisions: input.observedCharacterRevisions,
      origin,
      presentation: presentation
        ? { campaignId: campaign.id, sceneId: presentation.sceneId, version: presentation.version }
        : null,
      recipients: recipients.filter(
        (recipient): recipient is LiveSessionTransientMember => recipient !== null
      ),
      sceneEncounterBound,
      originBoundTokenControl:
        sceneBinding && membership.role === 'PLAYER'
          ? await readBoundTokenControl(ctx, { campaign, membership, sceneBinding })
          : [],
      sceneHeader: scene?.header ?? null,
      ...(sceneSnapshot === undefined ? {} : { sceneSnapshot }),
      visionFreshness:
        fullCapture && scene
          ? await readSceneVisionFreshness(ctx, {
              campaignId: campaign.id,
              systemId: campaign.gameSystemId
            })
          : null
    })
  }
})

/** The member's check that the Character revisions behind a cached Scene vision are current (D33). */
export const visionRevisions = internalQuery({
  args: zodToConvexFields(liveSessionVisionRevisionsInputSchema.shape),
  returns: zodToConvex(liveSessionVisionRevisionsSchema),
  handler: async (ctx, args) => {
    const input = liveSessionVisionRevisionsInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    if (userId !== input.expectedUserId || membership.role !== input.expectedRole)
      throw new Error('Live Session socket identity no longer matches its admission.')
    return { current: await sceneVisionCharactersCurrent(ctx, input.observedCharacterRevisions) }
  }
})
