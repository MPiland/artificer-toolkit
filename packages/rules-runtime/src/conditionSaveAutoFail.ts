import type { EncounterConditionMechanic } from './encounterConditionMechanics.js'
import type { CharacterRuleActionSaveAutoFail } from './characterRuleActionSystemAdapter.js'

/**
 * The saving throws the holder's conditions fail unrolled: each ability with the condition that
 * fails it, sorted by ability then condition.
 */
export function encounterConditionSaveAutoFails(
  mechanics: readonly EncounterConditionMechanic[]
): CharacterRuleActionSaveAutoFail[] {
  const failures = mechanics.flatMap(({ conditionDefinitionId, mechanic }) =>
    mechanic.kind === 'SAVE_AUTO_FAIL'
      ? mechanic.abilityDefinitionIds.map((abilityDefinitionId) => ({
          abilityDefinitionId,
          conditionDefinitionId
        }))
      : []
  )
  return failures
    .filter(
      (failure, index) =>
        failures.findIndex(
          (other) =>
            other.abilityDefinitionId === failure.abilityDefinitionId &&
            other.conditionDefinitionId === failure.conditionDefinitionId
        ) === index
    )
    .sort(
      (left, right) =>
        left.abilityDefinitionId.localeCompare(right.abilityDefinitionId) ||
        left.conditionDefinitionId.localeCompare(right.conditionDefinitionId)
    )
}
