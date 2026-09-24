import type { MutationCtx } from '../_generated/server'

export async function removeCampaignEncounterRuns(ctx: MutationCtx, campaignId: string) {
  const runs = await ctx.db
    .query('encounterRuns')
    .withIndex('by_campaignId_sessionId_createdAt_id', (q) => q.eq('campaignId', campaignId))
    .take(1)
  for (const run of runs) {
    const groups = await Promise.all([
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
        .take(8),
      ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
        .take(8),
      ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', run.id))
        .take(8),
      ctx.db
        .query('encounterInitiativeParticipants')
        .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', run.id))
        .take(8),
      ctx.db
        .query('encounterInitiativeSides')
        .withIndex('by_encounterId_round_sideId', (q) => q.eq('encounterId', run.id))
        .take(8),
      ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) => q.eq('encounterId', run.id))
        .take(8)
    ])
    for (const rows of groups) for (const row of rows) await ctx.db.delete(row._id)
    if (groups.some((rows) => rows.length > 0)) return false
    await ctx.db.delete(run._id)
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
