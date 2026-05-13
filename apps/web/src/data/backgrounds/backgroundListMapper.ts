import type { BackgroundListResponseDto } from '#app/lib/api'
import type { AuthoredListAttributeColumn, AuthoredListFilter, AuthoredListItem } from '#components/AuthoredList'

function mapPermissions(item: BackgroundListResponseDto['items'][number]): AuthoredListItem['permissions'] {
  return {
    canView: item.permissions.canView,
    canEdit: item.permissions.canEdit,
    canCopy: item.permissions.canCopy,
    canDelete: item.permissions.canDelete
  }
}

function summarizeDescription(description: string | null | undefined): string {
  if (!description) return 'No description yet.'
  return description.replace(/<[^>]*>/g, '').trim() || 'No description yet.'
}

export function mapBackgroundListToAuthoredItems(response: BackgroundListResponseDto): AuthoredListItem[] {
  return response.items.map((item) => ({
    id: item.id,
    publicId: item.publicId,
    name: item.label,
    description: summarizeDescription(item.description),
    attributes: {},
    filterValues: {
      source: item.provenance.kind
    },
    sortValues: {
      name: item.label
    },
    searchText: summarizeDescription(item.description),
    sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
    sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
    permissions: mapPermissions(item)
  }))
}

export function buildBackgroundListFilters(_response: BackgroundListResponseDto): AuthoredListFilter[] {
  return [
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

export const backgroundListAttributeColumns = [] satisfies AuthoredListAttributeColumn[]

export const backgroundListSortOptions = [
  { value: 'name', label: 'Name A-Z' }
]

export function summarizeBackgroundList(response: BackgroundListResponseDto) {
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} backgrounds / ${masterCount} SRD / ${ownedCount} homebrew`
}
