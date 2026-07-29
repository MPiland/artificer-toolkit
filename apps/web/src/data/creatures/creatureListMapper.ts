import type { CreatureListResponseDto } from '#app/lib/api'
import type {
  AuthoredListAttributeColumn,
  AuthoredListFilter,
  AuthoredListItem
} from '#components/AuthoredList'

function mapPermissions(
  item: CreatureListResponseDto['items'][number]
): AuthoredListItem['permissions'] {
  return {
    canView: item.permissions.canView,
    canEdit: item.permissions.canEdit,
    canCopy: item.permissions.canCopy,
    canDelete: item.permissions.canDelete
  }
}

export function formatCreatureCategory(category: string | undefined): string {
  if (!category) return 'Creature'
  if (category === 'NPC') return 'NPC'
  return category
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function summarizeDescription(description: string | null | undefined): string {
  if (!description) return 'No description yet.'
  return description.replace(/<[^>]*>/g, '').trim() || 'No description yet.'
}

export function mapCreatureListToAuthoredItems(
  response: CreatureListResponseDto
): AuthoredListItem[] {
  return response.items.map((item) => {
    const category = item.category ?? 'CREATURE'
    const categoryLabel = formatCreatureCategory(category)

    return {
      id: item.id,
      publicId: item.publicId,
      name: item.label,
      description: summarizeDescription(item.description),
      attributes: {
        Category: categoryLabel
      },
      filterValues: {
        category,
        source: item.provenance.kind
      },
      sortValues: {
        category: categoryLabel,
        name: item.label
      },
      searchText: `${summarizeDescription(item.description)} ${categoryLabel}`,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: mapPermissions(item)
    }
  })
}

export function buildCreatureListFilters(response: CreatureListResponseDto): AuthoredListFilter[] {
  const categories = Array.from(
    new Set(response.items.map((item) => item.category ?? 'CREATURE'))
  ).sort()

  return [
    {
      key: 'category',
      label: 'Category',
      placeholder: 'Any category',
      options: categories.map((category) => ({
        value: category,
        label: formatCreatureCategory(category)
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

export const creatureListAttributeColumns = [
  { key: 'Category', label: 'Category', width: 180 }
] satisfies AuthoredListAttributeColumn[]

export const creatureListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'category', label: 'Category' }
]

export function summarizeCreatureList(response: CreatureListResponseDto) {
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} creatures / ${masterCount} SRD / ${ownedCount} homebrew`
}
