import type { EncounterGmActorDto } from '@artificer-toolkit/schema/api/encounters'

type ActorConditions = EncounterGmActorDto['conditions']

/** The level an actor holds a condition at: 0 when it does not hold it, 1 when its row records none. */
export function heldConditionLevel(conditions: ActorConditions, conditionTypeId: string): number {
  const row = conditions.find((condition) => condition.conditionTypeId === conditionTypeId)
  return row ? (row.level ?? 1) : 0
}

/**
 * The stored condition rows after a GM sets one condition's level: level 0 removes its row, and its
 * other rows keep their place and notes. Innate rows come from the stat block, so none is stored.
 */
export function withConditionLevel(
  conditions: ActorConditions,
  conditionTypeId: string,
  level: number
): ActorConditions {
  const stored = conditions.filter((condition) => !condition.innate)
  const current = stored.find((condition) => condition.conditionTypeId === conditionTypeId)
  if (level === 0)
    return stored.filter((condition) => condition.conditionTypeId !== conditionTypeId)
  return current
    ? stored.map((condition) => (condition === current ? { ...condition, level } : condition))
    : [...stored, { conditionTypeId, level }]
}
