import type { RaceListResponseDto } from '#app/lib/api'
import type {
  AuthoredListAttributeColumn,
  AuthoredListFilter,
  AuthoredListItem
} from '#components/AuthoredList'
import { summarizeAuthoredDescription } from '../authoredListMapper'

export function formatRaceCategory(category: string | undefined): string {
  if (category === 'SUBRACE') return 'Subrace'
  if (category === 'BASE') return 'Base Race'
  return 'Race'
}

function isPlayableRaceListItem(item: RaceListResponseDto['items'][number]): boolean {
  return item.category === 'SUBRACE' || item.selectionMode === 'DIRECT'
}

export function mapRaceListToAuthoredItems(response: RaceListResponseDto): AuthoredListItem[] {
  return response.items.map((item) => {
    const category = item.category ?? 'BASE'
    const parentRaceId = item.parentRaceId ?? undefined
    const parentLabel = item.parentRaceLabel ?? undefined
    const playableLabel = isPlayableRaceListItem(item) ? 'Playable' : ''

    return {
      id: item.id,
      publicId: item.publicId,
      name: item.label,
      description: summarizeAuthoredDescription(item.description),
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
      searchText: `${summarizeAuthoredDescription(item.description)} ${formatRaceCategory(category)} ${playableLabel}`,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: item.permissions
    }
  })
}

export function buildRaceListFilters(response: RaceListResponseDto): AuthoredListFilter[] {
  const categories = Array.from(
    new Set(
      ((response.meta as { categories?: Array<{ id: string }> }).categories ?? []).map(
        (category) => category.id
      )
    )
  ).sort()

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

export const raceListAttributeColumns = [] satisfies AuthoredListAttributeColumn[]

export const raceListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'category', label: 'Category' }
]

export function summarizeRaceList(response: RaceListResponseDto) {
  return `${response.summary.activeCount} races / ${response.summary.masterCount} SRD / ${response.summary.ownedCount} homebrew`
}
