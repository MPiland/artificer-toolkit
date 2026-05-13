import { describe, expect, it } from 'vitest'
import type { RaceListResponseDto } from '#app/lib/api'
import { buildRaceListFilters, mapRaceListToAuthoredItems } from './raceListMapper'

const response = {
  items: [
    {
      id: 'race-1',
      publicId: 'race-1',
      label: 'Elf',
      description: 'A graceful lineage.',
      status: 'ACTIVE',
      userId: 'master',
      systemId: 'system-1',
      category: 'BASE',
      provenance: { kind: 'MASTER', ownerUserId: null },
      permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
    },
    {
      id: 'race-2',
      publicId: 'race-2',
      label: 'Wood Elf Draft',
      description: null,
      status: 'DRAFT',
      userId: 'user-1',
      systemId: 'system-1',
      category: 'SUBRACE',
      provenance: { kind: 'OWNED', ownerUserId: 'user-1' },
      permissions: { canView: true, canEdit: true, canCopy: true, canDelete: true }
    }
  ],
  drafts: [],
  meta: {}
} satisfies RaceListResponseDto

describe('race list mapper', () => {
  it('maps category and permission metadata for the authored list', () => {
    const items = mapRaceListToAuthoredItems(response)

    expect(items[0]).toMatchObject({
      name: 'Elf',
      attributes: { Category: 'Base Race' },
      sourceKind: 'master',
      permissions: { canEdit: false, canCopy: true }
    })
    expect(items[1]).toMatchObject({
      name: 'Wood Elf Draft',
      attributes: { Category: 'Subrace' },
      sourceKind: 'owned',
      permissions: { canEdit: true, canDelete: true }
    })
  })

  it('builds category filters from active and draft rows', () => {
    const categoryFilter = buildRaceListFilters(response).find((filter) => filter.key === 'category')

    expect(categoryFilter?.options).toEqual([
      { value: 'BASE', label: 'Base Race' },
      { value: 'SUBRACE', label: 'Subrace' }
    ])
  })
})
