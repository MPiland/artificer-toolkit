import type { VehicleListResponseDto } from '#app/lib/api'
import type { AuthoredListAttributeColumn, AuthoredListFilter, AuthoredListItem } from '#components/AuthoredList'

function mapPermissions(item: VehicleListResponseDto['items'][number]): AuthoredListItem['permissions'] {
  return {
    canView: item.permissions.canView,
    canEdit: item.permissions.canEdit,
    canCopy: item.permissions.canCopy,
    canDelete: item.permissions.canDelete
  }
}

export function formatVehicleCategory(category: string | undefined): string {
  if (!category) return 'Vehicle'
  return category
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function summarizeDescription(description: string | null | undefined): string {
  if (!description) return 'No description yet.'
  return description.replace(/<[^>]*>/g, '').trim() || 'No description yet.'
}

export function mapVehicleListToAuthoredItems(response: VehicleListResponseDto): AuthoredListItem[] {
  return response.items.map((item) => {
    const category = item.category ?? 'VEHICLE'

    return {
      id: item.id,
      publicId: item.publicId,
      name: item.label,
      description: summarizeDescription(item.description),
      attributes: {
        Category: formatVehicleCategory(category)
      },
      filterValues: {
        category,
        source: item.provenance.kind
      },
      sortValues: {
        category: formatVehicleCategory(category),
        name: item.label
      },
      searchText: `${summarizeDescription(item.description)} ${formatVehicleCategory(category)}`,
      sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
      sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
      permissions: mapPermissions(item)
    }
  })
}

export function buildVehicleListFilters(response: VehicleListResponseDto): AuthoredListFilter[] {
  const categories = Array.from(new Set(response.items.map((item) => item.category ?? 'VEHICLE'))).sort()

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

export const vehicleListAttributeColumns = [{ key: 'Category', label: 'Category', width: 180 }] satisfies AuthoredListAttributeColumn[]

export const vehicleListSortOptions = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'category', label: 'Category' }
]

export function summarizeVehicleList(response: VehicleListResponseDto) {
  const masterCount = response.items.filter((item) => item.provenance.kind === 'MASTER').length
  const ownedCount = response.items.length - masterCount

  return `${response.items.length} vehicles / ${masterCount} SRD / ${ownedCount} homebrew`
}
