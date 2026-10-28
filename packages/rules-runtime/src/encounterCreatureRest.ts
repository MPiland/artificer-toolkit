import { getRestRecoveryTriggers } from './character/sheetRest.js'
import {
  featureChargeUsed,
  snapshotFeatureDefinitions,
  withFeatureChargeUsed
} from './encounterActorState.js'

type CreatureRestActor = Parameters<typeof snapshotFeatureDefinitions>[0] & { resources: unknown }

/**
 * One spent charge, spell slot row or spell grant charge pool a rest gave back, keyed by the feature
 * id, the slot row id or the pool id.
 */
export type CreatureRestReset = { key: string; beforeUsed: number }

/**
 * The spent feature charges, spell slot rows and spell grant charge pools a rest recovers on `actor`
 * (an X/day pool resets at dawn, not on a rest): those whose `resetKind`
 * the rest recovers, with how many were spent before. `resources` is the actor's resources after.
 */
export function planCreatureRest(
  actor: CreatureRestActor,
  restKind: 'SHORT' | 'LONG'
): { resets: CreatureRestReset[]; resources: unknown } {
  const triggers: ReadonlySet<string> = getRestRecoveryTriggers(restKind)
  const resets: CreatureRestReset[] = []
  let resources = actor.resources
  const recover = (key: string) => {
    const beforeUsed = featureChargeUsed(actor, key)
    if (beforeUsed === 0) return
    resets.push({ key, beforeUsed })
    resources = withFeatureChargeUsed({ resources }, key, 0)
  }
  for (const feature of snapshotFeatureDefinitions(actor)) {
    const charges = feature.charges
    if (charges && 'resetKind' in charges && triggers.has(charges.resetKind)) recover(feature.id)
    const slots = feature.grants?.spellSlots
    if (slots && triggers.has(slots.resetKind)) for (const row of slots.levels) recover(row.id)
    for (const grant of feature.grants?.spells ?? [])
      if (grant.charges && 'resetKind' in grant.charges && triggers.has(grant.charges.resetKind))
        recover(grant.charges.id)
  }
  return { resets, resources }
}
