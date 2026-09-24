import type { AuthoredCatalogueSummary } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { AuthoredListAttributeColumn, AuthoredListFilter } from '#components/AuthoredList'

export function formatVehicleCategory(category: string | undefined): string {
  if (!category) return 'Vehicle'
  return category
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

export function buildVehicleListFilters(
  categories: AuthoredCatalogueSummary['categories']
): AuthoredListFilter[] {
  return [
    {
      key: 'category',
      label: 'Category',
      placeholder: 'Any category',
      options: categories.map((category) => ({
        value: category,
        label: formatVehicleCategory(category)
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

export const vehicleListAttributeColumns = [
  { key: 'Category', label: 'Category', width: 180 }
] satisfies AuthoredListAttributeColumn[]

export const vehicleListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'category', label: 'Category' }
]
