import { ruleCheckAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import {
  campaignStoredEntryIdentitySchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { concentrationCheckRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import { readActiveCampaignMembers } from './campaignMemberships.js'
import { insertConversationEntry, openConversation } from './conversationPersistence.js'
import { presentChatEntries } from './conversationPresentation.js'
import { readRunActor } from './documents.js'
import type { EncounterPersistenceTransaction, EncounterWritePorts } from './ports.js'
import { readRuleRollRouting, retainPrivateRuleRoll } from './ruleRollCards.js'

/**
 * Logs one settled Concentration check, prompted or automatic, as a system roll entry. The roller
 * is the checked actor, so its card follows the rule-roll routing (Q14): a player's check is the
 * table's and authored by that player, a hidden creature's is private (the GM's, and the
 * controlling player's own copy, D62), another GM creature's follows the GM's stored preference.
 * The entry id is the check's idempotency key, and it spends no chat rate limit: its command was
 * already limited. Returns the table entry it posted.
 */
export async function recordConcentrationCheckRoll(
  ctx: EncounterPersistenceTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'retainPrivateRoll'>
  },
  input: Parameters<EncounterWritePorts['recordConcentrationCheckRoll']>[0]
): Promise<CampaignChatEntryDto | null> {
  const { state, result } = input
  if (result.status !== 'COMPLETE' || result.applicationOutputs.kind !== 'CONCENTRATION_CHECK')
    throw new Error('Only a completed Concentration check is logged.')
  const actor = await readRunActor(ctx, state, result.applicationOutputs.application.targetActorId)
  const system = await ctx.ports.requireSystem(state.gameSystemId)
  const roll = concentrationCheckRollRecord({
    output: result.applicationOutputs,
    actorLabel: actor.label,
    ruleset: {
      systemId: system.id,
      code: system.rulesetCode,
      version: system.rulesetVersion
    },
    createdAt: input.occurredAt
  })
  const { campaign } = await ctx.ports.requireCampaignAuthority(
    state.campaignId,
    input.authorUserId
  )
  const { audience, authorUserId } = await readRuleRollRouting(ctx, {
    campaign,
    roller: actor,
    initiatorUserId: input.authorUserId,
    visibility: undefined
  })
  if (audience === 'PRIVATE') {
    await retainPrivateRuleRoll(ctx, {
      campaign,
      creature: { encounterId: state.id, actorId: actor.id },
      authorUserId,
      roll
    })
    return null
  }
  const authority = await ctx.ports.requireCampaignAuthority(campaign.id, authorUserId)
  const { conversation } = await openConversation(ctx, authority, 'TABLE', (campaignId, userId) =>
    ctx.ports.requireCampaignAuthority(campaignId, userId)
  )
  const prior = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
      q.eq('campaignId', campaign.id).eq('authorUserId', authorUserId).eq('clientNonce', roll.id)
    )
    .unique()
  if (prior) return null
  const entryId = crypto.randomUUID()
  const members = await readActiveCampaignMembers(ctx.db.query('campaignMemberships'), campaign)
  const header = campaignStoredEntryIdentitySchema.parse({
    id: entryId,
    campaignId: campaign.id,
    conversationId: conversation.id,
    authorUserId,
    clientNonce: roll.id,
    createdAt: new Date(
      Math.max(Date.now(), ...members.map((member) => Date.parse(member.accessStartedAt)))
    ).toISOString()
  })
  const payload = campaignStoredEntryPayloadSchema.parse({
    entryId: header.id,
    kind: 'ROLL',
    mode: null,
    body: null,
    roll,
    revealedByGm: false,
    authorUsername: ruleCheckAuthorLabel,
    characterId: null,
    characterLabel: roll.characterLabel,
    editedAt: null,
    unsentAt: null,
    consumedAt: null
  })
  const stored = await insertConversationEntry(ctx, header, payload)
  const [entry] = presentChatEntries(
    [{ header: stored, payload }],
    conversation,
    campaign.contentMaturity,
    [ruleCheckAuthorLabel]
  )
  return entry!
}
