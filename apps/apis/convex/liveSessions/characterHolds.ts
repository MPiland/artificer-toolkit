import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { liveCharacterHoldSchema } from '@artificer-toolkit/schema/projections/liveCharacterHold'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'

/** The unfrozen Characters of the given Runs that are ACTIVE, with the Run each one fights in. */
export async function readFightingCharacters(
  ctx: MutationCtx,
  campaignId: string,
  runs: ReadonlyArray<Doc<'encounterRuns'> | null>
) {
  const fighting: Array<{ characterId: string; encounterId: string }> = []
  const context = { db: createConvexEncounterStoreReader(ctx) }
  for (const row of runs) {
    if (!row) continue
    const state = readRunState(row)
    if (state.campaignId !== campaignId) throw new Error('Character hold Run scope mismatch.')
    if (state.status !== 'ACTIVE') continue
    for (const actor of await readRunActors(context, state))
      if (actor.kind === 'CHARACTER' && !actor.frozenState)
        fighting.push({ characterId: actor.sourceId, encounterId: state.id })
  }
  return fighting
}

/** Activation covers current active Runs; checkpoints reconcile only the Runs they changed. */
export async function reconcileCharacterHolds(
  ctx: MutationCtx,
  campaignId: string,
  epoch: string,
  encounterIds?: ReadonlySet<string>
) {
  const prior = await ctx.db
    .query('liveCharacterHolds')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .collect()
  const runs = encounterIds
    ? await Promise.all(
        [...encounterIds].map((id) =>
          ctx.db
            .query('encounterRuns')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
        )
      )
    : await ctx.db
        .query('encounterRuns')
        .withIndex('by_campaignId_status', (q) =>
          q.eq('campaignId', campaignId).eq('status', 'ACTIVE')
        )
        .collect()
  const expected = new Map<string, ReturnType<typeof liveCharacterHoldSchema.parse>>()
  for (const { characterId, encounterId } of await readFightingCharacters(ctx, campaignId, runs)) {
    const hold = liveCharacterHoldSchema.parse({ characterId, campaignId, encounterId, epoch })
    expected.set(`${hold.encounterId}:${hold.characterId}`, hold)
  }
  for (const hold of prior) {
    if (encounterIds && !encounterIds.has(hold.encounterId)) continue
    const key = `${hold.encounterId}:${hold.characterId}`
    const next = expected.get(key)
    if (!next) await ctx.db.delete(hold._id)
    else {
      if (hold.epoch !== epoch) await ctx.db.replace(hold._id, next)
      expected.delete(key)
    }
  }
  for (const hold of expected.values()) await ctx.db.insert('liveCharacterHolds', hold)
}

/** Called only after the room's final checkpoint has passed the release fence. */
export async function releaseCharacterHolds(ctx: MutationCtx, campaignId: string, epoch: string) {
  const holds = await ctx.db
    .query('liveCharacterHolds')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .collect()
  for (const hold of holds) if (hold.epoch === epoch) await ctx.db.delete(hold._id)
}
