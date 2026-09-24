import type { AuthoredCatalogueSummary } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { AuthoredListAttributeColumn, AuthoredListFilter } from '#components/AuthoredList'

export function formatEquipmentCategory(category: string | undefined): string {
  if (!category) return 'Equipment'
  return category
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

export function buildEquipmentListFilters(
  categories: AuthoredCatalogueSummary['categories']
): AuthoredListFilter[] {
  return [
    {
      key: 'category',
      label: 'Category',
      placeholder: 'Any category',
      options: categories.map((category) => ({
        value: category,
        label: formatEquipmentCategory(category)
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

export const equipmentListAttributeColumns = [
  { key: 'Category', label: 'Category', width: 180 }
] satisfies AuthoredListAttributeColumn[]

export const equipmentListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'category', label: 'Category' }
]
