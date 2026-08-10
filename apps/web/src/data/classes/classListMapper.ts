import type { ClassListResponseDto } from '#app/lib/api'
import type {
  AuthoredListAttributeColumn,
  AuthoredListFilter,
  AuthoredListItem
} from '#components/AuthoredList'
import { summarizeAuthoredDescription } from '../authoredListMapper'

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

export function mapClassListToAuthoredItems(response: ClassListResponseDto): AuthoredListItem[] {
  const parentLabels = new Map(response.items.map((item) => [item.id, item.label]))

  return response.items.map((item) => {
    const category = item.category ?? UNCATEGORIZED_CLASS_CATEGORY
    const categoryLabel = formatClassCategory(category)
    const parentClassId = item.parentClassId ?? undefined
    const parentLabel = parentClassId ? parentLabels.get(parentClassId) : undefined

    return {
      id: item.id,
      publicId: item.publicId,
      name: item.label,
      description: summarizeAuthoredDescription(item.description),
      attributes: {
        Category: categoryLabel
      },
      hierarchy: parentClassId
        ? {
            level: 1,
            parentId: parentClassId,
            parentLabel
          }
        : undefined,
      filterValues: {
        category,
        source: item.provenance.kind
      },
      sortValues: {
        category: categoryLabel,
        name: item.label
      },
      searchText: `${summarizeAuthoredDescription(item.description)} ${categoryLabel}`,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: item.permissions
    }
  })
}

export function buildClassListFilters(response: ClassListResponseDto): AuthoredListFilter[] {
  const categories = Array.from(
    new Set(response.items.map((item) => item.category ?? UNCATEGORIZED_CLASS_CATEGORY))
  ).sort()

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

export function summarizeClassList(response: ClassListResponseDto) {
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} classes / ${masterCount} SRD / ${ownedCount} homebrew`
}
