import { ruleCheckAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  campaignStoredEntryHeaderSchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { concentrationCheckRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import {
  insertConversationEntry,
  openConversation,
  readCampaignAccessTime
} from '../campaigns/conversationDocuments'
import { requireSystem } from '../content/systemDocuments'
import { retainUserRoll } from '../rollDocuments'
import { readRunActor } from '@artificer-toolkit/encounter-persistence/documents'

/**
 * Logs one settled Concentration check, prompted or automatic, as a system roll entry. A hidden
 * actor's check goes to the GM's private roll history, like any hidden roll. The entry id is the
 * check's idempotency key, and it spends no chat rate limit: its command was already limited.
 */
export async function recordConcentrationCheckRoll(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    result: StoredRuleExecutionResultDto
    /** The member whose command settled the check; the entry is filed under them. */
    authorUserId: string
    occurredAt: string
  }
) {
  const { state, result } = input
  if (result.status !== 'COMPLETE' || result.applicationOutputs.kind !== 'CONCENTRATION_CHECK')
    throw new Error('Only a completed Concentration check is logged.')
  const actor = await readRunActor(ctx, state, result.applicationOutputs.application.targetActorId)
  const system = await requireSystem(ctx, state.gameSystemId)
  const roll = concentrationCheckRollRecord({
    output: result.applicationOutputs,
    actorLabel: actor.label,
    ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
    createdAt: input.occurredAt
  })
  const authority = await requireCampaignAuthority(ctx, state.campaignId, input.authorUserId)
  const { campaign } = authority
  if (!actor.public) {
    const retained = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_id', (q) => q.eq('userId', campaign.ownerUserId).eq('id', roll.id))
      .unique()
    if (!retained)
      await retainUserRoll(ctx, campaign.ownerUserId, roll, {
        campaignId: campaign.id,
        blind: false,
        revealedAt: null
      })
    return
  }
  const { conversation } = await openConversation(ctx, authority, 'TABLE')
  const prior = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
      q
        .eq('campaignId', campaign.id)
        .eq('authorUserId', input.authorUserId)
        .eq('clientNonce', roll.id)
    )
    .unique()
  if (prior) return
  const header = campaignStoredEntryHeaderSchema.parse({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    conversationId: conversation.id,
    authorUserId: input.authorUserId,
    clientNonce: roll.id,
    createdAt: new Date(await readCampaignAccessTime(ctx, campaign)).toISOString()
  })
  await insertConversationEntry(
    ctx,
    header,
    campaignStoredEntryPayloadSchema.parse({
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
  )
}
