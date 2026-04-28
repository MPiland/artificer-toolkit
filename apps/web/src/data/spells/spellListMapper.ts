import type { SpellListResponseDto } from '#app/lib/api'
import type { AuthoredListFilter, AuthoredListItem } from '#components/AuthoredList'

interface SpellMetaGroup {
  id: string | number
  spellIds: string[]
}

function findMetaIds(meta: SpellMetaGroup[] | undefined, spellId: string) {
  return (meta ?? [])
    .filter((entry) => entry.spellIds.includes(spellId))
    .map((entry) => String(entry.id))
}

function formatCastingTime(amount?: number, unit?: string) {
  if (!amount || !unit) return undefined
  const normalizedUnit = unit.toLowerCase().replaceAll('_', ' ')
  return `${amount} ${normalizedUnit}`
}

function mapPermissions(item: SpellListResponseDto['items'][number]): AuthoredListItem['permissions'] {
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
    const school = item.magicSchoolId ?? findMetaIds(spellMeta.schools, item.id)[0]
    const classes = findMetaIds(spellMeta.classes, item.id)

    return {
      id: item.id,
      name: item.label,
      level: item.level == null ? undefined : String(item.level),
      school,
      castingTime: formatCastingTime(item.castingTimeAmount, item.castingTimeUnit),
      classes,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: mapPermissions(item)
    }
  })
}

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
        label: String(entry.id)
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
        label: String(entry.id)
      }))
    }
  ]
}

export function summarizeSpellList(response: SpellListResponseDto) {
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} spells / ${masterCount} SRD / ${ownedCount} homebrew`
}
