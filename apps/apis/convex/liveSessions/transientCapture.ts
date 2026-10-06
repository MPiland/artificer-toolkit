import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  liveSessionRoomSceneCaptureInputSchema,
  liveSessionRoomSceneCaptureSchema,
  liveSessionTransientCaptureInputSchema,
  liveSessionTransientCaptureSchema,
  type LiveSessionRoomSceneCapture,
  type LiveSessionTransientCapture,
  type LiveSessionTransientMember
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { readActiveSceneEncounter } from '@artificer-toolkit/encounter-persistence/sceneBindingReads'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { internalQuery } from '../lib/queries'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { readLiveSceneForUser } from '../scenes/liveDocuments'
import { assertSceneVisionCharacters, readSceneVisionFreshness } from '../scenes/visionFreshness'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'

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

/** The presented Scene as `userId` reads it, with its presentation and the ACTIVE Encounter bound to it. */
async function readPresentedScene(ctx: QueryCtx, campaign: Doc<'campaigns'>, userId: string) {
  const presentation = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .unique()
  const scene =
    presentation?.sceneId === null || presentation === null
      ? null
      : await readLiveSceneForUser(ctx, presentation.sceneId, 'MEMBER', userId)
  if (scene && scene.campaign.id !== campaign.id)
    throw new Error('Live Session presentation Scene belongs to another Campaign.')
  const active = scene
    ? await readActiveSceneEncounter(
        { db: createConvexEncounterStoreReader(ctx) },
        { campaignId: campaign.id, sceneId: scene.header.id }
      )
    : null
  return {
    campaignId: campaign.id,
    presentation: presentation
      ? {
          campaignId: campaign.id,
          sceneId: presentation.sceneId,
          version: presentation.version
        }
      : null,
    sceneEncounterId: active?.run.id ?? null,
    sceneHeader: scene?.header ?? null
  }
}

/** Cold admission: the presenting user's identity and membership, and the presented Scene. */
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
    const origin = activeMember(membership, campaign.ownerUserId)
    if (!origin) throw new Error('Stored Campaign membership authority mismatch.')
    return liveSessionTransientCaptureSchema.parse({
      ...(await readPresentedScene(ctx, campaign, userId)),
      origin
    })
  }
})

/**
 * The room's Scene cache refresh, authorized by the Worker secret and the room's `DO_ACTIVE` epoch
 * rather than a member's token. The Scene is read as the Campaign owner, who reads every presented
 * Scene; the cache is shared by every member.
 */
export const roomScene = internalQuery({
  args: zodToConvexFields(liveSessionRoomSceneCaptureInputSchema.shape),
  returns: zodToConvex(liveSessionRoomSceneCaptureSchema),
  handler: async (ctx, args): Promise<LiveSessionRoomSceneCapture> => {
    const input = liveSessionRoomSceneCaptureInputSchema.parse(args)
    await requireActiveCampaignLiveAuthority(ctx, input)
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', input.campaignId.toLowerCase()))
      .unique()
    if (!campaign) throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    await assertSceneVisionCharacters(ctx, input.observedCharacterRevisions)
    const presented = await readPresentedScene(ctx, campaign, campaign.ownerUserId)
    return liveSessionRoomSceneCaptureSchema.parse({
      ...presented,
      systemId: campaign.gameSystemId,
      observedCharacterRevisions: input.observedCharacterRevisions,
      visionFreshness: presented.sceneHeader
        ? await readSceneVisionFreshness(ctx, {
            campaignId: campaign.id,
            systemId: campaign.gameSystemId
          })
        : null
    })
  }
})
