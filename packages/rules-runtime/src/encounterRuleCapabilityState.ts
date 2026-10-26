import type { ResolvedRuleCapabilityStateDto } from '@artificer-toolkit/schema/shared/ruleState'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import {
  resolveRuleCapabilityState,
  type CurrentReusableDefinitionSource
} from './ruleCapabilityStateService.js'
import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import { encounterRuleUsageSnapshot } from './encounterActorState.js'
import { activeEffectCapabilitySuppressions } from './encounterActionEconomy.js'
import type {
  EncounterMovementReactionEncounter,
  EncounterMovementReactionRuleStateCharacterSource
} from './encounterMovementReactionSources.js'

export interface EncounterRuleCapabilityActorState {
  capabilityState: ResolvedRuleCapabilityStateDto
  ruleUsage: Readonly<Record<string, number>>
}

export async function resolveEncounterRuleCapabilityStates(input: {
  encounter: Pick<EncounterMovementReactionEncounter, 'gameSystemId' | 'actors'>
  lockedCharacters: ReadonlyMap<string, EncounterMovementReactionRuleStateCharacterSource>
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  definitions: CurrentReusableDefinitionSource
  capabilityDefinitionIds: readonly string[]
}): Promise<ReadonlyMap<string, EncounterRuleCapabilityActorState>> {
  const currentById = new Map<string, Promise<ReusableDefinitionCurrentDto>>()
  const definitions: CurrentReusableDefinitionSource = {
    requireCurrent(definitionId) {
      let current = currentById.get(definitionId)
      if (!current) {
        current = input.definitions.requireCurrent(definitionId)
        currentById.set(definitionId, current)
      }
      return current
    }
  }
  const resolved = new Map<string, EncounterRuleCapabilityActorState>()
  for (const actor of [...input.encounter.actors].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    const activeConditionDefinitionIds =
      actor.kind === 'CHARACTER'
        ? (() => {
            if (!actor.sourceId)
              throw new Error('Encounter Character capability state has no Character source.')
            const locked = input.lockedCharacters.get(actor.sourceId)
            if (!locked || locked.actor.id !== actor.id)
              throw new Error('Encounter Character capability state was not locked.')
            return locked.activeConditionDefinitionIds
          })()
        : readEncounterActorConditionState(actor.conditions).ids
    const activeEffects = input.activeEffectsByActorId.get(actor.id)
    if (!activeEffects) throw new Error('Encounter actor active-effect state was not locked.')
    resolved.set(actor.id, {
      capabilityState: await resolveRuleCapabilityState({
        definitions,
        gameSystemId: input.encounter.gameSystemId,
        activeConditionDefinitionIds,
        capabilityDefinitionIds: input.capabilityDefinitionIds,
        activeEffectSuppressions: activeEffectCapabilitySuppressions(
          input.encounter.gameSystemId,
          activeEffects
        )
      }),
      ruleUsage: encounterRuleUsageSnapshot(actor)
    })
  }
  return resolved
}
