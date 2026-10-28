import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

export type ConditionLevelBounds = Pick<
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
