import type { SummonPickOptionsDto } from '@artificer-toolkit/schema/api/summonPickOptions'

/**
 * The form and Creature Type a summon cast sends, in the room and on the Sheet: the ones picked, else
 * the first of each the summon offers; empty for a cast that offers neither. A form conjured in
 * groups also sends how many creatures, the picked count held within the form's maximum and
 * defaulting to it.
 */
export function summonPicks(
  options: SummonPickOptionsDto | null | undefined,
  pickedFormId: string | null,
  pickedCreatureTypeId: string | null,
  pickedCount: number | null = null
): { formId?: string; creatureTypeId?: string; count?: number } {
  const form =
    options?.summonForms?.find(({ id }) => id === pickedFormId) ?? options?.summonForms?.[0]
  const creatureType =
    options?.creatureTypes?.find(({ id }) => id === pickedCreatureTypeId) ??
    options?.creatureTypes?.[0]
  return {
    ...(form ? { formId: form.id } : {}),
    ...(form?.maxCount
      ? { count: Math.min(Math.max(pickedCount ?? form.maxCount, 1), form.maxCount) }
      : {}),
    ...(creatureType ? { creatureTypeId: creatureType.id } : {})
  }
}
