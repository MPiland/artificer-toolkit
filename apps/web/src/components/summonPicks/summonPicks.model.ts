import type { SummonPickOptionsDto } from '@artificer-toolkit/schema/api/summonPickOptions'

/**
 * The form and Creature Type a summon cast sends, in the room and on the Sheet: the ones picked, else
 * the first of each the summon offers; empty for a cast that offers neither.
 */
export function summonPicks(
  options: SummonPickOptionsDto | null | undefined,
  pickedFormId: string | null,
  pickedCreatureTypeId: string | null
): { formId?: string; creatureTypeId?: string } {
  const form =
    options?.summonForms?.find(({ id }) => id === pickedFormId) ?? options?.summonForms?.[0]
  const creatureType =
    options?.creatureTypes?.find(({ id }) => id === pickedCreatureTypeId) ??
    options?.creatureTypes?.[0]
  return {
    ...(form ? { formId: form.id } : {}),
    ...(creatureType ? { creatureTypeId: creatureType.id } : {})
  }
}
