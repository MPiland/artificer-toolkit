import type { SpellListResponseDto } from '#app/lib/api'
import type { AuthoredListFilter, AuthoredListItem } from '#components/AuthoredList'
import { getSpellSchoolAccent } from './spellSchoolAccents'

interface SpellMetaGroup {
  id: string | number
  label?: string
}

function getMetaOptionLabel(entry: SpellMetaGroup) {
  return entry.label ?? String(entry.id)
}

function formatCastingTime(amount?: number, unit?: string) {
  if (!amount || !unit) return undefined
  const normalizedUnit = unit.toLowerCase().replaceAll('_', ' ')
  return `${amount} ${normalizedUnit}`
}

export function mapSpellListToAuthoredItems(response: SpellListResponseDto): AuthoredListItem[] {
  return response.items.map((item) => {
    const schoolId = item.magicSchoolId ?? undefined
    const school = item.magicSchoolLabel ?? undefined
    const schoolAccent = getSpellSchoolAccent(school)
    const classIds = item.classIds ?? []
    const classLabels = item.classLabels ?? []

    return {
      id: item.id,
      publicId: item.publicId,
      name: item.label,
      description: item.description ?? undefined,
      attributes: {
        level:
          item.level == null
            ? undefined
            : Number(item.level) === 0
              ? 'Cantrip'
              : String(item.level),
        school,
        classes: classLabels,
        castingTime: formatCastingTime(item.castingTimeAmount, item.castingTimeUnit)
      },
      filterValues: {
        level: item.level == null ? undefined : String(item.level),
        school: schoolId,
        class: classIds
      },
      sortValues: {
        level: item.level ?? 0,
        name: item.label,
        school
      },
      searchText: classLabels.join(' '),
      accentColor: schoolAccent?.color,
      accentLabel: schoolAccent?.label,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: item.permissions
    }
  })
}

export const spellListAttributeColumns = [
  { key: 'level', label: 'Lvl', width: 76 },
  { key: 'school', label: 'School', width: 164 },
  { key: 'classes', label: 'Classes', width: 260 },
  { key: 'castingTime', label: 'Casting Time', width: 172 }
]

export const spellListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'level', label: 'Level' },
  { value: 'school', label: 'School' }
]

export function buildSpellListFilters(response: SpellListResponseDto): AuthoredListFilter[] {
  const spellMeta = response.meta as {
    classes?: SpellMetaGroup[]
    schools?: SpellMetaGroup[]
    levels?: SpellMetaGroup[]
  }

  return [
    {
      key: 'school',
      label: 'School',
      placeholder: 'Any school',
      options: (spellMeta.schools ?? []).map((entry) => ({
        value: String(entry.id),
        label: getMetaOptionLabel(entry)
      }))
    },
    {
      key: 'level',
      label: 'Level',
      placeholder: 'Any level',
      options: (spellMeta.levels ?? []).map((entry) => ({
        value: String(entry.id),
        label: Number(entry.id) === 0 ? 'Cantrip' : `Level ${entry.id}`
      }))
    },
    {
      key: 'class',
      label: 'Class',
      placeholder: 'Any class',
      options: (spellMeta.classes ?? []).map((entry) => ({
        value: String(entry.id),
        label: getMetaOptionLabel(entry)
      }))
    }
  ]
}

export function summarizeSpellList(response: SpellListResponseDto) {
  return `${response.summary.activeCount} spells / ${response.summary.masterCount} SRD / ${response.summary.ownedCount} homebrew`
}
