import type {
  NodeRuntimeNodeDto,
  NodeRuntimeOptionDto,
  NodeRuntimePathDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  BACKGROUND_DETAIL_NODE_MAP,
  CAPACITY_NODE_MAP,
  CHARGE_NODE_MAP,
  CLASS_NODE_MAP,
  CONTAINS_NODE_MAP,
  COST_NODE_MAP,
  DURATION_NODE_MAP,
  EFFECT_NODE_MAP,
  FACET_NODE_MAP,
  FEATURE_NODE_MAP,
  FEATURE_BASICS_NODE_MAP,
  FEATURE_GRANTS_NODE_MAP,
  INVOCATION_NODE_MAP,
  MODIFIER_GRANT_NODE_MAP,
  OPTION_NODE_MAP,
  PATH_NODE_MAP,
  PROFICIENCY_NODE_MAP,
  RANGE_NODE_MAP,
  STARTING_EQUIPMENT_ITEM_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP,
  SPEED_NODE_MAP,
  VEHICLE_NODE_MAP,
  WEIGHT_NODE_MAP,
  BACKGROUND_NODE_MAP,
  CREATURE_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  type NodeEntry,
  type NodeMap
} from '@artificer-toolkit/shared/maps'
import {
  resolveNodeMapSteps,
  type SectionedNodeGroup,
  type SteppedNodeGroup
} from '@artificer-toolkit/shared/utils'

type StaticNodeMap = NodeMap<Record<string, unknown>>

const STATIC_ROOT_NODE_MAPS = [
  BACKGROUND_NODE_MAP,
  BACKGROUND_DETAIL_NODE_MAP,
  CAPACITY_NODE_MAP,
  CHARGE_NODE_MAP,
  CLASS_NODE_MAP,
  CONTAINS_NODE_MAP,
  COST_NODE_MAP,
  CREATURE_NODE_MAP,
  DURATION_NODE_MAP,
  EFFECT_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FACET_NODE_MAP,
  FEAT_NODE_MAP,
  FEATURE_NODE_MAP,
  FEATURE_BASICS_NODE_MAP,
  FEATURE_GRANTS_NODE_MAP,
  INVOCATION_NODE_MAP,
  MODIFIER_GRANT_NODE_MAP,
  OPTION_NODE_MAP,
  PATH_NODE_MAP,
  PROFICIENCY_NODE_MAP,
  RACE_NODE_MAP,
  RANGE_NODE_MAP,
  SPELL_NODE_MAP,
  SPEED_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP,
  STARTING_EQUIPMENT_ITEM_NODE_MAP,
  VEHICLE_NODE_MAP,
  WEIGHT_NODE_MAP
] as const

const STATIC_NODE_MAP_ALIASES: Readonly<Record<string, string>> = {
  detail: BACKGROUND_DETAIL_NODE_MAP.mapId,
  charges: CHARGE_NODE_MAP.mapId,
  proficiencyGrant: PROFICIENCY_NODE_MAP.mapId
}

const STATIC_RELATIONSHIP_OPTIONS: Readonly<Record<string, readonly NodeRuntimeOptionDto[]>> = {
  classes: [
    { value: '00000000-0000-0000-0010-000a00000000', label: 'Sorcerer' },
    { value: '00000000-0000-0000-0010-000c00000000', label: 'Wizard' },
    { value: 'sorcerer', label: 'Sorcerer' },
    { value: 'wizard', label: 'Wizard' }
  ],
  magic_schools: [
    { value: '00000000-0000-0000-0007-000500000000', label: 'Evocation' },
    { value: 'evocation', label: 'Evocation' },
    { value: 'school-evocation', label: 'Evocation' }
  ]
}

const STATIC_NODE_MAPS = buildStaticNodeMapRegistry(STATIC_ROOT_NODE_MAPS)

export function createStaticResolvedFormModel(mapId: string): NodeRuntimeResolveResponseDto | undefined {
  const nodeMap = STATIC_NODE_MAPS.get(STATIC_NODE_MAP_ALIASES[mapId] ?? mapId)
  if (!nodeMap) return undefined

  return createResolvedFormModelFromNodeMap(mapId, nodeMap)
}

function buildStaticNodeMapRegistry(nodeMaps: readonly unknown[]): ReadonlyMap<string, StaticNodeMap> {
  const registry = new Map<string, StaticNodeMap>()
  for (const nodeMap of nodeMaps) collectStaticNodeMap(nodeMap, registry)
  return registry
}

function collectStaticNodeMap(
  nodeMap: unknown,
  registry: Map<string, StaticNodeMap>
) {
  const staticNodeMap = nodeMap as StaticNodeMap
  if (registry.has(staticNodeMap.mapId)) return

  registry.set(staticNodeMap.mapId, staticNodeMap)

  for (const node of Object.values(staticNodeMap.nodes)) {
    if (node.kind !== 'GROUP') continue

    const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
    collectStaticNodeMap(childMap, registry)
  }
}

export function createResolvedFormModelFromNodeMap<TValues extends object>(
  mapId: string,
  nodeMap: NodeMap<TValues>
): NodeRuntimeResolveResponseDto {
  return {
    mapId,
    steps: resolveStaticNodeMapSteps(nodeMap).map((step) => ({
      id: step.id,
      label: step.label,
      order: step.order,
      sections: step.sections.map((section) => ({
        id: section.id,
        label: section.label,
        order: section.order,
        nodes: section.nodes.map(({ id, node }) => toRuntimeNode(id, node))
      }))
    })),
    clearPaths: []
  }
}

function resolveStaticNodeMapSteps<TValues extends object>(
  nodeMap: NodeMap<TValues>
): SteppedNodeGroup<TValues>[] {
  const steps = resolveNodeMapSteps(nodeMap)
  if (steps.length > 0) return steps

  const defaultSection: SectionedNodeGroup<TValues> = {
    id: 'default',
    label: 'Details',
    order: 10,
    nodes: Object.entries(nodeMap.nodes)
      .sort(([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0))
      .map(([id, node]) => ({
        id,
        node,
        section: { id: 'default', label: 'Details', order: 10 }
      }))
  }

  return [
    {
      id: 'default',
      label: 'Details',
      order: 10,
      sections: [defaultSection]
    }
  ]
}

function toRuntimeNode<TValues extends object>(id: string, node: NodeEntry<TValues>): NodeRuntimeNodeDto {
  const base = {
    id,
    path: [...node.path] as NodeRuntimePathDto,
    label: node.label,
    kind: node.kind,
    visible: true,
    required: node.requiredIf === true,
    hiddenBehavior: node.hiddenBehavior,
    clearPaths: []
  } satisfies Pick<
    NodeRuntimeNodeDto,
    'id' | 'path' | 'label' | 'kind' | 'visible' | 'required' | 'hiddenBehavior' | 'clearPaths'
  >

  if (node.kind === 'GROUP') {
    const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes

    return {
      ...base,
      kind: 'GROUP',
      groupKind: node.groupKind,
      childMapId: childMap.mapId
    }
  }

  return {
    ...base,
    kind: 'INPUT',
    type: node.type,
    options: getStaticInlineOptions(node) ?? getStaticRelationshipOptions(node)
  }
}

function getStaticInlineOptions<TValues extends object>(node: NodeEntry<TValues>): NodeRuntimeOptionDto[] | undefined {
  if (node.kind !== 'INPUT' || !('source' in node) || node.source.kind !== 'INLINE') {
    return undefined
  }

  if ('options' in node.source) {
    return node.source.options.map(toRuntimeOption)
  }

  return node.source.optionGroups.flatMap((group) => group.options.map(toRuntimeOption))
}

function getStaticRelationshipOptions<TValues extends object>(
  node: NodeEntry<TValues>
): NodeRuntimeOptionDto[] | undefined {
  if (node.kind !== 'INPUT' || !('source' in node) || node.source.kind !== 'DATA') {
    return undefined
  }

  const relationship = node.source.relationship
  if (relationship.kind !== 'TABLE') return undefined

  return STATIC_RELATIONSHIP_OPTIONS[relationship.table]?.map((option) => ({ ...option }))
}

function toRuntimeOption(option: { code: string, label: string, tooltip?: string | null }): NodeRuntimeOptionDto {
  return {
    value: option.code,
    label: option.label,
    description: option.tooltip ?? undefined
  }
}
