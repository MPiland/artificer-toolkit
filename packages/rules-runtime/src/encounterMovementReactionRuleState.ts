import { requireMovementReactionCapabilityDefinitionIds } from './movementReactionEligibilityRegistry.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import {
  resolveEncounterRuleCapabilityStates,
  type EncounterRuleCapabilityActorState,
  type EncounterMovementReactionActiveEffect
} from './encounterRuleCapabilityState.js'
import type {
  EncounterMovementReactionEncounter,
  EncounterMovementReactionRuleStateCharacterSource
} from './encounterMovementReactionSources.js'

export type EncounterMovementReactionActorRuleState = EncounterRuleCapabilityActorState

export async function resolveEncounterMovementReactionRuleStates(input: {
  encounter: EncounterMovementReactionEncounter
  lockedCharacters: ReadonlyMap<string, EncounterMovementReactionRuleStateCharacterSource>
  activeEffectsByActorId: ReadonlyMap<string, readonly EncounterMovementReactionActiveEffect[]>
  definitions: CurrentReusableDefinitionSource
}): Promise<ReadonlyMap<string, EncounterMovementReactionActorRuleState>> {
  return resolveEncounterRuleCapabilityStates({
    ...input,
    capabilityDefinitionIds: requireMovementReactionCapabilityDefinitionIds(
      input.encounter.gameSystemId
    )
  })
}
