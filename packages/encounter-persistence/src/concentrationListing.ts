import type { ConcentrationListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
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
  input: {
    state: Pick<EncounterRunState, 'id' | 'gameSystemId'>
    actor: Pick<EncounterRunActorState, 'id' | 'kind' | 'sourceId'>
  }
): Promise<ConcentrationListingDto | null> {
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
    return heldConcentration([...characters, ...actors])
  }
  if (actor.kind !== 'CHARACTER' || !actor.sourceId) return null
  const carried = await listCarriedActiveRuleEffects(ctx, actor.sourceId)
  return carried.length === 0 ? null : heldConcentration(carried)
}
