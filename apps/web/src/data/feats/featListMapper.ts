import type { AuthoredListAttributeColumn, AuthoredListFilter } from '#components/AuthoredList'

export function buildFeatListFilters(): AuthoredListFilter[] {
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
