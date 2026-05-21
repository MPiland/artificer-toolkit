import type { RaceListResponseDto } from '#app/lib/api'
import type { AuthoredListAttributeColumn, AuthoredListFilter, AuthoredListItem } from '#components/AuthoredList'

function mapPermissions(item: RaceListResponseDto['items'][number]): AuthoredListItem['permissions'] {
  return {
    canView: item.permissions.canView,
    canEdit: item.permissions.canEdit,
    canCopy: item.permissions.canCopy,
    canDelete: item.permissions.canDelete
  }
}

export function formatRaceCategory(category: string | undefined): string {
  if (category === 'SUBRACE') return 'Subrace'
  if (category === 'BASE') return 'Base Race'
  return 'Race'
}

function summarizeDescription(description: string | null | undefined): string {
  if (!description) return 'No description yet.'
  return description.replace(/<[^>]*>/g, '').trim() || 'No description yet.'
}

function isPlayableRaceListItem(item: RaceListResponseDto['items'][number]): boolean {
  return item.category === 'SUBRACE' || item.selectionMode === 'DIRECT'
}

export function mapRaceListToAuthoredItems(response: RaceListResponseDto): AuthoredListItem[] {
  const parentLabels = new Map(response.items.map((item) => [item.id, item.label]))

  return response.items.map((item) => {
    const category = item.category ?? 'BASE'
    const parentRaceId = item.parentRaceId ?? undefined
    const parentLabel = parentRaceId ? parentLabels.get(parentRaceId) : undefined
    const playableLabel = isPlayableRaceListItem(item) ? 'Playable' : ''

    return {
      id: item.id,
      publicId: item.publicId,
      name: item.label,
      description: summarizeDescription(item.description),
      badges: playableLabel ? [playableLabel] : undefined,
      hierarchy: parentRaceId
        ? {
            level: 1,
            parentId: parentRaceId,
            parentLabel
          }
        : undefined,
      filterValues: {
        category,
        source: item.provenance.kind
      },
      sortValues: {
        category: formatRaceCategory(category),
        name: item.label
      },
      searchText: `${summarizeDescription(item.description)} ${formatRaceCategory(category)} ${playableLabel}`,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: mapPermissions(item)
    }
  })
}

export function buildRaceListFilters(response: RaceListResponseDto): AuthoredListFilter[] {
  const categories = Array.from(new Set(response.items.map((item) => item.category ?? 'BASE'))).sort()

  return [
    {
      key: 'category',
      label: 'Category',
      placeholder: 'Any category',
      options: categories.map((category) => ({
        value: category,
        label: formatRaceCategory(category)
      }))
    },
    {
      key: 'source',
      label: 'Source',
      placeholder: 'Any source',
      options: [
        { value: 'MASTER', label: 'SRD' },
        { value: 'OWNED', label: 'Homebrew' }
      ]
    }
  ]
}

export const raceListAttributeColumns = [
] satisfies AuthoredListAttributeColumn[]

export const raceListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'category', label: 'Category' }
]

export function summarizeRaceList(response: RaceListResponseDto) {
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} races / ${masterCount} SRD / ${ownedCount} homebrew`
}
