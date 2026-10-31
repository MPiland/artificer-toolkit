import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'

/**
 * How many creatures the caster may spare from the action's area: any number for a zone that
 * chooses its unaffected creatures, the cast's cap for an instant area, and `undefined` when the
 * action spares nobody.
 */
export function sparedCreatureLimit(action: EncounterActionChoiceDto | null, aimsArea: boolean) {
  const target = action?.target
  if (target && 'choosesUnaffected' in target && target.choosesUnaffected === true) return Infinity
  return aimsArea ? action?.sparesCreatures?.max : undefined
}
