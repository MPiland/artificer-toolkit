import type { FeatListResponseDto } from '#app/lib/api'
import type {
  AuthoredListAttributeColumn,
  AuthoredListFilter,
  AuthoredListItem
} from '#components/AuthoredList'
import { summarizeAuthoredDescription } from '../authoredListMapper'

export function mapFeatListToAuthoredItems(response: FeatListResponseDto): AuthoredListItem[] {
  return response.items.map((item) => ({
    id: item.id,
    publicId: item.publicId,
    name: item.label,
    description: summarizeAuthoredDescription(item.description),
    attributes: {},
    filterValues: {
      source: item.provenance.kind
    },
    sortValues: {
      name: item.label
    },
    searchText: summarizeAuthoredDescription(item.description),
    sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
    sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
    permissions: item.permissions
  }))
}

export function buildFeatListFilters(_response: FeatListResponseDto): AuthoredListFilter[] {
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

export const featListAttributeColumns = [] satisfies AuthoredListAttributeColumn[]

export const featListSortOptions = [{ value: 'name', label: 'Name A-Z' }]

export function summarizeFeatList(response: FeatListResponseDto) {
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} feats / ${masterCount} SRD / ${ownedCount} homebrew`
}
