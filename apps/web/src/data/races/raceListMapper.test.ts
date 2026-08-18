import { describe, expect, it } from 'vitest'
import type { RaceListResponseDto } from '#app/lib/api'
import {
  buildRaceListFilters,
  mapRaceListToAuthoredItems,
  raceListAttributeColumns
} from './raceListMapper'

const response = {
  items: [
    {
      id: 'race-1',
      publicId: 'race-1',
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      label: 'Elf',
      description: 'A graceful lineage.',
      status: 'ACTIVE',
      userId: 'master',
      systemId: 'system-1',
      category: 'BASE',
      selectionMode: 'REQUIRES_SUBRACE',
      provenance: { kind: 'MASTER', ownerUserId: null },
      permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
    },
    {
      id: 'race-2',
      publicId: 'race-2',
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      label: 'Wood Elf Draft',
      description: null,
      status: 'DRAFT',
      userId: 'user-1',
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
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      label: 'Human',
      description: 'A versatile people.',
      status: 'ACTIVE',
      userId: 'master',
      systemId: 'system-1',
      category: 'BASE',
      selectionMode: 'DIRECT',
      provenance: { kind: 'MASTER', ownerUserId: null },
      permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
    }
  ],
  drafts: [],
  meta: { categories: [{ id: 'BASE' }, { id: 'SUBRACE' }] },
  page: { nextCursor: null, previousCursor: null, totalCount: 3 },
  summary: { activeCount: 3, masterCount: 2, ownedCount: 1 }
} satisfies RaceListResponseDto

describe('race list mapper', () => {
  it('maps playable badges, hierarchy, and permission metadata for the authored list', () => {
    const items = mapRaceListToAuthoredItems(response)

    expect(items[0]).toMatchObject({
      name: 'Elf',
      sourceKind: 'master',
      permissions: { canEdit: false, canCopy: true }
    })
    expect(items[0].badges).toBeUndefined()
    expect(items[0].attributes).toBeUndefined()
    expect(items[1]).toMatchObject({
      name: 'Wood Elf Draft',
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

  it('builds category filters from active and draft rows', () => {
    const categoryFilter = buildRaceListFilters(response).find(
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
