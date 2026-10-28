import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import { EncounterValidationError } from './encounterErrors.js'

type ConditionLevelBounds = Pick<
  SystemAuthoredDto['conditionTypes'][number],
  'id' | 'label' | 'maximumLevel'
>

/**
 * The highest level a System's leveled condition reaches, from its vocabulary, for every holder:
 * a Character's exhaustion and a Creature's condition row. 0 when the condition is not leveled.
 */
export function systemConditionMaximumLevel(
  conditionTypes: readonly ConditionLevelBounds[],
  conditionTypeId: string | null
): number {
  return conditionTypes.find(({ id }) => id === conditionTypeId)?.maximumLevel ?? 0
}

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
