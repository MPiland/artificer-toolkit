import { buildVehicleListFilters, formatVehicleCategory } from './vehicleListMapper'

describe('vehicle list mapper', () => {
  it('builds category and source filters', () => {
    const filters = buildVehicleListFilters(['AIR', 'SPELLJAMMER'])

    expect(filters.map((filter) => filter.key)).toEqual(['category', 'source'])
    expect(filters[0]?.options.map((option) => option.label)).toContain('Spelljammer')
  })

  it('formats categories', () => {
    expect(formatVehicleCategory('SPELLJAMMER')).toBe('Spelljammer')
  })
})
