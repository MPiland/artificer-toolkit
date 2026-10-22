import type { ConcentrationEndReason } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { isEncounterActorDefeated, type DeadCharacterIds } from './encounterActorDefeat.js'
import { encounterGrantsEnabledDomain } from './encounterActiveGrants.js'
import { encounterActorCannotAct } from './encounterBasicActions.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import type { EncounterEvent } from './events/encounterEventTable.js'
import { maintenanceLinkCapabilityRegistry } from './platformPolicyModules.js'

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
): Promise<Exclude<ConcentrationEndReason, 'CHOSEN'> | null> {
  const events: EncounterEvent[] = []
  if (isEncounterActorDefeated(input.actor, input.deadCharacterIds))
    events.push({ kind: 'DEFEATED' })
  else if (await encounterActorCannotAct(input))
    events.push({ kind: 'INCAPACITATED', of: 'HOLDER' })
  else if (encounterGrantsEnabledDomain(input.activeEffects, 'SPELLCASTING_LOCK'))
    events.push({ kind: 'MAINTENANCE_BARRED' })
  return discoverEncounterEventHooks({
    maintenanceHooks: maintenanceLinkCapabilityRegistry.require(input.gameSystemId).hooks,
    events
  }).maintenanceBreakReason
}
