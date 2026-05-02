import { describe, expect, it } from 'vitest'

import { CREATURE_CATEGORY_CODE } from '#core'
import {
  type NodeMap,
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  VEHICLE_NODE_MAP
} from '#maps'
import { buildNodeMap, evaluateConditionIf, resolveNestedNodeSections, resolveNodeMapSections } from '#utils'

describe('node map sections', () => {
  it('resolves section groups in stable order', () => {
    const sections = resolveNodeMapSections(SPELL_NODE_MAP)

    expect(sections.map((section) => section.id)).toEqual([
      'basics',
      'casting',
      'relationships',
      'effects'
    ])
    expect(sections[0]?.nodes.map((node) => node.id)).toContain('label')
  })

  it('inherits nearest parent sections for nested nodes', () => {
    const childMap = buildNodeMap<{ label?: string }>().define('child', ({ map, nodes }) => {
      map.set('label', nodes.text(['label'], 'Name'))
    })

    const parentMap = buildNodeMap<{ child?: { label?: string } }>().define('parent', ({ map, nodes }) => {
      map.set('child', nodes.groupObject(['child'], 'Child', () => childMap, {
        section: { id: 'details', label: 'Details', order: 10 }
      }))
    })

    const entries = resolveNestedNodeSections(parentMap)

    expect(entries.map((entry) => `${entry.section.id}:${entry.id}`)).toEqual([
      'details:child',
      'details:label'
    ])
  })

  it('models spell material details as a conditional clearable field', () => {
    const materialNode = SPELL_NODE_MAP.nodes.materialDescription

    expect(materialNode.hiddenBehavior).toBe('CLEAR')
    expect(evaluateConditionIf(materialNode.showIf, {
      values: { components: ['MATERIAL'] }
    })).toBe(true)
    expect(evaluateConditionIf(materialNode.showIf, {
      values: { components: ['VERBAL'] }
    })).toBe(false)
  })

  it('models creature category-specific profiles as conditional clearable groups', () => {
    const mountNode = CREATURE_NODE_MAP.nodes.mountProfile
    const legendaryNode = CREATURE_NODE_MAP.nodes.legendaryProfile
    const companionNode = CREATURE_NODE_MAP.nodes.companionProfile

    expect(mountNode.hiddenBehavior).toBe('CLEAR')
    expect(evaluateConditionIf(mountNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.BEAST }
    })).toBe(true)
    expect(evaluateConditionIf(mountNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.MONSTER }
    })).toBe(false)

    expect(legendaryNode.hiddenBehavior).toBe('CLEAR')
    expect(evaluateConditionIf(legendaryNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.MONSTER }
    })).toBe(true)
    expect(evaluateConditionIf(legendaryNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.BEAST }
    })).toBe(false)

    expect(companionNode.hiddenBehavior).toBe('CLEAR')
    expect(evaluateConditionIf(companionNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.COMPANION }
    })).toBe(true)
    expect(evaluateConditionIf(companionNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.SUMMON }
    })).toBe(true)
  })

  it('provides sections for every authored subject map', () => {
    const maps: NodeMap<object>[] = [
      BACKGROUND_NODE_MAP,
      CLASS_NODE_MAP,
      CREATURE_NODE_MAP,
      EQUIPMENT_NODE_MAP,
      FEAT_NODE_MAP,
      RACE_NODE_MAP,
      SPELL_NODE_MAP,
      VEHICLE_NODE_MAP
    ]

    maps.forEach((nodeMap) => {
      const sections = resolveNodeMapSections(nodeMap)
      expect(sections.length, `${nodeMap.mapId} should expose form sections`).toBeGreaterThan(0)
      expect(sections.every((section) => section.nodes.length > 0)).toBe(true)
    })
  })
})
