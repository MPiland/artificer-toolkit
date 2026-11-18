import type {
  CampaignChatEntryDto,
  CampaignChatRollDto
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { campaignStoredEntrySchema } from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'

/** The stored document of one chat or roll entry, for `insertConversationEntry`. */
export function buildConversationEntry(input: {
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
    | { kind: 'ROLL'; rolls: readonly [CampaignChatRollDto, ...CampaignChatRollDto[]] }
    | { kind: 'ROLL_NOTICE'; creatureLabel: string | null }
}) {
  const { content } = input
  // The card is attributed to its first roll's creature.
  const lead = content.kind === 'ROLL' ? content.rolls[0].roll : null
  return campaignStoredEntrySchema.parse({
    id: crypto.randomUUID(),
    campaignId: input.campaignId,
    conversationId: input.conversationId,
    authorUserId: input.authorUserId,
    clientNonce: input.clientNonce,
    createdAt: input.createdAt,
    kind: content.kind,
    mode: content.kind === 'CHAT' ? content.mode : null,
    body: content.kind === 'CHAT' ? content.body : null,
    rolls:
      content.kind === 'ROLL' ? content.rolls.map((entry) => ({ ...entry, consumedAt: null })) : [],
    authorUsername: input.username,
    characterId:
      content.kind === 'CHAT' ? (content.character?.id ?? null) : (lead?.characterId ?? null),
    characterLabel:
      content.kind === 'CHAT'
        ? (content.character?.label ?? null)
        : content.kind === 'ROLL_NOTICE'
          ? content.creatureLabel
          : lead && lead.characterId !== null
            ? lead.characterLabel
            : null,
    editedAt: null,
    unsentAt: null
  })
}
