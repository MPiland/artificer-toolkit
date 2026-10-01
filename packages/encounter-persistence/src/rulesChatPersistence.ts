import { ruleCheckAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import {
  campaignStoredEntryIdentitySchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import type { CampaignAuthority, EncounterReadPorts, EncounterWritePorts } from './ports.js'
import type { EncounterWriteContext } from './store.js'
import { readActiveCampaignMembers } from './campaignMemberships.js'
import { insertConversationEntry, openConversation } from './conversationPersistence.js'

/** The enclosing rules occurrence guards replay and commits this message with its mechanics. */
export async function postRulesChatMessage(
  ctx: EncounterWriteContext & {
    readonly ports: Pick<EncounterReadPorts, 'requireCampaignAuthority'>
  },
  authority: CampaignAuthority,
  input: Parameters<EncounterWritePorts['postRulesChatMessage']>[1]
) {
  const { campaign } = authority
  const { conversation } = await openConversation(ctx, authority, 'TABLE', (campaignId, userId) =>
    ctx.ports.requireCampaignAuthority(campaignId, userId)
  )
  const members = await readActiveCampaignMembers(ctx.db.query('campaignMemberships'), campaign)
  const identity = campaignStoredEntryIdentitySchema.parse({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    conversationId: conversation.id,
    authorUserId: input.authorUserId,
    clientNonce: input.clientNonce,
    createdAt: new Date(
      Math.max(Date.now(), ...members.map((member) => Date.parse(member.accessStartedAt)))
    ).toISOString()
  })
  await insertConversationEntry(
    ctx,
    identity,
    campaignStoredEntryPayloadSchema.parse({
      entryId: identity.id,
      kind: 'CHAT',
      mode: 'OOC',
      body: input.body,
      roll: null,
      revealedByGm: false,
      authorUsername: ruleCheckAuthorLabel,
      characterId: null,
      characterLabel: null,
      editedAt: null,
      unsentAt: null,
      consumedAt: null
    })
  )
}
