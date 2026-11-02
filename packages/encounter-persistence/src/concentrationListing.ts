import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  listCarriedActiveRuleEffects,
  readDependentEffects,
  readMaintainedStatesByDefinition
} from './effectStore.js'
import type { EncounterReadContext } from './store.js'

/** How many Concentrations an Encounter actor keeps now; 0 when it holds none. */
export async function readHeldConcentrationCount(
  ctx: EncounterReadContext,
  input: { state: Pick<EncounterRunState, 'id' | 'gameSystemId'>; actorId: string }
): Promise<number> {
  const { state } = input
  const slots = await readMaintainedStatesByDefinition(ctx, {
    encounterId: state.id,
    ownerActorId: input.actorId,
    maintenanceDefinitionId: requireInstalledConcentrationMaintenanceDefinitionId(
      state.gameSystemId
    )
  })
  return slots.length
}

/**
 * What an Encounter actor's Concentrations keep alive: the effects depending on its live states in
 * the Run (with the id of each state), or for a Character the grants a finished Run carried over
 * from its last Concentration (no live state). Null when the actor is not concentrating.
 */
export async function readActorConcentrations(
  ctx: EncounterReadContext,
  input: {
    state: Pick<EncounterRunState, 'id' | 'gameSystemId'>
    actor: Pick<EncounterRunActorState, 'id' | 'kind' | 'sourceId'>
  }
): Promise<{ effects: ActiveRuleEffectRecord[]; stateIds: string[] } | null> {
  const { actor, state } = input
  const slots = await readMaintainedStatesByDefinition(ctx, {
    encounterId: state.id,
    ownerActorId: actor.id,
    maintenanceDefinitionId: requireInstalledConcentrationMaintenanceDefinitionId(
      state.gameSystemId
    )
  })
  if (slots.length > 0) {
    const dependents = await Promise.all(
      slots.map((slot) => readDependentEffects(ctx, state.id, slot.id))
    )
    return {
      effects: dependents.flatMap(({ characters, actors }) => [...characters, ...actors]),
      stateIds: slots.map((slot) => slot.id)
    }
  }
  if (actor.kind !== 'CHARACTER' || !actor.sourceId) return null
  const carried = await listCarriedActiveRuleEffects(ctx, actor.sourceId)
  return carried.length === 0 ? null : { effects: carried, stateIds: [] }
}

/** The effects an Encounter actor's Concentrations keep alive; null when it is not concentrating. */
export async function readActorConcentrationEffects(
  ctx: EncounterReadContext,
  input: Parameters<typeof readActorConcentrations>[1]
): Promise<ActiveRuleEffectRecord[] | null> {
  return (await readActorConcentrations(ctx, input))?.effects ?? null
}
