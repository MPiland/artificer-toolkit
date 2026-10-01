import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  campaignStoredEntryIdentitySchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { insertConversationEntry, openConversation } from './conversationPersistence.js'
import type { CampaignAuthority } from './ports.js'
import type { EncounterDocument, EncounterWriteContext } from './store.js'

/** Inserts an already-authorized RollRecord without evaluating or retaining it again. */
export async function insertPreEvaluatedCampaignTableRoll(
  ctx: EncounterWriteContext,
  authority: CampaignAuthority,
  userId: string,
  clientNonce: string,
  roll: RollRecordDto,
  callbacks: {
    requireAuthenticatedUsername(userId: string): Promise<string>
    requirePeerAuthority(campaignId: string, userId: string): Promise<CampaignAuthority>
    readEntryPayload(
      entryId: string
    ): Promise<ReturnType<typeof campaignStoredEntryPayloadSchema.parse>>
    readCampaignAccessTime(campaign: CampaignAuthority['campaign']): Promise<number>
    consumeConversationRate(userId: string): Promise<void>
    presentChatEntry(
      header: ReturnType<typeof campaignStoredEntryIdentitySchema.parse>,
      payload: ReturnType<typeof campaignStoredEntryPayloadSchema.parse>,
      conversation: EncounterDocument<'campaignConversations'>,
      contentMaturity: CampaignAuthority['campaign']['contentMaturity']
    ): Promise<CampaignChatEntryDto>
  }
): Promise<CampaignChatEntryDto> {
  const username = await callbacks.requireAuthenticatedUsername(userId)
  const { conversation, member } = await openConversation(
    ctx,
    authority,
    'TABLE',
    callbacks.requirePeerAuthority
  )
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
    const payload = await callbacks.readEntryPayload(prior.id)
    if (
      payload.entryId !== prior.id ||
      payload.kind !== 'ROLL' ||
      payload.roll === null ||
      checksumCanonicalJson(payload.roll) !== checksumCanonicalJson(roll) ||
      payload.authorUsername !== username ||
      payload.characterId !== null ||
      payload.characterLabel !== roll.characterLabel ||
      payload.mode !== null ||
      payload.body !== null ||
      payload.editedAt !== null ||
      payload.unsentAt !== null
    )
      throw new Error('Chat nonce was used with a different roll.')
    return callbacks.presentChatEntry(
      prior,
      payload,
      conversation,
      authority.campaign.contentMaturity
    )
  }
  const now = await callbacks.readCampaignAccessTime(authority.campaign)
  await callbacks.consumeConversationRate(userId)
  const header = campaignStoredEntryIdentitySchema.parse({
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
    authorUsername: username,
    characterId: null,
    characterLabel: roll.characterLabel,
    editedAt: null,
    unsentAt: null,
    consumedAt: null
  })
  await insertConversationEntry(ctx, header, payload)
  return callbacks.presentChatEntry(
    header,
    payload,
    conversation,
    authority.campaign.contentMaturity
  )
}
