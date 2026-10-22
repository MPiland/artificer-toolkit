import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EFFECT_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  FEATURE_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP,
  VEHICLE_NODE_MAP,
  type ArrayGroupPresentation,
  type NodeArrayAuthoringMeta,
  type NodeMapAuthoringMeta,
  type NodeObjectAuthoringMeta
} from '@artificer-toolkit/shared/maps'
import {
  resolveArrayAuthoringMeta,
  resolveObjectAuthoringMeta
} from '@artificer-toolkit/shared/utils'
import { hasAuthoringDefaultKind } from './authoringNodeDefaultRegistry.testUtils'

type RuntimeInputNode = { kind: 'INPUT' }

type RuntimeObjectGroupNode = {
  kind: 'GROUP'
  groupKind: 'OBJECT'
  label: string
  presentation: 'inline' | 'branch'
  authoring?: NodeObjectAuthoringMeta
  nodes: RuntimeMap | (() => RuntimeMap)
}

type RuntimeArrayGroupNode = {
  kind: 'GROUP'
  groupKind: 'ARRAY'
  label: string
  presentation: ArrayGroupPresentation
  authoring?: NodeArrayAuthoringMeta
  nodes: RuntimeMap | (() => RuntimeMap)
}

type RuntimeMap = {
  mapId: string
  authoring?: NodeMapAuthoringMeta
  nodes: Record<string, RuntimeInputNode | RuntimeObjectGroupNode | RuntimeArrayGroupNode>
}

const authoredRootMaps = [
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EFFECT_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  FEATURE_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP,
  VEHICLE_NODE_MAP
] as readonly unknown[]

describe('authoring default factory inventory', () => {
  it('registers an exact factory for every add-enabled reachable child map', () => {
    const failures = [...collectNodeMaps(authoredRootMaps).values()].flatMap((nodeMap) =>
      Object.entries(nodeMap.nodes).flatMap(([nodeId, node]) => {
        if (node.kind !== 'GROUP') return []

        const childMap = resolveChildMap(node.nodes)
        const actions =
          node.groupKind === 'ARRAY'
            ? resolveArrayAuthoringMeta(
                node.label,
                node.presentation,
                node.authoring,
                childMap.authoring
              ).collection.actions
            : resolveObjectAuthoringMeta(node.label, node.authoring).actions
        const addEnabled = actions.some((action) => action.type === 'collection.add')

        return addEnabled && !hasAuthoringDefaultKind(childMap.mapId)
          ? [`${nodeMap.mapId}.${nodeId} -> ${childMap.mapId}`]
          : []
      })
    )

    expect(failures).toEqual([])
  })
})

function collectNodeMaps(roots: readonly unknown[]): Map<string, RuntimeMap> {
  const result = new Map<string, RuntimeMap>()
  const queue = roots.map((root) => root as RuntimeMap)

  while (queue.length > 0) {
    const nodeMap = queue.shift()
    if (!nodeMap || result.has(nodeMap.mapId)) continue
    result.set(nodeMap.mapId, nodeMap)

    for (const node of Object.values(nodeMap.nodes)) {
      if (node.kind === 'GROUP') queue.push(resolveChildMap(node.nodes))
    }
  }

  return result
}

function resolveChildMap(child: RuntimeMap | (() => RuntimeMap)): RuntimeMap {
  return typeof child === 'function' ? child() : child
}
