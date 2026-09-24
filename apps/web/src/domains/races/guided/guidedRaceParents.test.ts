import { describe, expect, it } from 'vitest'
import type { AuthoredCataloguePage } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { toGuidedRaceParentOptions } from './guidedRaceParents'

describe('toGuidedRaceParentOptions', () => {
  it('keeps only base races and excludes the current draft UUID', () => {
    const items = [
      catalogueRace('00000000-0000-4000-8000-000000000001', 'Base', 'BASE'),
      catalogueRace('00000000-0000-4000-8000-000000000002', 'Self', 'BASE'),
      catalogueRace('00000000-0000-4000-8000-000000000003', 'Subrace', 'SUBRACE')
    ]

    expect(toGuidedRaceParentOptions(items, items[1]?.id)).toEqual([
      { label: 'Base', value: items[0]?.id }
    ])
  })
})

function catalogueRace(
  id: string,
  label: string,
  category: string
): AuthoredCataloguePage['page'][number] {
  return {
    id,
    publicId: label.toLowerCase(),
    systemId: '00000000-0000-4000-8000-000000000010',
    label,
    description: null,
    category,
    activeUpdatedAt: '2026-09-05T00:00:00.000Z',
    status: 'ACTIVE',
    provenance: { kind: 'MASTER', ownerUserId: null },
    permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
  }
}
