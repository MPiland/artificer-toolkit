import type { CharacterSheet } from './CharacterSheet.types'

export type SheetSpell = CharacterSheet['spells']['spells'][number]
export type SheetSpellSource = NonNullable<SheetSpell['sources']>[number]

export function getPreparedSpellIdsForClass(sheet: CharacterSheet, classId: string): string[] {
  const preparationSource = sheet.spells.preparationSources?.find((source) => source.classId === classId)
  if (preparationSource) return preparationSource.preparedSpellIds

  return sheet.spells.spells
    .filter((spell) => spell.sources?.some((source) => source.classId === classId && source.prepared))
    .map((spell) => spell.id)
}
