import type { AuthoredCatalogueSummary } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { AuthoredListAttributeColumn, AuthoredListFilter } from '#components/AuthoredList'

const UNCATEGORIZED_CLASS_CATEGORY = 'UNCATEGORIZED'

export function formatClassCategory(category: string | undefined): string {
  if (!category || category === UNCATEGORIZED_CLASS_CATEGORY) return 'Uncategorized'
  if (category === 'BASE') return 'Base Class'
  if (category === 'SUBCLASS') return 'Subclass'
  return category
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

export function buildClassListFilters(
  categories: AuthoredCatalogueSummary['categories']
): AuthoredListFilter[] {
  return [
    {
      key: 'category',
      label: 'Category',
      placeholder: 'Any category',
      options: categories.map((category) => ({
        value: category,
        label: formatClassCategory(category)
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

export const classListAttributeColumns = [
  { key: 'Category', label: 'Category', width: 180 }
] satisfies AuthoredListAttributeColumn[]

export const classListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'category', label: 'Category' }
]
