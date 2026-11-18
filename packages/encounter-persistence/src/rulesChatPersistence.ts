import {
  ruleCheckAuthorLabel,
  type CampaignChatEntryDto
} from '@artificer-toolkit/schema/api/campaignCommunication'
import { campaignStoredEntrySchema } from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import type { CampaignAuthority, EncounterReadPorts, EncounterWritePorts } from './ports.js'
import type { EncounterWriteContext } from './store.js'
import { readActiveCampaignMembers } from './campaignMemberships.js'
import { insertConversationEntry, openConversation } from './conversationPersistence.js'
import { presentChatEntries } from './conversationPresentation.js'

/**
 * The enclosing rules occurrence guards replay and commits this message with its mechanics.
 * Returns the posted entry so the room can fan it out in the commit.
 */
export async function postRulesChatMessage(
  ctx: EncounterWriteContext & {
    readonly ports: Pick<EncounterReadPorts, 'requireCampaignAuthority'>
  },
  authority: CampaignAuthority,
  input: Parameters<EncounterWritePorts['postRulesChatMessage']>[1]
): Promise<CampaignChatEntryDto> {
  const { campaign } = authority
  const { conversation } = await openConversation(ctx, authority, 'TABLE', (campaignId, userId) =>
    ctx.ports.requireCampaignAuthority(campaignId, userId)
  )
  const members = await readActiveCampaignMembers(ctx.db.query('campaignMemberships'), campaign)
  const stored = await insertConversationEntry(
    ctx,
    campaignStoredEntrySchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      conversationId: conversation.id,
      authorUserId: input.authorUserId,
      clientNonce: input.clientNonce,
      createdAt: new Date(
        Math.max(Date.now(), ...members.map((member) => Date.parse(member.accessStartedAt)))
      ).toISOString(),
      kind: 'CHAT',
      mode: 'OOC',
      body: input.body,
      rolls: [],
      authorUsername: ruleCheckAuthorLabel,
      characterId: null,
      characterLabel: null,
      editedAt: null,
      unsentAt: null
    })
  )
  const [entry] = presentChatEntries([stored], conversation, campaign.contentMaturity, [
    ruleCheckAuthorLabel
  ])
  return entry!
}
