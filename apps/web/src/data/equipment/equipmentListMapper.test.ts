import { describe, expect, it } from 'vitest'
import { buildEquipmentListFilters } from './equipmentListMapper'

describe('equipment list mapper', () => {
  it('builds category and source filters', () => {
    const filters = buildEquipmentListFilters(['EQUIPMENT', 'VARIANT'])

    expect(filters.map((filter) => filter.key)).toEqual(['category', 'source'])
    expect(filters[0]?.options.map((option) => option.label)).toContain('Variant')
  })
})
