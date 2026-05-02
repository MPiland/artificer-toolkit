import type { ClassListResponseDto } from '#app/lib/api'
import type { AuthoredListAttributeColumn, AuthoredListFilter, AuthoredListItem } from '#components/AuthoredList'

const UNCATEGORIZED_CLASS_CATEGORY = 'UNCATEGORIZED'

function mapPermissions(item: ClassListResponseDto['items'][number]): AuthoredListItem['permissions'] {
  return {
    canView: item.permissions.canView,
    canEdit: item.permissions.canEdit,
    canCopy: item.permissions.canCopy,
    canDelete: item.permissions.canDelete
  }
}

function formatStatus(status: string | undefined): string {
  if (!status) return 'Draft'
  return status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

export function formatClassCategory(category: string | undefined): string {
  if (!category || category === UNCATEGORIZED_CLASS_CATEGORY) return 'Uncategorized'
  if (category === 'BASE') return 'Base Class'
  if (category === 'SUBCLASS') return 'Subclass'
  return category
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function summarizeDescription(description: string | null | undefined): string {
  if (!description) return 'No description yet.'
  return description.replace(/<[^>]*>/g, '').trim() || 'No description yet.'
}

export function mapClassListToAuthoredItems(response: ClassListResponseDto): AuthoredListItem[] {
  return response.items.map((item) => {
    const category = item.category ?? UNCATEGORIZED_CLASS_CATEGORY
    const categoryLabel = formatClassCategory(category)

    return {
      id: item.id,
      name: item.label,
      description: summarizeDescription(item.description),
      attributes: {
        Category: categoryLabel
      },
      badges: [formatStatus(item.status)],
      filterValues: {
        category,
        status: item.status,
        source: item.provenance.kind
      },
      sortValues: {
        category: categoryLabel,
        name: item.label,
        status: formatStatus(item.status)
      },
      searchText: `${summarizeDescription(item.description)} ${categoryLabel}`,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: mapPermissions(item)
    }
  })
}

export function buildClassListFilters(response: ClassListResponseDto): AuthoredListFilter[] {
  const statuses = Array.from(new Set(response.items.map((item) => item.status))).sort()
  const categories = Array.from(new Set(response.items.map((item) => item.category ?? UNCATEGORIZED_CLASS_CATEGORY))).sort()

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
      key: 'status',
      label: 'Status',
      placeholder: 'Any status',
      options: statuses.map((status) => ({
        value: status,
        label: formatStatus(status)
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

export const classListAttributeColumns = [{ key: 'Category', label: 'Category' }] satisfies AuthoredListAttributeColumn[]

export const classListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'category', label: 'Category' },
  { value: 'status', label: 'Status' }
]

export function summarizeClassList(response: ClassListResponseDto) {
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} classes / ${masterCount} SRD / ${ownedCount} homebrew`
}
