import type { AuthoredListAttributeColumn, AuthoredListFilter } from '#components/AuthoredList'

export function buildBackgroundListFilters(): AuthoredListFilter[] {
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

export const backgroundListSortOptions = [{ value: 'name', label: 'Name A-Z' }]
