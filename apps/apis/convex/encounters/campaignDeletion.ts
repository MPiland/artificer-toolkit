import type { MutationCtx } from '../_generated/server'

/** Deletes one bounded page of a Run's child rows and reports whether none remained. */
export async function removeEncounterRunChildren(ctx: MutationCtx, encounterId: string) {
  const groups = await Promise.all([
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterActorProjectionFacts')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterSourceProjectionFacts')
      .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterPendingSnapshotParts')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterSceneBindings')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterInitiativeSides')
      .withIndex('by_encounterId_round_sideId', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterInitiativeRounds')
      .withIndex('by_encounterId_round', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterEvidenceRolls')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterTurnMovements')
      .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
        q.eq('encounterId', encounterId)
      )
      .take(8),
    ctx.db
      .query('encounterDecisionSkips')
      .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (q) =>
        q.eq('encounterId', encounterId)
      )
      .take(8)
  ])
  for (const rows of groups) for (const row of rows) await ctx.db.delete(row._id)
  return groups.every((rows) => rows.length === 0)
}

export async function removeCampaignEncounterRuns(ctx: MutationCtx, campaignId: string) {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaignId))
    .first()
  if (run) {
    if (await removeEncounterRunChildren(ctx, run.id)) await ctx.db.delete(run._id)
    return false
  }
  const groups = await Promise.all([
    ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaignId))
      .take(1),
    ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaignId))
      .take(1),
    ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_campaignId_rootCommandId', (q) => q.eq('campaignId', campaignId))
      .take(1)
  ])
  for (const rows of groups) for (const row of rows) await ctx.db.delete(row._id)
  return groups.every((rows) => rows.length === 0)
}
