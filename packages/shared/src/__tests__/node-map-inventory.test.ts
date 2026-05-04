import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EFFECT_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP,
  VEHICLE_NODE_MAP,
  type NodeMap
} from '../barrels/maps/index.js'

type RuntimeMap = NodeMap<Record<string, unknown>>

const activeRootMaps = [
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EFFECT_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP,
  VEHICLE_NODE_MAP
] as readonly unknown[]

describe('node map inventory', () => {
  it('registers every active child map reachable from authored root maps', () => {
    const registry = collectNodeMaps(activeRootMaps)

    expect([...registry.keys()].sort()).toEqual(expect.arrayContaining([
      'background',
      'charges',
      'class',
      'classResource',
      'contains',
      'creature',
      'effect',
      'equipment',
      'facet',
      'feat',
      'feature',
      'featureGrants',
      'modifierGrant',
      'option',
      'proficiencyGrant',
      'race',
      'raceAncestry',
      'raceAncestryOption',
      'spell',
      'startingEquipment',
      'startingEquipmentItem',
      'vehicle'
    ]))
  })

  it('does not leave active group nodes without child maps', () => {
    const registry = collectNodeMaps(activeRootMaps)
    const missingChildren = [...registry.values()].flatMap((nodeMap) => (
      Object.entries(nodeMap.nodes)
        .flatMap(([nodeId, node]) => {
          if (node.kind !== 'GROUP') return []

          const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
          return childMap?.mapId ? [] : [`${nodeMap.mapId}.${nodeId}`]
        })
    ))

    expect(missingChildren).toEqual([])
  })
})

function collectNodeMaps(nodeMaps: readonly unknown[]): ReadonlyMap<string, RuntimeMap> {
  const registry = new Map<string, RuntimeMap>()

  for (const nodeMap of nodeMaps) collectNodeMap(nodeMap, registry)

  return registry
}

function collectNodeMap(
  nodeMap: unknown,
  registry: Map<string, RuntimeMap>
) {
  const runtimeNodeMap = nodeMap as RuntimeMap
  if (registry.has(runtimeNodeMap.mapId)) return

  registry.set(runtimeNodeMap.mapId, runtimeNodeMap)

  for (const node of Object.values(runtimeNodeMap.nodes)) {
    if (node.kind !== 'GROUP') continue

    const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
    collectNodeMap(childMap, registry)
  }
}
