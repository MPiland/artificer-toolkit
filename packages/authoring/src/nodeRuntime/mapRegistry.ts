import type { RuntimeNodeEntry, RuntimeNodeMap } from '@artificer-toolkit/shared/maps'
import {
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EFFECT_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  PROFICIENCY_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP,
  VEHICLE_NODE_MAP
} from '@artificer-toolkit/shared/maps'

const rootMaps = [
  SPELL_NODE_MAP,
  BACKGROUND_NODE_MAP,
  FEAT_NODE_MAP,
  RACE_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  CREATURE_NODE_MAP,
  VEHICLE_NODE_MAP,
  CLASS_NODE_MAP,
  EFFECT_NODE_MAP,
  PROFICIENCY_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP
] as const

const nodeMapRegistry = buildNodeMapRegistry(rootMaps)

export function getRuntimeNodeMap(mapId: string): RuntimeNodeMap {
  const nodeMap = nodeMapRegistry.get(mapId)
  if (!nodeMap) {
    throw new NodeRuntimeInputError(`Unknown node map: ${mapId}`)
  }

  return nodeMap
}

export function listRuntimeNodeMapIds(): readonly string[] {
  return Array.from(nodeMapRegistry.keys()).sort()
}

export class NodeRuntimeInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NodeRuntimeInputError'
  }
}

function buildNodeMapRegistry(maps: readonly RuntimeNodeMap[]): Map<string, RuntimeNodeMap> {
  const registry = new Map<string, RuntimeNodeMap>()

  for (const nodeMap of maps) {
    collectNodeMap(nodeMap, registry)
  }

  return registry
}

function collectNodeMap(runtimeNodeMap: RuntimeNodeMap, registry: Map<string, RuntimeNodeMap>) {
  const existing = registry.get(runtimeNodeMap.mapId)
  if (existing) {
    if (nodeMapContractSignature(existing) !== nodeMapContractSignature(runtimeNodeMap)) {
      throw new NodeRuntimeInputError(
        `Conflicting node map contracts share map id: ${runtimeNodeMap.mapId}`
      )
    }
    return
  }

  registry.set(runtimeNodeMap.mapId, runtimeNodeMap)

  const keyedEntry = runtimeNodeMap.keyedBy?.entry
  for (const node of [
    ...Object.values(runtimeNodeMap.nodes),
    ...(keyedEntry ? [keyedEntry] : [])
  ]) {
    if (node.kind !== 'GROUP') continue

    const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
    collectNodeMap(childMap, registry)
  }
}

function nodeMapContractSignature(nodeMap: RuntimeNodeMap): string {
  const nodes = Object.entries(nodeMap.nodes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, node]) => [id, nodeContract(node)])
  const keyedBy = nodeMap.keyedBy && {
    rows: nodeMap.keyedBy.rows,
    entry: nodeContract(nodeMap.keyedBy.entry)
  }

  return JSON.stringify({ authoring: nodeMap.authoring, nodes, keyedBy })
}

function nodeContract(node: RuntimeNodeEntry | NonNullable<RuntimeNodeMap['keyedBy']>['entry']) {
  if (node.kind === 'INPUT') return node

  const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
  const contract = Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'nodes'))
  return { ...contract, childMapId: childMap.mapId }
}
