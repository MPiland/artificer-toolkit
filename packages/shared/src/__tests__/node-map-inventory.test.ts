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
      'featGrant',
      'featGrantLevel',
      'featGrantProgression',
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

  it('keeps feature grant families reachable through feature-backed child maps', () => {
    const registry = collectNodeMaps(activeRootMaps)

    expect(registry.get('featureGrants')?.nodes).toMatchObject({
      feats: { kind: 'GROUP', groupKind: 'ARRAY' },
      modifiers: { kind: 'GROUP', groupKind: 'ARRAY' },
      proficiencies: { kind: 'GROUP', groupKind: 'ARRAY' },
      senses: { kind: 'GROUP', groupKind: 'ARRAY' },
      spells: { kind: 'GROUP', groupKind: 'ARRAY' }
    })
    expect(registry.has('featGrant')).toBe(true)
    expect(registry.has('modifierGrant')).toBe(true)
    expect(registry.has('proficiencyGrant')).toBe(true)
    expect(registry.has('senseGrant')).toBe(true)
    expect(registry.has('spellGrant')).toBe(true)
  })

  it('uses rich text controls for prose fields', () => {
    const registry = collectNodeMaps(activeRootMaps)
    const failures = [...registry.entries()].flatMap(([mapId, nodeMap]) => (
      Object.entries(nodeMap.nodes)
        .flatMap(([nodeId, node]) => {
          if (node.kind !== 'INPUT' || !isProseField(node) || node.type === 'RICH_TEXT') return []
          return [`${mapId}.${nodeId}:${node.type}`]
        })
    ))

    expect(failures).toEqual([])
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

const proseFieldKeys = new Set(['description', 'detail', 'quote'])

function isProseField(node: RuntimeMap['nodes'][string]): boolean {
  if (node.kind !== 'INPUT') return false

  const lastPathSegment = node.path[node.path.length - 1]
  if (typeof lastPathSegment !== 'string') return false

  const pathKey = lastPathSegment.toLowerCase()
  const labelKey = node.label.toLowerCase()

  return proseFieldKeys.has(pathKey)
    || pathKey.endsWith('description')
    || pathKey.endsWith('detail')
    || pathKey.endsWith('quote')
    || proseFieldKeys.has(labelKey)
}
