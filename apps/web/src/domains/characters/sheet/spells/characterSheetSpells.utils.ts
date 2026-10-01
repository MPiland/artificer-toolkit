import type { CharacterSheetSpellsDto } from '@artificer-toolkit/schema/api/characterSheetSlices'

export type SheetSpell = CharacterSheetSpellsDto['spells']['spells'][number]
export type SheetSpellSource = NonNullable<SheetSpell['sources']>[number]

export const CHARACTER_SHEET_SPELL_ACTION_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'ACTION', label: 'Action' },
  { id: 'BONUS_ACTION', label: 'Bonus Action' },
  { id: 'REACTION', label: 'Reaction' },
  { id: 'FREE', label: 'Free' }
] as const

export type CharacterSheetSpellActionFilter =
  (typeof CHARACTER_SHEET_SPELL_ACTION_FILTERS)[number]['id']

export function getSpellSourceKey(source: SheetSpellSource): string {
  return source.id ?? source.classId ?? source.label
}

export function formatSpellSourceSummary(source: SheetSpellSource): string {
  return [
    source.label,
    source.provenance ? formatEnumLabel(source.provenance) : undefined,
    source.acquisition ? formatEnumLabel(source.acquisition) : undefined,
    source.castMode ? formatEnumLabel(source.castMode) : undefined,
    source.castMode === 'FIXED_LEVEL' && source.fixedLevel
      ? `Level ${source.fixedLevel}`
      : undefined
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function formatPlural(value: string, amount: number): string {
  if (amount === 1) return value
  return value.endsWith('s') ? value : `${value}s`
}

export function formatSpellSummary(spell: SheetSpell): string {
  const facts = [
    spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`,
    spell.school ? formatEnumLabel(spell.school) : undefined,
    spell.castingTime
      ? `${spell.castingTime.amount} ${formatPlural(formatEnumLabel(spell.castingTime.unit), spell.castingTime.amount)}`
      : undefined,
    spell.components?.length ? spell.components.map(formatEnumLabel).join(', ') : undefined,
    spell.sourceLabel
  ].filter((fact): fact is string => Boolean(fact))

  return facts.join(' - ')
}

export function formatSpellAttributes(spell: SheetSpell): string | null {
  if (!spell.attributes?.length) return null
  return spell.attributes.map(formatEnumLabel).join(', ')
}

export function getPreparedSpellIdsForClass(
  sheet: CharacterSheetSpellsDto,
  classId: string
): string[] {
  const preparationSource = sheet.spells.preparationSources?.find(
    (source) => source.classId === classId
  )
  if (preparationSource) return preparationSource.preparedSpellIds

  return sheet.spells.spells
    .filter((spell) =>
      spell.sources?.some(
        (source) => source.classId === classId && source.canPrepare && source.prepared
      )
    )
    .map((spell) => spell.id)
}
