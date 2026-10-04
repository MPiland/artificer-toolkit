import { deleteReceiptHeaders } from '../lib/receiptLedgers'
import type { MutationCtx } from '../_generated/server'

/**
 * Deletes every Convex-held Encounter history header and replay-index row of one Run. After COMPLETE
 * nothing of a Run's timeline remains (ADR 0035 Amendment 22).
 */
export async function removeEncounterRunTimeline(ctx: MutationCtx, encounterId: string) {
  for (;;) {
    const [commands, rules, evidence, index] = await Promise.all([
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
        .take(64),
      ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', encounterId))
        .take(64),
      ctx.db
        .query('encounterEvidenceRolls')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
        .take(64),
      ctx.db
        .query('encounterReplayIndex')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
        .take(64)
    ])
    if (![commands, rules, evidence, index].some((rows) => rows.length)) return
    await deleteReceiptHeaders(ctx, [
      ...commands.map((header) => ({ table: 'encounterRunCommands' as const, header })),
      ...rules.map((header) => ({ table: 'encounterRuleReceipts' as const, header })),
      ...evidence.map((header) => ({ table: 'encounterEvidenceRolls' as const, header }))
    ])
    for (const row of index) await ctx.db.delete(row._id)
  }
}

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
      .take(1),
    ctx.db
      .query('encounterTurnMovements')
      .withIndex('by_encounterId_round_turnActorId_actorId', (q) => q.eq('encounterId', encounterId)
      )
      .take(8),
    ctx.db
      .query('encounterReplayIndex')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterDecisionSkips')
      .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (q) => q.eq('encounterId', encounterId)
      )
      .take(8)
  ])
  const evidenceRolls = groups[9]
  await deleteReceiptHeaders(
    ctx,
    evidenceRolls.map((header) => ({
      table: 'encounterEvidenceRolls',
      header
    }))
  )
  for (const rows of groups)
    if (rows !== evidenceRolls) for (const row of rows) await ctx.db.delete(row._id)
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
  await deleteReceiptHeaders(ctx, [
    ...groups[0].map((header) => ({
      table: 'encounterRunCommands' as const,
      header
    })),
    ...groups[1].map((header) => ({
      table: 'encounterRuleReceipts' as const,
      header
    }))
  ])
  for (const row of groups[2]) await ctx.db.delete(row._id)
  return groups.every((rows) => rows.length === 0)
}
