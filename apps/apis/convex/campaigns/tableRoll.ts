import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { insertPreEvaluatedCampaignTableRoll as insertStoredCampaignTableRoll } from '@artificer-toolkit/encounter-persistence/tableRollPersistence'
import type { MutationCtx } from '../_generated/server'
import { getAuthenticatedProfile } from '../lib/identity'
import { requireCampaignAuthorUsername } from './authorLabels'
import { requireCampaignAuthority } from './authority'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { presentChatEntry, readEntryPayload, readCampaignAccessTime } from './conversationDocuments'
import { consumeUserRateLimit } from '../lib/rateLimits'

/** Inserts an already-authorized RollRecord without evaluating or retaining it again. */
export async function insertPreEvaluatedCampaignTableRoll(
  ctx: MutationCtx,
  authority: Awaited<ReturnType<typeof requireCampaignAuthority>>,
  userId: string,
  clientNonce: string,
  roll: RollRecordDto
): Promise<CampaignChatEntryDto> {
  return insertStoredCampaignTableRoll(
    { db: createConvexEncounterStore(ctx) },
    authority,
    userId,
    clientNonce,
    roll,
    {
      requireAuthenticatedUsername: async (userId) => {
        const actor = await getAuthenticatedProfile(ctx)
        if (!actor || actor.identity.userId !== userId) throw new Error('Unauthenticated')
        requireCampaignAuthorUsername(actor.username)
        return actor.username
      },
      requirePeerAuthority: (campaignId, userId) =>
        requireCampaignAuthority(ctx, campaignId, userId),
      readEntryPayload: (entryId) => readEntryPayload(ctx, entryId),
      readCampaignAccessTime: (campaign) => readCampaignAccessTime(ctx, campaign),
      consumeConversationRate: (userId) =>
        consumeUserRateLimit(ctx, 'campaignConversation', userId),
      presentChatEntry: (header, payload, conversation, contentMaturity) =>
        presentChatEntry(ctx, header, payload, conversation, contentMaturity)
    }
  )
}
