import type { VehicleListResponseDto } from '#app/lib/api'
import {
  buildVehicleListFilters,
  formatVehicleCategory,
  mapVehicleListToAuthoredItems,
  summarizeVehicleList
} from './vehicleListMapper'

describe('vehicle list mapper', () => {
  it('maps vehicle list metadata into authored list items', () => {
    const response = createVehicleListResponse()

    const items = mapVehicleListToAuthoredItems(response)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: 'vehicle-1',
      name: 'Sky Skiff',
      attributes: { Category: 'Air' },
      sourceLabel: 'Homebrew'
    })
    expect(items[1]?.sourceLabel).toBe('SRD')
  })

  it('builds category, status, and source filters', () => {
    const filters = buildVehicleListFilters(createVehicleListResponse())

    expect(filters.map((filter) => filter.key)).toEqual([
      'category',
      'status',
      'source'
    ])
    expect(filters[0]?.options.map((option) => option.label)).toContain('Spelljammer')
  })

  it('formats category and summary copy', () => {
    expect(formatVehicleCategory('SPELLJAMMER')).toBe('Spelljammer')
    expect(summarizeVehicleList(createVehicleListResponse())).toBe('2 vehicles / 1 SRD / 1 homebrew')
  })
})

function createVehicleListResponse(): VehicleListResponseDto {
  return {
    items: [
      {
        id: 'vehicle-1',
        label: 'Sky Skiff',
        description: '<p>Fast transport.</p>',
        status: 'DRAFT',
        category: 'AIR',
        userId: 'user-1',
        systemId: 'system-1',
        provenance: { kind: 'OWNED', ownerUserId: 'user-1' },
        permissions: {
          canView: true,
          canEdit: true,
          canCopy: true,
          canDelete: true
        }
      },
      {
        id: 'vehicle-2',
        label: 'Spelljammer',
        description: null,
        status: 'ACTIVE',
        category: 'SPELLJAMMER',
        userId: 'master',
        systemId: 'system-1',
        provenance: { kind: 'MASTER', ownerUserId: null },
        permissions: {
          canView: true,
          canEdit: false,
          canCopy: true,
          canDelete: false
        }
      }
    ],
    meta: {}
  }
}
