import type { SpellListResponseDto } from '@artificer-toolkit/schema/api/content'
import type { AuthoredListFilter, AuthoredListItem } from '#components/AuthoredList'
import { getSpellSchoolAccent } from './spellSchoolAccents'

interface SpellCatalogueItem {
  id: string
  publicId: string
  label: string
  description?: string | null
  level?: number | null
  magicSchoolId?: string | null
  magicSchoolLabel?: string | null
  classIds?: string[] | null
  classLabels?: string[] | null
  castingTimeUnit?: string | null
  castingTimeAmount?: number | null
  provenance: SpellListResponseDto['items'][number]['provenance']
  permissions: SpellListResponseDto['items'][number]['permissions']
}

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

export function mapSpellCatalogueItem(item: SpellCatalogueItem): AuthoredListItem {
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
        item.level == null ? undefined : Number(item.level) === 0 ? 'Cantrip' : String(item.level),
      school,
      classes: classLabels,
      castingTime: formatCastingTime(
        item.castingTimeAmount ?? undefined,
        item.castingTimeUnit ?? undefined
      )
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

export function buildSpellFilters(facets: {
  classes: SpellMetaGroup[]
  levels: SpellMetaGroup[]
  schools: SpellMetaGroup[]
}): AuthoredListFilter[] {
  return [
    {
      key: 'school',
      label: 'School',
      placeholder: 'Any school',
      options: facets.schools.map((entry) => ({
        value: String(entry.id),
        label: getMetaOptionLabel(entry)
      }))
    },
    {
      key: 'level',
      label: 'Level',
      placeholder: 'Any level',
      options: facets.levels.map((entry) => ({
        value: String(entry.id),
        label: Number(entry.id) === 0 ? 'Cantrip' : `Level ${entry.id}`
      }))
    },
    {
      key: 'class',
      label: 'Class',
      placeholder: 'Any class',
      options: facets.classes.map((entry) => ({
        value: String(entry.id),
        label: getMetaOptionLabel(entry)
      }))
    }
  ]
}
