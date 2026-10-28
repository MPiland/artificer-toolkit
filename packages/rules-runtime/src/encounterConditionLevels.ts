import type { ConditionLevelBounds } from './conditionLevels.js'
import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import { EncounterValidationError } from './encounterErrors.js'

/**
 * A GM's condition rows for a Creature or custom actor: canonical, and a recorded level only on a
 * leveled System condition, from 1 to its maximum level.
 */
export function requireEncounterActorConditionLevels(
  rows: unknown,
  conditionTypes: readonly ConditionLevelBounds[]
): void {
  for (const row of readEncounterActorConditionState(rows).values) {
    if (typeof row !== 'object' || row === null || Array.isArray(row) || !('level' in row)) continue
    const { conditionTypeId, level } = row as { conditionTypeId: string; level: unknown }
    const condition = conditionTypes.find(({ id }) => id === conditionTypeId)
    if (condition?.maximumLevel === undefined)
      throw new EncounterValidationError(
        `${condition?.label ?? 'This condition'} has no levels to set.`
      )
    if (
      typeof level !== 'number' ||
      !Number.isSafeInteger(level) ||
      level < 1 ||
      level > condition.maximumLevel
    )
      throw new EncounterValidationError(
        `${condition.label} level must be between 1 and ${condition.maximumLevel}.`
      )
  }
}
