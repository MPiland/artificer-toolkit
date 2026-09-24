import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  liveSessionTransientCaptureInputSchema,
  liveSessionTransientCaptureSchema,
  type LiveSessionTransientCapture,
  type LiveSessionTransientMember
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { Doc } from '../_generated/dataModel'
import { internalQuery } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireSession } from '../campaigns/sessionDocuments'
import { requireIdentity } from '../lib/identity'
import { readLiveScene } from '../scenes/liveDocuments'
import { readCompactScene } from '../scenes/recipientReads'
import { assertSceneVisionCharacters, readSceneVisionFreshness } from '../scenes/visionFreshness'

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
    const session = await requireSession(ctx, campaign.id, input.sessionId)
    if (session.status !== 'OPEN') throw new Error('Live Session is not open.')

    const fullCapture = input.mode !== 'AUTHORITY'
    if (fullCapture) await assertSceneVisionCharacters(ctx, input.observedCharacterRevisions)

    const presentation = await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId_sessionId', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionId', session.id)
      )
      .unique()
    const scene =
      presentation?.sceneId === null || presentation === null
        ? null
        : await readLiveScene(ctx, presentation.sceneId, 'MEMBER')
    if (scene && scene.campaign.id !== campaign.id)
      throw new Error('Live Session presentation Scene belongs to another Campaign.')
    const sceneEncounterBound =
      scene !== null &&
      (await ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_sceneId', (q) => q.eq('sceneId', scene.header.id))
        .first()) !== null
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
        ? { sceneId: presentation.sceneId, sessionId: session.id, version: presentation.version }
        : null,
      recipients: recipients.filter(
        (recipient): recipient is LiveSessionTransientMember => recipient !== null
      ),
      sceneEncounterBound,
      sceneHeader: scene?.header ?? null,
      ...(sceneSnapshot === undefined ? {} : { sceneSnapshot }),
      session: { id: session.id, version: session.version },
      visionFreshness:
        fullCapture && scene
          ? await readSceneVisionFreshness(ctx, {
              campaignId: campaign.id,
              sessionId: session.id,
              systemId: campaign.gameSystemId
            })
          : null
    })
  }
})
