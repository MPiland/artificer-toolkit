import type { ConcentrationListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { heldConcentration } from '@artificer-toolkit/rules-runtime/activeGrantListings'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  listCarriedActiveRuleEffects,
  readDependentEffects,
  readMaintainedStateByDefinition
} from './effectStore.js'
import type { EncounterReadContext } from './store.js'

/**
 * The Concentration an Encounter actor maintains (SPELLS-5.11): its live slot in the Run, named by
 * the grants that depend on it, or for a Character the grants a finished Run carried over from its
 * last Concentration. Null when the actor is not concentrating. The label is the GM's view.
 */
export async function readActorConcentration(
  ctx: EncounterReadContext,
  input: Parameters<typeof readActorConcentrationEffects>[1]
): Promise<ConcentrationListingDto | null> {
  const effects = await readActorConcentrationEffects(ctx, input)
  return effects && heldConcentration(effects)
}

/**
 * The effects an Encounter actor's Concentration keeps alive: those depending on its live slot in
 * the Run, or for a Character the grants a finished Run carried over from its last Concentration.
 * Null when the actor is not concentrating.
 */
export async function readActorConcentrationEffects(
  ctx: EncounterReadContext,
  input: {
    state: Pick<EncounterRunState, 'id' | 'gameSystemId'>
    actor: Pick<EncounterRunActorState, 'id' | 'kind' | 'sourceId'>
  }
): Promise<ActiveRuleEffectRecord[] | null> {
  const { actor, state } = input
  const slot = await readMaintainedStateByDefinition(ctx, {
    encounterId: state.id,
    ownerActorId: actor.id,
    maintenanceDefinitionId: requireInstalledConcentrationMaintenanceDefinitionId(
      state.gameSystemId
    )
  })
  if (slot) {
    const { characters, actors } = await readDependentEffects(ctx, state.id, slot.id)
    return [...characters, ...actors]
  }
  if (actor.kind !== 'CHARACTER' || !actor.sourceId) return null
  const carried = await listCarriedActiveRuleEffects(ctx, actor.sourceId)
  return carried.length === 0 ? null : carried
}
