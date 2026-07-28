import type { CharacterBuilderReferencesDto } from '@artificer-toolkit/schema/api/characters'
import type { SelectOption } from '#forms/utils/formUtils'

export function selectOptions(items: { id: string; label: string }[]): SelectOption[] {
  return items
    .map((item) => ({
      value: item.id,
      label: item.label
    }))
    .sort((left, right) => compareCharacterBuilderLabels(left.label, right.label))
}

const characterBuilderLabelCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
})

export function compareCharacterBuilderLabels(left: string, right: string): number {
  return characterBuilderLabelCollator.compare(left, right)
}

export function baseRaceOptions(references: CharacterBuilderReferencesDto): SelectOption[] {
  return selectOptions(references.races.filter((race) => race.category !== 'SUBRACE'))
}

export function subraceOptions(
  references: CharacterBuilderReferencesDto,
  raceId: string | undefined
): SelectOption[] {
  if (!raceId) return []
  return selectOptions(references.races.filter((race) => race.parentRaceId === raceId))
}

export function baseClassOptions(references: CharacterBuilderReferencesDto): SelectOption[] {
  return selectOptions(
    references.classes.filter((classRecord) => classRecord.category !== 'SUBCLASS')
  )
}

export function subclassOptions(
  references: CharacterBuilderReferencesDto,
  classId: string | undefined
): SelectOption[] {
  if (!classId) return []
  return selectOptions(
    references.classes.filter((classRecord) => classRecord.parentClassId === classId)
  )
}

export function selectedRaceAncestryOptions(
  references: CharacterBuilderReferencesDto,
  raceId: string | undefined,
  subraceId: string | undefined
): { ancestryId: string; options: SelectOption[]; label: string } | null {
  const selectedRace = references.races.find((race) => race.id === (subraceId || raceId))
  if (!selectedRace?.ancestry) return null

  return {
    ancestryId: selectedRace.ancestry.id,
    label: selectedRace.ancestry.label,
    options: selectOptions(selectedRace.ancestry.options)
  }
}

export function classSpecializationOptions(
  references: CharacterBuilderReferencesDto,
  subclassId: string | undefined
): SelectOption[] {
  if (!subclassId) return []
  return selectOptions(
    references.classes.find((classRecord) => classRecord.id === subclassId)?.specializations ?? []
  )
}
