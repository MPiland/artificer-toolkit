import type { EncounterActorRecord, EncounterRecord } from '@artificer-toolkit/db'
import type { ResolvedRuleCapabilityStateDto } from '@artificer-toolkit/schema/shared/ruleState'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'

import {
  resolveRuleCapabilityState,
  type CurrentReusableDefinitionSource
} from '../rules/ruleCapabilityStateService.js'
import { encounterRuleUsageSnapshot } from './encounterActorState.js'
import type { LockedEncounterActiveEffectCharacter } from './encounterActiveEffectTargetState.js'

export interface EncounterRuleCapabilityActorState {
  capabilityState: ResolvedRuleCapabilityStateDto
  ruleUsage: Readonly<Record<string, number>>
}

function encounterActorConditionDefinitionIds(actor: EncounterActorRecord): readonly string[] {
  if (!Array.isArray(actor.conditions)) {
    throw new Error('Encounter actor condition state is not normalized.')
  }
  const conditionIds = actor.conditions.filter(
    (condition): condition is string => typeof condition === 'string'
  )
  if (conditionIds.length !== actor.conditions.length) {
    throw new Error('Encounter actor condition state is not normalized.')
  }
  return conditionIds
}

/**
 * Freezes exactly the UUID-backed capability definitions selected by an
 * owning System adapter. The caller has already established Character and
 * Encounter locks; this helper interprets neither conditions nor labels.
 */
export async function resolveEncounterRuleCapabilityStates(input: {
  encounter: Pick<EncounterRecord, 'actors' | 'gameSystemId'>
  lockedCharacters: ReadonlyMap<
    string,
    Pick<LockedEncounterActiveEffectCharacter, 'actor' | 'activeConditionDefinitionIds'>
  >
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
            if (!actor.sourceId) {
              throw new Error('Encounter Character capability state has no Character source.')
            }
            const locked = input.lockedCharacters.get(actor.sourceId)
            if (!locked || locked.actor.id !== actor.id) {
              throw new Error('Encounter Character capability state was not locked.')
            }
            return locked.activeConditionDefinitionIds
          })()
        : encounterActorConditionDefinitionIds(actor)
    resolved.set(actor.id, {
      capabilityState: await resolveRuleCapabilityState({
        definitions,
        gameSystemId: input.encounter.gameSystemId,
        activeConditionDefinitionIds,
        capabilityDefinitionIds: input.capabilityDefinitionIds
      }),
      ruleUsage: encounterRuleUsageSnapshot(actor)
    })
  }
  return resolved
}
