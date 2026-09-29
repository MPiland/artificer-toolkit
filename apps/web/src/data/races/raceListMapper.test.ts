import { describe, expect, it } from 'vitest'
import type { AuthoredCatalogueItem } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { mapAuthoredCatalogueItems } from '../authoredCatalogue'
import { buildRaceListFilters, raceListAttributeColumns } from './raceListMapper'

const rows: AuthoredCatalogueItem[] = [
  {
    id: 'race-1',
    publicId: 'race-1',
    label: 'Elf',
    description: 'A graceful lineage.',
    systemId: 'system-1',
    category: 'BASE',
    selectionMode: 'REQUIRES_SUBRACE',
    provenance: { kind: 'MASTER', ownerUserId: null },
    permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
  },
  {
    id: 'race-2',
    publicId: 'race-2',
    label: 'Wood Elf',
    description: null,
    systemId: 'system-1',
    category: 'SUBRACE',
    parentRaceId: 'race-1',
    parentRaceLabel: 'Elf',
    provenance: { kind: 'OWNED', ownerUserId: 'user-1' },
    permissions: { canView: true, canEdit: true, canCopy: true, canDelete: true }
  },
  {
    id: 'race-3',
    publicId: 'race-3',
    label: 'Human',
    description: 'A versatile people.',
    systemId: 'system-1',
    category: 'BASE',
    selectionMode: 'DIRECT',
    provenance: { kind: 'MASTER', ownerUserId: null },
    permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
  }
]

describe('race list mapper', () => {
  it('maps playable badges, hierarchy, and permission metadata for the authored list', () => {
    const items = mapAuthoredCatalogueItems(rows, 'RACE')

    expect(items[0]).toMatchObject({
      name: 'Elf',
      sourceKind: 'master',
      permissions: { canEdit: false, canCopy: true }
    })
    expect(items[0].badges).toBeUndefined()
    expect(items[0].attributes).toBeUndefined()
    expect(items[1]).toMatchObject({
      name: 'Wood Elf',
      badges: ['Playable'],
      hierarchy: {
        level: 1,
        parentId: 'race-1',
        parentLabel: 'Elf'
      },
      sourceKind: 'owned',
      permissions: { canEdit: true, canDelete: true }
    })
    expect(items[2]).toMatchObject({
      name: 'Human',
      badges: ['Playable']
    })
  })

  it('builds category filters from native catalogue facets', () => {
    const categoryFilter = buildRaceListFilters(['BASE', 'SUBRACE']).find(
      (filter) => filter.key === 'category'
    )

    expect(categoryFilter?.options).toEqual([
      { value: 'BASE', label: 'Base Race' },
      { value: 'SUBRACE', label: 'Subrace' }
    ])
  })

  it('does not expose model classification as list columns', () => {
    expect(raceListAttributeColumns).toEqual([])
  })
})
