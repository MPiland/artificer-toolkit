import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterActionEconomyConsumption } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import {
  featureChargeUsed,
  encounterRuleUsageUsed,
  withEncounterRuleUsageUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { revertEncounterSpellCastingTransition } from '@artificer-toolkit/rules-runtime/encounterSpellCasting'
import { revertUnavailable } from './targetMechanicsInverse.js'

export const FEATURE_CHARGES_CHANGED =
  "The actor's feature charges changed after this action; adjust manually."

/**
 * Gives a Creature feature's spent charges, or the spell slot its cast spent, back, refusing if they
 * changed since.
 */
export function returnSpentFeatureCharge(
  actor: EncounterRunActorState,
  feature: {
    ownerActorId: string
    ownerFeatureId: string
    /** The slot row a spell cast spent; its use is counted under the row, not the Feature. */
    slotRowId?: string
    beforeUsed: number
    afterUsed: number
  } | null
): EncounterRunActorState {
  if (!feature) return actor
  if (feature.ownerActorId !== actor.id)
    throw new Error('Stored feature charge receipt is invalid.')
  const chargeKey = feature.slotRowId ?? feature.ownerFeatureId
  if (featureChargeUsed(actor, chargeKey) !== feature.afterUsed)
    revertUnavailable(FEATURE_CHARGES_CHANGED)
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: withFeatureChargeUsed(actor, chargeKey, feature.beforeUsed)
  })
}

/** Gives a spent allowance back, refusing if the actor used it again since. */
export function returnSpentActionEconomy(
  actor: EncounterRunActorState,
  economy: EncounterActionEconomyConsumption | null
): EncounterRunActorState {
  if (!economy) return actor
  if (encounterRuleUsageUsed(actor, economy.definitionId) !== economy.afterUsed)
    revertUnavailable("The actor's action economy changed after this action; adjust manually.")
  const returned = encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterRuleUsageUsed(actor, economy.definitionId, economy.beforeUsed)
  })
  if (!economy.spellCasting) return returned
  const restored = revertEncounterSpellCastingTransition(returned, economy.spellCasting)
  if (!restored)
    revertUnavailable("The actor's spell casting changed after this action; adjust manually.")
  return restored
}
