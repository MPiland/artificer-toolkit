import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { isEncounterActorDefeated } from './encounterActorDefeat.js'
import { encounterActorCannotAct } from './encounterBasicActions.js'

/**
 * Why a holder's Concentration ends without a check (D95): the actor is defeated, or its System
 * actor-action capability is unavailable (Speed 0 alone does not end it). Null keeps the slot.
 */
export async function encounterConcentrationEndReason(
  input: { actor: EncounterRunActorState } & Parameters<typeof encounterActorCannotAct>[0]
): Promise<'INCAPACITATED' | 'DEFEATED' | null> {
  if (isEncounterActorDefeated(input.actor)) return 'DEFEATED'
  return (await encounterActorCannotAct(input)) ? 'INCAPACITATED' : null
}
