import { describe, expect, it } from 'vitest'
import {
  buildEquipmentListFilters,
  mapEquipmentListToAuthoredItems,
  summarizeEquipmentList
} from './equipmentListMapper'
import { equipmentListResponseFixture } from '#domains/equipment/equipment.fixtures'

describe('equipment list mapper', () => {
  it('maps equipment rows into shared authored list items', () => {
    const items = mapEquipmentListToAuthoredItems(equipmentListResponseFixture)

    expect(items[0]).toMatchObject({
      id: 'backpack',
      name: 'Backpack',
      sourceKind: 'master',
      permissions: {
        canEdit: false,
        canCopy: true
      }
    })
    expect(items[1]).toMatchObject({
      id: 'longsword-plus-one',
      sourceKind: 'owned',
      attributes: {
        Category: 'Variant'
      }
    })
  })

  it('builds category, status, and source filters', () => {
    const filters = buildEquipmentListFilters(equipmentListResponseFixture)

    expect(filters.map((filter) => filter.key)).toEqual(['category', 'status', 'source'])
    expect(filters[0]?.options.map((option) => option.label)).toContain('Variant')
  })

  it('summarizes total, master, and owned counts', () => {
    expect(summarizeEquipmentList(equipmentListResponseFixture)).toBe('2 items / 1 SRD / 1 homebrew')
  })
})
