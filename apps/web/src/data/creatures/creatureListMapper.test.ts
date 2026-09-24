import { describe, expect, it } from 'vitest'
import { buildCreatureListFilters, formatCreatureCategory } from './creatureListMapper'

describe('creature list mapper', () => {
  it('builds category and source filters', () => {
    const filters = buildCreatureListFilters(['BEAST', 'COMPANION', 'MONSTER', 'NPC', 'SUMMON'])

    expect(filters.map((filter) => filter.key)).toEqual(['category', 'source'])
    expect(filters[0].options.map((option) => option.label)).toContain('Beast')
    expect(filters[0].options.map((option) => option.label)).toEqual([
      'Beast',
      'Companion',
      'Monster',
      'NPC',
      'Summon'
    ])
  })

  it('formats NPC as a stable category label', () => {
    expect(formatCreatureCategory('NPC')).toBe('NPC')
  })
})
