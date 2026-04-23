import { describe, expect, it } from 'vitest'

import { STARTING_EQUIPMENT_ITEM_NODE_MAP } from '#maps'

describe('starting equipment node maps', () => {
  it('filters category options from selected properties', () => {
    const categoryNode = STARTING_EQUIPMENT_ITEM_NODE_MAP.nodes.category

    if (
      !categoryNode
      || categoryNode.kind !== 'INPUT'
      || categoryNode.type !== 'SELECT_SINGLE'
      || categoryNode.source.kind !== 'INLINE'
      || !('options' in categoryNode.source)
    ) {
      throw new Error('Expected category to be an inline select input')
    }

    expect(categoryNode.source.filter?.kind).toBe('ALLOW')

    const filterPlan = categoryNode.source.filter?.by
    expect(filterPlan?.kind).toBe('CONDITION')

    if (!filterPlan || filterPlan.kind !== 'CONDITION') {
      throw new Error('Expected category filter to be a condition plan')
    }

    expect(filterPlan.choices).toHaveLength(1)
    expect(filterPlan.fallback?.kind).toBe('CHAIN')

    const serialized = JSON.stringify(filterPlan)
    expect(serialized).toContain('"table":"equipment_properties"')
    expect(serialized).toContain('"valueColumn":"equipment_id"')
    expect(serialized).toContain('"valueColumn":"category"')
    expect(serialized).toContain('"kind":"SEED"')
  })

  it('intersects category and properties when filtering equipment options', () => {
    const equipmentNode = STARTING_EQUIPMENT_ITEM_NODE_MAP.nodes.equipmentIds

    if (
      !equipmentNode
      || equipmentNode.kind !== 'INPUT'
      || equipmentNode.type !== 'SELECT_MULTI'
      || equipmentNode.source.kind !== 'DATA'
    ) {
      throw new Error('Expected equipmentIds to be a data-backed multi select')
    }

    expect(equipmentNode.showIf).toEqual({
      from: 'LOCAL',
      path: ['authoringModeKind'],
      op: '=',
      value: 'SELECTED'
    })

    const relationship = equipmentNode.source.relationship
    expect(relationship.kind).toBe('CONDITION')

    if (relationship.kind !== 'CONDITION') {
      throw new Error('Expected equipmentIds relationship to be a condition plan')
    }

    expect(relationship.choices).toHaveLength(3)
    expect(relationship.fallback?.kind).toBe('TABLE')

    const [bothFiltersChoice, propertiesOnlyChoice, categoryOnlyChoice] = relationship.choices

    expect(bothFiltersChoice?.plan.kind).toBe('CHAIN')
    expect(propertiesOnlyChoice?.plan.kind).toBe('CHAIN')
    expect(categoryOnlyChoice?.plan.kind).toBe('MAP_VALUES')

    const serialized = JSON.stringify(bothFiltersChoice?.plan)
    expect(serialized).toContain('"table":"equipment_properties"')
    expect(serialized).toContain('"table":"equipment"')
    expect(serialized).toContain('"column":"category"')
    expect(serialized).toContain('"op":"IN"')
    expect(serialized).toContain('"path":["category"]')
  })
})
