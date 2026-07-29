import type { SpellListResponseDto } from '#app/lib/api'
import type { AuthoredListFilter, AuthoredListItem } from '#components/AuthoredList'
import { getSpellSchoolAccent } from './spellSchoolAccents'

interface SpellMetaGroup {
  id: string | number
  label?: string
  spellIds: string[]
}

function findMetaEntries(meta: SpellMetaGroup[] | undefined, spellId: string) {
  return (meta ?? []).filter((entry) => entry.spellIds.includes(spellId))
}

function findMetaIds(meta: SpellMetaGroup[] | undefined, spellId: string) {
  return findMetaEntries(meta, spellId).map((entry) => String(entry.id))
}

function findMetaLabel(meta: SpellMetaGroup[] | undefined, id: string | null | undefined) {
  if (!id) return undefined
  const entry = (meta ?? []).find((candidate) => String(candidate.id) === id)
  return entry?.label ?? id
}

function getMetaOptionLabel(entry: SpellMetaGroup) {
  return entry.label ?? String(entry.id)
}

function formatCastingTime(amount?: number, unit?: string) {
  if (!amount || !unit) return undefined
  const normalizedUnit = unit.toLowerCase().replaceAll('_', ' ')
  return `${amount} ${normalizedUnit}`
}

function mapPermissions(
  item: SpellListResponseDto['items'][number]
): AuthoredListItem['permissions'] {
  return {
    canView: item.permissions.canView,
    canEdit: item.permissions.canEdit,
    canCopy: item.permissions.canCopy,
    canDelete: item.permissions.canDelete
  }
}

export function mapSpellListToAuthoredItems(response: SpellListResponseDto): AuthoredListItem[] {
  const spellMeta = response.meta as {
    classes?: SpellMetaGroup[]
    schools?: SpellMetaGroup[]
  }

  return response.items.map((item) => {
    const schoolId = item.magicSchoolId ?? findMetaIds(spellMeta.schools, item.id)[0]
    const school = findMetaLabel(spellMeta.schools, schoolId)
    const schoolAccent = getSpellSchoolAccent(school)
    const classEntries = findMetaEntries(spellMeta.classes, item.id)
    const classIds = classEntries.map((entry) => String(entry.id))
    const classLabels = classEntries.map(getMetaOptionLabel)

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
      permissions: mapPermissions(item)
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
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} spells / ${masterCount} SRD / ${ownedCount} homebrew`
}
