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

function formatStatus(status: string | undefined): string {
  if (!status) return 'Draft'
  return status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
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

export function mapRaceListToAuthoredItems(response: RaceListResponseDto): AuthoredListItem[] {
  return response.items.map((item) => {
    const category = item.category ?? 'BASE'

    return {
      id: item.id,
      name: item.label,
      description: summarizeDescription(item.description),
      attributes: {
        Category: formatRaceCategory(category)
      },
      badges: [formatStatus(item.status)],
      filterValues: {
        category,
        status: item.status,
        source: item.provenance.kind
      },
      sortValues: {
        category: formatRaceCategory(category),
        name: item.label,
        status: formatStatus(item.status)
      },
      searchText: `${summarizeDescription(item.description)} ${formatRaceCategory(category)}`,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: mapPermissions(item)
    }
  })
}

export function buildRaceListFilters(response: RaceListResponseDto): AuthoredListFilter[] {
  const statuses = Array.from(new Set(response.items.map((item) => item.status))).sort()
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
      key: 'status',
      label: 'Status',
      placeholder: 'Any status',
      options: statuses.map((status) => ({
        value: status,
        label: formatStatus(status)
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
  { key: 'Category', label: 'Category' }
] satisfies AuthoredListAttributeColumn[]

export const raceListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'category', label: 'Category' },
  { value: 'status', label: 'Status' }
]

export function summarizeRaceList(response: RaceListResponseDto) {
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} races / ${masterCount} SRD / ${ownedCount} homebrew`
}
