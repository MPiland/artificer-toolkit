import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'

export type SummonPointTarget = Extract<EncounterActionChoiceDto['target'], { kind: 'POINT' }>

/**
 * The form and Creature Type a summon cast sends: the ones picked, else the first of each the summon
 * offers; empty for any other choice and for a summon that offers neither.
 */
export function summonPicks(
  choiceTarget: EncounterActionChoiceDto['target'] | null | undefined,
  pickedFormId: string | null,
  pickedCreatureTypeId: string | null
): { formId?: string; creatureTypeId?: string } {
  const target = choiceTarget?.kind === 'POINT' ? choiceTarget : null
  const form =
    target?.summonForms?.find(({ id }) => id === pickedFormId) ?? target?.summonForms?.[0]
  const creatureType =
    target?.creatureTypes?.find(({ id }) => id === pickedCreatureTypeId) ??
    target?.creatureTypes?.[0]
  return {
    ...(form ? { formId: form.id } : {}),
    ...(creatureType ? { creatureTypeId: creatureType.id } : {})
  }
}
