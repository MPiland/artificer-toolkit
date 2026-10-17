import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '@artificer-toolkit/schema/shared/spatial'
import type { EncounterReadContext, EncounterWriteContext } from './store.js'

/** The placed zones that depend on a maintained state and end with it (D135). */
export function listStateZones(
  ctx: EncounterReadContext,
  input: { encounterId: string; stateId: string }
) {
  return ctx.db
    .query('encounterSpatialRuleEffects')
    .withIndex('by_state_encounter', (q) =>
      q.eq('maintainedEffectStateId', input.stateId).eq('encounterId', input.encounterId)
    )
    .take(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
}

/** Deletes the zones a maintained state's end takes with it, in the transaction that ends the state. */
export async function deleteStateZones(
  ctx: EncounterWriteContext,
  zones: Awaited<ReturnType<typeof listStateZones>>
) {
  for (const zone of zones) await ctx.db.delete(zone._id)
}
