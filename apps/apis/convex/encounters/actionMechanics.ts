import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { applyEncounterMechanicsBatch } from './mechanicsBatch'
import {
  prepareNativeActionMechanicsBatches,
  finishNativeActionMechanicsSettlement,
  type NativeEncounterActionMechanicsInput
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import type { prepareNativeEncounterActionMechanics } from './actionMechanicsPreparation'

/** Settles the prepared source resource and target mechanics in the caller's transaction. */
export async function settleNativeEncounterActionMechanics(
  ctx: MutationCtx,
  input: NativeEncounterActionMechanicsInput & {
    prepared: Awaited<ReturnType<typeof prepareNativeEncounterActionMechanics>>
  }
) {
  const { sourceResourceBatch, targetBatch } = prepareNativeActionMechanicsBatches(input)
  const sourceResourceMechanics = sourceResourceBatch
    ? await applyEncounterMechanicsBatch(
        ctx,
        sourceResourceBatch,
        input.prepared.sourceFacts.characterFacts?.sourceContext
      )
    : null
  const mechanics = await applyEncounterMechanicsBatch(
    ctx,
    targetBatch,
    input.prepared.targetFacts.characterFacts?.sourceContext
  )
  const settled = finishNativeActionMechanicsSettlement(
    input.prepared,
    mechanics,
    sourceResourceMechanics
  )
  const beforeSource =
    sourceResourceMechanics?.updatedActor ??
    (mechanics.updatedActor.id === input.prepared.actor.id
      ? mechanics.updatedActor
      : input.prepared.actor)
  if (checksumCanonicalJson(beforeSource) !== checksumCanonicalJson(settled.settledSource)) {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', input.encounterId).eq('id', beforeSource.id)
      )
      .unique()
    if (!row || row.stateChecksum !== checksumCanonicalJson(beforeSource))
      throw new Error('Encounter action source changed before settlement.')
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(settled.settledSource),
      stateChecksum: checksumCanonicalJson(settled.settledSource)
    })
  }
  return settled
}
