import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { campaignStoredEntrySchema } from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  insertConversationEntry,
  openConversation,
  readConversationEntryReplay
} from './conversationPersistence.js'
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
    readCampaignAccessTime(campaign: CampaignAuthority['campaign']): Promise<number>
    consumeConversationRate(userId: string): Promise<void>
    presentChatEntry(
      entry: ReturnType<typeof campaignStoredEntrySchema.parse>,
      conversation: EncounterDocument<'campaignConversations'>,
      contentMaturity: CampaignAuthority['campaign']['contentMaturity']
    ): Promise<CampaignChatEntryDto>
  }
): Promise<CampaignChatEntryDto> {
  const username = await callbacks.requireAuthenticatedUsername(userId)
  const access = await openConversation(ctx, authority, 'TABLE', callbacks.requirePeerAuthority)
  const { conversation } = access
  const normalizedNonce = clientNonce.toLowerCase()
  const prior = await readConversationEntryReplay(ctx, access, userId, normalizedNonce, 'ROLL')
  if (prior) {
    if (
      prior.roll === null ||
      checksumCanonicalJson(prior.roll) !== checksumCanonicalJson(roll) ||
      prior.authorUsername !== username ||
      prior.characterId !== null ||
      prior.characterLabel !== roll.characterLabel ||
      prior.mode !== null ||
      prior.body !== null ||
      prior.editedAt !== null ||
      prior.unsentAt !== null
    )
      throw new Error('Chat nonce was used with a different roll.')
    return callbacks.presentChatEntry(prior, conversation, authority.campaign.contentMaturity)
  }
  const now = await callbacks.readCampaignAccessTime(authority.campaign)
  await callbacks.consumeConversationRate(userId)
  const stored = await insertConversationEntry(
    ctx,
    campaignStoredEntrySchema.parse({
      id: crypto.randomUUID(),
      campaignId: authority.campaign.id,
      conversationId: conversation.id,
      authorUserId: userId,
      clientNonce: normalizedNonce,
      createdAt: new Date(now).toISOString(),
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
  )
  return callbacks.presentChatEntry(stored, conversation, authority.campaign.contentMaturity)
}
