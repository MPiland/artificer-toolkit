import { describe, expect, it } from 'vitest'

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
import { buildNodeMap, resolveNestedNodeSections, resolveNodeMapSections } from '#utils'

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
