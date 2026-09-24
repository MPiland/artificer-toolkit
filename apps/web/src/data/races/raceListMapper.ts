import type { AuthoredCatalogueSummary } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { AuthoredListAttributeColumn, AuthoredListFilter } from '#components/AuthoredList'

export function formatRaceCategory(category: string | undefined): string {
  if (category === 'SUBRACE') return 'Subrace'
  if (category === 'BASE') return 'Base Race'
  return 'Race'
}

export function buildRaceListFilters(
  categories: AuthoredCatalogueSummary['categories']
): AuthoredListFilter[] {
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
