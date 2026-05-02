import { describe, expect, it } from 'vitest'
import {
  buildCreatureListFilters,
  mapCreatureListToAuthoredItems,
  summarizeCreatureList
} from './creatureListMapper'
import { creatureListResponseFixture } from '#domains/creatures/creature.fixtures'

describe('creature list mapper', () => {
  it('maps provenance and permissions into authored list items', () => {
    const items = mapCreatureListToAuthoredItems(creatureListResponseFixture)
    const master = items.find((item) => item.sourceKind === 'master')

    expect(items).toHaveLength(6)
    expect(items[0]).toMatchObject({
      name: 'Moonlit Owlbear',
      attributes: {
        Category: 'Monster'
      },
      permissions: {
        canEdit: true,
        canCopy: true
      }
    })
    expect(master?.permissions.canEdit).toBe(false)
    expect(master?.permissions.canCopy).toBe(true)
  })

  it('builds category, status, and source filters', () => {
    const filters = buildCreatureListFilters(creatureListResponseFixture)

    expect(filters.map((filter) => filter.key)).toEqual(['category', 'status', 'source'])
    expect(filters[0].options.map((option) => option.label)).toContain('Beast')
    expect(filters[0].options.map((option) => option.label)).toEqual([
      'Beast',
      'Companion',
      'Monster',
      'NPC',
      'Summon'
    ])
  })

  it('summarizes owned and SRD creature counts', () => {
    expect(summarizeCreatureList(creatureListResponseFixture)).toBe('6 creatures / 1 SRD / 5 homebrew')
  })
})
