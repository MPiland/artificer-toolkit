import type { EquipmentListResponseDto } from '#app/lib/api'
import type {
  AuthoredListAttributeColumn,
  AuthoredListFilter,
  AuthoredListItem
} from '#components/AuthoredList'
import { summarizeAuthoredDescription } from '../authoredListMapper'

export function formatEquipmentCategory(category: string | undefined): string {
  if (!category) return 'Equipment'
  return category
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

export function mapEquipmentListToAuthoredItems(
  response: EquipmentListResponseDto
): AuthoredListItem[] {
  return response.items.map((item) => {
    const category = item.category ?? 'EQUIPMENT'

    return {
      id: item.id,
      publicId: item.publicId,
      name: item.label,
      description: summarizeAuthoredDescription(item.description),
      attributes: {
        Category: formatEquipmentCategory(category)
      },
      filterValues: {
        category,
        source: item.provenance.kind
      },
      sortValues: {
        category: formatEquipmentCategory(category),
        name: item.label
      },
      searchText: `${summarizeAuthoredDescription(item.description)} ${formatEquipmentCategory(category)}`,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: item.permissions
    }
  })
}

export function buildEquipmentListFilters(
  response: EquipmentListResponseDto
): AuthoredListFilter[] {
  const categories = Array.from(
    new Set(response.items.map((item) => item.category ?? 'EQUIPMENT'))
  ).sort()

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

export function summarizeEquipmentList(response: EquipmentListResponseDto) {
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} items / ${masterCount} SRD / ${ownedCount} homebrew`
}
