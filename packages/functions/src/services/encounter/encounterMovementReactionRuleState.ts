import type { EncounterRecord } from '@artificer-toolkit/db'

import { requireMovementReactionCapabilityDefinitionIds } from '../rules/movementReactionEligibilityRegistry.js'
import type { CurrentReusableDefinitionSource } from '../rules/ruleCapabilityStateService.js'
import type { LockedEncounterActiveEffectCharacter } from './encounterActiveEffectTargetState.js'
import {
  resolveEncounterRuleCapabilityStates,
  type EncounterRuleCapabilityActorState
} from './encounterRuleCapabilityState.js'

export type EncounterMovementReactionActorRuleState = EncounterRuleCapabilityActorState

/**
 * Freezes UUID-backed capability state for every actor under the caller's
 * established Encounter/Character locks. System adapters select capability
 * definition identities; this layer never interprets condition labels.
 */
export async function resolveEncounterMovementReactionRuleStates(input: {
  encounter: Pick<EncounterRecord, 'actors' | 'gameSystemId'>
  lockedCharacters: ReadonlyMap<
    string,
    Pick<LockedEncounterActiveEffectCharacter, 'actor' | 'activeConditionDefinitionIds'>
  >
  definitions: CurrentReusableDefinitionSource
}): Promise<ReadonlyMap<string, EncounterMovementReactionActorRuleState>> {
  const capabilityDefinitionIds = requireMovementReactionCapabilityDefinitionIds(
    input.encounter.gameSystemId
  )
  return resolveEncounterRuleCapabilityStates({
    ...input,
    capabilityDefinitionIds
  })
}
