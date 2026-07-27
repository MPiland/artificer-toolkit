import { describe, expect, it } from 'vitest'

import { STARTING_EQUIPMENT_ITEM_NODE_MAP, STARTING_EQUIPMENT_OPTION_NODE_MAP } from '#maps'
import { compileStartingEquipmentOption } from '../domains/shared/compilers/startingEquipment.js'

describe('starting equipment node maps', () => {
  it('exposes and compiles option eligibility through the character facet vocabulary', () => {
    const eligibilityNode = STARTING_EQUIPMENT_OPTION_NODE_MAP.nodes.eligibility

    expect(eligibilityNode).toMatchObject({
      kind: 'GROUP',
      groupKind: 'OBJECT',
      label: 'Eligibility'
    })
    if (!eligibilityNode || eligibilityNode.kind !== 'GROUP') {
      throw new Error('Expected eligibility to be an object group')
    }

    const childMap =
      typeof eligibilityNode.nodes === 'function' ? eligibilityNode.nodes() : eligibilityNode.nodes
    expect(childMap.mapId).toBe('characterFacet')

    const eligibility = {
      id: 'eligibility-1',
      groups: [
        {
          id: 'eligibility-group-1',
          order: 1,
          contexts: [
            {
              id: 'eligibility-context-1',
              order: 1,
              subject: 'CHARACTER' as const,
              conditions: [
                {
                  id: 'eligibility-condition-1',
                  order: 1,
                  kind: 'PREDICATE' as const,
                  constraint: 'INCLUDE' as const,
                  predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY' as const,
                  authoringModeKind: 'SELECTED' as const,
                  category: 'ARMOR' as const,
                  properties: ['HEAVY' as const]
                }
              ]
            }
          ]
        }
      ]
    }

    expect(
      compileStartingEquipmentOption({
        id: 'option-1',
        order: 1,
        eligibility,
        items: []
      }).eligibility
    ).toEqual(eligibility)
  })

  it('filters category options from selected properties', () => {
    const categoryNode = STARTING_EQUIPMENT_ITEM_NODE_MAP.nodes.category

    if (
      !categoryNode ||
      categoryNode.kind !== 'INPUT' ||
      categoryNode.type !== 'SELECT_SINGLE' ||
      categoryNode.source.kind !== 'INLINE_OPTIONS'
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
      !equipmentNode ||
      equipmentNode.kind !== 'INPUT' ||
      equipmentNode.type !== 'SELECT_MULTI' ||
      equipmentNode.source.kind !== 'DATA'
    ) {
      throw new Error('Expected equipmentIds to be a data-backed multi select')
    }

    expect(equipmentNode.showIf).toEqual({
      kind: 'AND',
      expressions: [
        {
          kind: 'PREDICATE',
          from: 'LOCAL',
          path: ['startingEquipmentKind'],
          op: '=',
          value: 'EQUIPMENT'
        },
        {
          kind: 'PREDICATE',
          from: 'LOCAL',
          path: ['authoringModeKind'],
          op: '=',
          value: 'SELECTED'
        }
      ]
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
