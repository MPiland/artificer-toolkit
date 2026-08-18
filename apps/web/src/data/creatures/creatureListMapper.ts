import type { CreatureListResponseDto } from '#app/lib/api'
import type {
  AuthoredListAttributeColumn,
  AuthoredListFilter,
  AuthoredListItem
} from '#components/AuthoredList'
import { summarizeAuthoredDescription } from '../authoredListMapper'

export function formatCreatureCategory(category: string | undefined): string {
  if (!category) return 'Creature'
  if (category === 'NPC') return 'NPC'
  return category
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
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
      description: summarizeAuthoredDescription(item.description),
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
      searchText: `${summarizeAuthoredDescription(item.description)} ${categoryLabel}`,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: item.permissions
    }
  })
}

export function buildCreatureListFilters(response: CreatureListResponseDto): AuthoredListFilter[] {
  const categories = Array.from(
    new Set(
      ((response.meta as { categories?: Array<{ id: string }> }).categories ?? []).map(
        (category) => category.id
      )
    )
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
  return `${response.summary.activeCount} creatures / ${response.summary.masterCount} SRD / ${response.summary.ownedCount} homebrew`
}
