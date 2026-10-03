import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  campaignStoredEntryIdentitySchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'

/** The paired header and payload of one chat or roll entry, for `insertConversationEntry`. */
export function buildConversationEntryRecords(input: {
  campaignId: string
  conversationId: string
  authorUserId: string
  clientNonce: string
  createdAt: string
  username: string | null
  content:
    | {
        kind: 'CHAT'
        mode: NonNullable<CampaignChatEntryDto['mode']>
        body: string
        character: { id: string; label: string } | null
      }
    | { kind: 'ROLL'; roll: RollRecordDto; revealedByGm: boolean }
    | { kind: 'ROLL_NOTICE'; creatureLabel: string | null }
}) {
  const { content } = input
  const identity = campaignStoredEntryIdentitySchema.parse({
    id: crypto.randomUUID(),
    campaignId: input.campaignId,
    conversationId: input.conversationId,
    authorUserId: input.authorUserId,
    clientNonce: input.clientNonce,
    createdAt: input.createdAt
  })
  const payload = campaignStoredEntryPayloadSchema.parse({
    entryId: identity.id,
    kind: content.kind,
    mode: content.kind === 'CHAT' ? content.mode : null,
    body: content.kind === 'CHAT' ? content.body : null,
    roll: content.kind === 'ROLL' ? content.roll : null,
    revealedByGm: content.kind === 'ROLL' && content.revealedByGm,
    authorUsername: input.username,
    characterId:
      content.kind === 'CHAT'
        ? (content.character?.id ?? null)
        : content.kind === 'ROLL'
          ? content.roll.characterId
          : null,
    characterLabel:
      content.kind === 'CHAT'
        ? (content.character?.label ?? null)
        : content.kind === 'ROLL_NOTICE'
          ? content.creatureLabel
          : content.roll.characterId === null
            ? null
            : content.roll.characterLabel,
    editedAt: null,
    unsentAt: null,
    consumedAt: null
  })
  return { identity, payload }
}
