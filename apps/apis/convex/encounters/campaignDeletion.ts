import { removeFinishedRunRowsPage } from '@artificer-toolkit/encounter-persistence/finishedRunRows'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { deleteReceiptHeaders } from '../lib/receiptLedgers'
import type { MutationCtx } from '../_generated/server'

/**
 * Deletes one bounded page of the Convex-held rows a Run stops needing, and reports whether none
 * was found: the command and rule receipt headers with their receipt ledgers, then
 * every other child row a finished Run no longer needs (`removeFinishedRunRowsPage`).
 */
async function removeFinishedRunPage(ctx: MutationCtx, encounterId: string, limit: number) {
  const [commands, rules] = await Promise.all([
    ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', encounterId))
      .take(limit)
  ])
  await deleteReceiptHeaders(ctx, [
    ...commands.map((header) => ({ table: 'encounterRunCommands' as const, header })),
    ...rules.map((header) => ({ table: 'encounterRuleReceipts' as const, header }))
  ])
  const rowsFinished = await removeFinishedRunRowsPage(
    { db: createConvexEncounterStore(ctx) },
    encounterId,
    limit
  )
  return rowsFinished && ![commands, rules].some((rows) => rows.length)
}

/**
 * Deletes every Convex-held row of a completed Run except the Run, its actors and the source facts
 * they name: the GM's finished Encounter reads only those (ADR 0035 Amendment 30).
 */
export async function removeFinishedRunRows(ctx: MutationCtx, encounterId: string) {
  let finished = false
  while (!finished) finished = await removeFinishedRunPage(ctx, encounterId, 64)
}

/** Deletes one bounded page of a Run's child rows and reports whether none remained. */
export async function removeEncounterRunChildren(ctx: MutationCtx, encounterId: string) {
  const [finished, actors, sources, spellPins, loot] = await Promise.all([
    removeFinishedRunPage(ctx, encounterId, 8),
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterSourceProjectionFacts')
      .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('encounterSpellPins')
      .withIndex('by_encounterId_spellId', (q) => q.eq('encounterId', encounterId))
      .take(8),
    ctx.db
      .query('lootTables')
      .withIndex('by_actor', (q) =>
        q.eq('owner.kind', 'ENCOUNTER_ACTOR').eq('owner.encounterId', encounterId)
      )
      .take(8)
  ])
  for (const row of [...actors, ...sources, ...spellPins, ...loot]) await ctx.db.delete(row._id)
  return (
    finished &&
    actors.length === 0 &&
    sources.length === 0 &&
    spellPins.length === 0 &&
    loot.length === 0
  )
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
