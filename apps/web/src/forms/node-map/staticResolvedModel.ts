import type {
  NodeRuntimeNodeDto,
  NodeRuntimeOptionDto,
  NodeRuntimePathDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
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
  evaluateConditionIf,
  getValueAtPath,
  resolveArrayAuthoringMeta,
  resolveInputAuthoringMeta,
  resolveNodeMapSteps,
  resolveObjectAuthoringMeta,
  type SectionedNodeGroup,
  type SteppedNodeGroup
} from '@artificer-toolkit/shared/utils'

type StaticNodeMap = NodeMap<Record<string, unknown>>
type StaticResolvedFormModelOptions = {
  ancestors?: readonly Record<string, unknown>[]
  parentValues?: Record<string, unknown>
  system?: SystemResponseDto | null
  values?: Record<string, unknown>
}
type SystemVocabularyKey = Exclude<
  keyof NonNullable<SystemResponseDto>,
  'description' | 'id' | 'label' | 'rulesetCode' | 'rulesetVersion' | 'userId'
>

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
  charges: CHARGE_NODE_MAP.mapId,
  proficiencyGrant: PROFICIENCY_NODE_MAP.mapId
}

const RELATIONSHIP_TABLE_TO_SYSTEM_KEY: Readonly<Record<string, SystemVocabularyKey>> = {
  alignments: 'alignments',
  challenge_ratings: 'challengeRatings',
  condition_types: 'conditionTypes',
  creature_types: 'creatureTypes',
  currencies: 'currencies',
  damage_types: 'damageTypes',
  heritages: 'heritages',
  languages: 'languages',
  lifestyles: 'lifestyles',
  magic_schools: 'magicSchools',
  passives: 'passives',
  rarities: 'rarities',
  senses: 'senses',
  skills: 'skills',
  speeds: 'speeds',
  terrains: 'terrains'
}

const STATIC_RELATIONSHIP_OPTIONS: Readonly<Record<string, readonly NodeRuntimeOptionDto[]>> = {
  classes: [
    { value: '00000000-0000-0000-0010-000a00000000', label: 'Sorcerer' },
    { value: '00000000-0000-0000-0010-000c00000000', label: 'Wizard' },
    { value: 'sorcerer', label: 'Sorcerer' },
    { value: 'wizard', label: 'Wizard' }
  ],
  equipment: [
    {
      value: '00000000-0000-0000-0060-001600000000',
      label: 'Shortsword'
    },
    { value: 'longsword', label: 'Longsword' },
    { value: 'backpack', label: 'Backpack' }
  ],
  magic_schools: [
    { value: '00000000-0000-0000-0007-000500000000', label: 'Evocation' },
    { value: 'evocation', label: 'Evocation' },
    { value: 'school-evocation', label: 'Evocation' }
  ]
}

const STATIC_NODE_MAPS = buildStaticNodeMapRegistry(STATIC_ROOT_NODE_MAPS)

export function createStaticResolvedFormModel(
  mapId: string,
  options: StaticResolvedFormModelOptions = {}
): NodeRuntimeResolveResponseDto | undefined {
  const nodeMap = STATIC_NODE_MAPS.get(STATIC_NODE_MAP_ALIASES[mapId] ?? mapId)
  if (!nodeMap) return undefined

  return createResolvedFormModelFromNodeMap(mapId, nodeMap, options)
}

function buildStaticNodeMapRegistry(
  nodeMaps: readonly unknown[]
): ReadonlyMap<string, StaticNodeMap> {
  const registry = new Map<string, StaticNodeMap>()
  for (const nodeMap of nodeMaps) collectStaticNodeMap(nodeMap, registry)
  return registry
}

function collectStaticNodeMap(nodeMap: unknown, registry: Map<string, StaticNodeMap>) {
  const staticNodeMap = nodeMap as StaticNodeMap
  if (registry.has(staticNodeMap.mapId)) return

  registry.set(staticNodeMap.mapId, staticNodeMap)

  for (const node of Object.values(staticNodeMap.nodes)) {
    if (node.kind !== 'GROUP') continue

    const childMap = (typeof node.nodes === 'function' ? node.nodes() : node.nodes) as NodeMap<
      Record<string, unknown>
    >
    collectStaticNodeMap(childMap, registry)
  }
}

export function createResolvedFormModelFromNodeMap<TValues extends object>(
  mapId: string,
  nodeMap: NodeMap<TValues>,
  options: StaticResolvedFormModelOptions = {}
): NodeRuntimeResolveResponseDto {
  const steps = resolveStaticNodeMapSteps(nodeMap).map((step) => ({
    id: step.id,
    label: step.label,
    description: step.description,
    order: step.order,
    sections: step.sections.map((section) => ({
      id: section.id,
      label: section.label,
      order: section.order,
      nodes: section.nodes.map(({ id, node }) => toRuntimeNode(id, node, options))
    }))
  }))
  const clearPaths = steps.flatMap((step) =>
    step.sections.flatMap((section) => section.nodes.flatMap((node) => node.clearPaths))
  )
  const model = {
    mapId,
    steps,
    clearPaths
  }

  return {
    ...model,
    scopes: collectStaticResolvedScopes(nodeMap, options)
  }
}

function collectStaticResolvedScopes<TValues extends object>(
  nodeMap: NodeMap<TValues>,
  options: StaticResolvedFormModelOptions,
  parentPath: NodeRuntimePathDto = []
): NonNullable<NodeRuntimeResolveResponseDto['scopes']> {
  const values = options.values ?? {}
  const scopes: NonNullable<NodeRuntimeResolveResponseDto['scopes']> = []

  for (const node of Object.values(nodeMap.nodes)) {
    if (node.kind !== 'GROUP' || !isStaticNodeVisible(node, options)) continue

    const childMap = (typeof node.nodes === 'function' ? node.nodes() : node.nodes) as NodeMap<
      Record<string, unknown>
    >
    const groupValue = getValueAtPath(values, node.path)
    const childAncestors = [values, ...(options.ancestors ?? [])]

    if (node.groupKind === 'OBJECT') {
      if (!isPopulatedRecord(groupValue)) continue
      const childPath = [...parentPath, ...node.path] as NodeRuntimePathDto
      const childModel = createResolvedFormModelFromNodeMap(childMap.mapId, childMap, {
        ancestors: childAncestors,
        parentValues: values,
        system: options.system,
        values: groupValue
      })
      scopes.push({
        mapId: childModel.mapId,
        path: childPath,
        steps: childModel.steps,
        clearPaths: childModel.clearPaths
      })
      scopes.push(...prefixResolvedScopes(childModel.scopes, childPath))
      continue
    }

    if (!Array.isArray(groupValue)) continue
    groupValue.forEach((row, index) => {
      if (!isPopulatedRecord(row)) return
      const childPath = [...parentPath, ...node.path, index] as NodeRuntimePathDto
      const childModel = createResolvedFormModelFromNodeMap(childMap.mapId, childMap, {
        ancestors: childAncestors,
        parentValues: values,
        system: options.system,
        values: row
      })
      scopes.push({
        mapId: childModel.mapId,
        path: childPath,
        steps: childModel.steps,
        clearPaths: childModel.clearPaths
      })
      scopes.push(...prefixResolvedScopes(childModel.scopes, childPath))
    })
  }

  return scopes
}

function prefixResolvedScopes(
  scopes: NodeRuntimeResolveResponseDto['scopes'],
  prefix: NodeRuntimePathDto
): NonNullable<NodeRuntimeResolveResponseDto['scopes']> {
  return (scopes ?? []).map((scope) => ({
    ...scope,
    path: [...prefix, ...scope.path]
  }))
}

function isPopulatedRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function toRuntimeNode<TValues extends object>(
  id: string,
  node: NodeEntry<TValues>,
  options: StaticResolvedFormModelOptions
): NodeRuntimeNodeDto {
  const visible = isStaticNodeVisible(node, options)
  const base = {
    id,
    path: [...node.path] as NodeRuntimePathDto,
    label: node.label,
    visible,
    required: visible && isStaticNodeRequired(node, options),
    hiddenBehavior: node.hiddenBehavior ?? 'KEEP',
    clearPaths: visible || node.hiddenBehavior !== 'CLEAR' ? [] : [[...node.path]]
  }

  if (node.kind === 'GROUP') {
    const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes

    if (node.groupKind === 'OBJECT') {
      return {
        ...base,
        kind: 'GROUP',
        groupKind: 'OBJECT',
        childMapId: childMap.mapId,
        presentation: node.presentation,
        authoring: resolveObjectAuthoringMeta(node.label, node.authoring)
      }
    }

    return {
      ...base,
      kind: 'GROUP',
      groupKind: 'ARRAY',
      childMapId: childMap.mapId,
      presentation: node.presentation,
      authoring: resolveArrayAuthoringMeta(
        node.label,
        node.presentation,
        node.authoring,
        childMap.authoring
      )
    }
  }

  const authoring = resolveInputAuthoringMeta(node.authoring)
  if (node.type === 'SELECT_SINGLE' || node.type === 'SELECT_MULTI') {
    return {
      ...base,
      kind: 'INPUT',
      type: node.type,
      options: visible
        ? (getStaticInlineOptions(node, options) ??
          getStaticRelationshipOptions(node, options) ??
          [])
        : [],
      authoring
    }
  }

  return {
    ...base,
    kind: 'INPUT',
    type: node.type,
    authoring
  }
}

function isStaticNodeVisible<TValues extends object>(
  node: NodeEntry<TValues>,
  options: StaticResolvedFormModelOptions
) {
  if (!shouldEvaluateStaticConditions(options)) return true
  return evaluateConditionIf(node.showIf, {
    ancestors: options.ancestors,
    parentValues: options.parentValues,
    values: options.values ?? {}
  })
}

function isStaticNodeRequired<TValues extends object>(
  node: NodeEntry<TValues>,
  options: StaticResolvedFormModelOptions
) {
  if (node.requiredIf === true) return true
  if (!node.requiredIf || !shouldEvaluateStaticConditions(options)) return false

  return evaluateConditionIf(node.requiredIf, {
    ancestors: options.ancestors,
    parentValues: options.parentValues,
    values: options.values ?? {}
  })
}

function shouldEvaluateStaticConditions({
  ancestors,
  parentValues,
  values
}: StaticResolvedFormModelOptions) {
  return values !== undefined || parentValues !== undefined || ancestors !== undefined
}

function getStaticInlineOptions<TValues extends object>(
  node: NodeEntry<TValues>,
  options: StaticResolvedFormModelOptions
): NodeRuntimeOptionDto[] | undefined {
  if (
    node.kind !== 'INPUT' ||
    !('source' in node) ||
    (node.source.kind !== 'INLINE_OPTIONS' && node.source.kind !== 'INLINE_GROUPS')
  ) {
    return undefined
  }

  if (node.source.kind === 'INLINE_OPTIONS') {
    return node.source.options.map(toRuntimeOption)
  }

  return node.source.optionGroups
    .filter((group) =>
      evaluateConditionIf(group.showIf, {
        ancestors: options.ancestors,
        parentValues: options.parentValues,
        values: options.values ?? {}
      })
    )
    .flatMap((group) => group.options.map(toRuntimeOption))
}

function getStaticRelationshipOptions<TValues extends object>(
  node: NodeEntry<TValues>,
  { system }: StaticResolvedFormModelOptions
): NodeRuntimeOptionDto[] | undefined {
  if (node.kind !== 'INPUT' || !('source' in node) || node.source.kind !== 'DATA') {
    return undefined
  }

  const relationship = node.source.relationship
  if (relationship.kind !== 'TABLE') return undefined

  const systemKey = RELATIONSHIP_TABLE_TO_SYSTEM_KEY[relationship.table]
  if (systemKey && system) {
    return system[systemKey].map((option) => ({
      value: option.id,
      label: option.label,
      description: option.description ?? option.tooltip ?? undefined
    }))
  }

  return STATIC_RELATIONSHIP_OPTIONS[relationship.table]?.map((option) => ({ ...option }))
}

function toRuntimeOption(option: {
  code: string
  label: string
  tooltip?: string | null
}): NodeRuntimeOptionDto {
  return {
    value: option.code,
    label: option.label,
    description: option.tooltip ?? undefined
  }
}
