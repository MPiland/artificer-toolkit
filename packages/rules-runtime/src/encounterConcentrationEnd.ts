import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { isEncounterActorDefeated, type DeadCharacterIds } from './encounterActorDefeat.js'
import { encounterGrantsEnabledDomain } from './encounterActiveGrants.js'
import { encounterActorCannotAct } from './encounterBasicActions.js'

/**
 * Why a holder's Concentration ends without a check (D95): the actor is defeated, its System
 * actor-action capability is unavailable (Speed 0 alone does not end it), or it carries a
 * `SPELLCASTING_LOCK` grant. Null keeps the slot. The first two also end the holder's
 * `ON_INCAPACITATED` grants.
 */
export async function encounterConcentrationEndReason(
  input: {
    actor: EncounterRunActorState
    deadCharacterIds: DeadCharacterIds
  } & Parameters<typeof encounterActorCannotAct>[0]
): Promise<'INCAPACITATED' | 'DEFEATED' | 'SPELLCASTING_LOCKED' | null> {
  if (isEncounterActorDefeated(input.actor, input.deadCharacterIds)) return 'DEFEATED'
  if (await encounterActorCannotAct(input)) return 'INCAPACITATED'
  return encounterGrantsEnabledDomain(input.activeEffects, 'SPELLCASTING_LOCK')
    ? 'SPELLCASTING_LOCKED'
    : null
}
