import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  campaignStoredEntryHeaderSchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { getAuthenticatedProfile } from '../lib/identity'
import type { requireCampaignAuthority } from './authority'
import {
  insertConversationEntry,
  openConversation,
  presentChatEntry,
  readEntryPayload,
  readCampaignAccessTime
} from './conversationDocuments'
import { consumeUserRateLimit } from '../lib/rateLimits'

/** Inserts an already-authorized RollRecord without evaluating or retaining it again. */
export async function insertPreEvaluatedCampaignTableRoll(
  ctx: MutationCtx,
  authority: Awaited<ReturnType<typeof requireCampaignAuthority>>,
  userId: string,
  clientNonce: string,
  roll: RollRecordDto
): Promise<CampaignChatEntryDto> {
  const actor = await getAuthenticatedProfile(ctx)
  if (!actor || actor.identity.userId !== userId) throw new Error('Unauthenticated')
  if (!actor.username) throw new Error('A username is required to participate in Campaign chat.')
  const { conversation, member } = await openConversation(ctx, authority, 'TABLE')
  const normalizedNonce = clientNonce.toLowerCase()
  const prior = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
      q
        .eq('campaignId', authority.campaign.id)
        .eq('authorUserId', userId)
        .eq('clientNonce', normalizedNonce)
    )
    .unique()
  if (prior) {
    if (prior.conversationId !== conversation.id)
      throw new Error('Chat nonce was used in another conversation.')
    if (prior.createdAt < member.accessStartedAt) throw new Error('Chat entry not found.')
    const payload = await readEntryPayload(ctx, prior.id)
    if (
      payload.entryId !== prior.id ||
      payload.kind !== 'ROLL' ||
      payload.roll === null ||
      checksumCanonicalJson(payload.roll) !== checksumCanonicalJson(roll) ||
      payload.authorUsername !== actor.username ||
      payload.characterId !== null ||
      payload.characterLabel !== roll.characterLabel ||
      payload.mode !== null ||
      payload.body !== null ||
      payload.editedAt !== null ||
      payload.unsentAt !== null
    )
      throw new Error('Chat nonce was used with a different roll.')
    return presentChatEntry(ctx, prior, payload, conversation, authority.campaign.contentMaturity)
  }
  const now = await readCampaignAccessTime(ctx, authority.campaign)
  await consumeUserRateLimit(ctx, 'campaignConversation', userId)
  const header = campaignStoredEntryHeaderSchema.parse({
    id: crypto.randomUUID(),
    campaignId: authority.campaign.id,
    conversationId: conversation.id,
    authorUserId: userId,
    clientNonce: normalizedNonce,
    createdAt: new Date(now).toISOString()
  })
  const payload = campaignStoredEntryPayloadSchema.parse({
    entryId: header.id,
    kind: 'ROLL',
    mode: null,
    body: null,
    roll,
    revealedByGm: false,
    authorUsername: actor.username,
    characterId: null,
    characterLabel: roll.characterLabel,
    editedAt: null,
    unsentAt: null,
    consumedAt: null
  })
  await insertConversationEntry(ctx, header, payload)
  return presentChatEntry(ctx, header, payload, conversation, authority.campaign.contentMaturity)
}
