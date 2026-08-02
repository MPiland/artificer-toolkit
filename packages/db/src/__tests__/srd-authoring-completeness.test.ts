import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'

import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import { PATH_ORIGIN_KIND } from '@artificer-toolkit/shared/core'
import {
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  VEHICLE_NODE_MAP,
  type NodeEntry,
  type NodeMap,
  type NodeSelectSource
} from '@artificer-toolkit/shared/maps'
import {
  evaluateConditionIf,
  getValueAtPath,
  isRuntimeRecord,
  type NodeRuntimeScope,
  type RuntimePath
} from '@artificer-toolkit/shared/utils'

import type { BaselineSubjectsContent } from '../source-data/content.js'
import { srdBaselineContent } from '../source-data/srd/index.js'

type SubjectDomain = keyof BaselineSubjectsContent

type AuthoredSeedRecord = {
  id: string
  label?: string
}

type CompletenessIssue = {
  domain: SubjectDomain
  record: string
  path: string
  issue: string
}

type DomainCase = {
  domain: SubjectDomain
  records: readonly AuthoredSeedRecord[]
  schema: ZodType<unknown>
  nodeMap: unknown
}

const domainCases = [
  {
    domain: 'backgrounds',
    records: srdBaselineContent.subjects.backgrounds,
    schema: backgroundAuthoredDtoSchema,
    nodeMap: BACKGROUND_NODE_MAP
  },
  {
    domain: 'classes',
    records: srdBaselineContent.subjects.classes,
    schema: classAuthoredDtoSchema,
    nodeMap: CLASS_NODE_MAP
  },
  {
    domain: 'creatures',
    records: srdBaselineContent.subjects.creatures,
    schema: creatureAuthoredDtoSchema,
    nodeMap: CREATURE_NODE_MAP
  },
  {
    domain: 'equipment',
    records: srdBaselineContent.subjects.equipment,
    schema: equipmentAuthoredDtoSchema,
    nodeMap: EQUIPMENT_NODE_MAP
  },
  {
    domain: 'feats',
    records: srdBaselineContent.subjects.feats,
    schema: featAuthoredDtoSchema,
    nodeMap: FEAT_NODE_MAP
  },
  {
    domain: 'races',
    records: srdBaselineContent.subjects.races,
    schema: raceAuthoredDtoSchema,
    nodeMap: RACE_NODE_MAP
  },
  {
    domain: 'spells',
    records: srdBaselineContent.subjects.spells,
    schema: spellAuthoredDtoSchema,
    nodeMap: SPELL_NODE_MAP
  },
  {
    domain: 'vehicles',
    records: srdBaselineContent.subjects.vehicles,
    schema: vehicleAuthoredDtoSchema,
    nodeMap: VEHICLE_NODE_MAP
  }
] satisfies readonly DomainCase[]

const vocabularyTableByKey = {
  alignments: 'alignments',
  challengeRatings: 'challenge_ratings',
  conditionTypes: 'condition_types',
  creatureTypes: 'creature_types',
  currencies: 'currencies',
  damageTypes: 'damage_types',
  heritages: 'heritages',
  languages: 'languages',
  lifestyles: 'lifestyles',
  magicSchools: 'magic_schools',
  passives: 'passives',
  rarities: 'rarities',
  senses: 'senses',
  skills: 'skills',
  speeds: 'speeds',
  terrains: 'terrains'
} as const

const SYSTEM_OWNED_PATH_SEGMENTS = new Map<string, string>([
  ['id', 'stable identity is generated when the authored record or child row is created'],
  ['order', 'array position is normalized into persistence ordering'],
  ['status', 'publication status is controlled by the draft/activation workflow'],
  ['systemId', 'the active rules system is supplied by authoring context'],
  ['userId', 'ownership is supplied by the authenticated authoring context']
])

describe('SRD authoring completeness', () => {
  it('keeps the completeness manifest aligned with every authored SRD subject domain', () => {
    expect(new Set(domainCases.map((entry) => entry.domain))).toEqual(
      new Set(Object.keys(srdBaselineContent.subjects))
    )
  })

  it.each(domainCases)(
    'keeps all $domain SRD seed records complete for authored form flows',
    (domainCase) => {
      const knownIds = buildKnownReferenceIds()
      const issues = domainCase.records.flatMap((record) =>
        validateRecord(domainCase, record, knownIds)
      )

      expect(formatIssues(issues)).toEqual([])
    },
    15_000
  )

  it.each(domainCases)(
    'maps every populated $domain payload field to an authored node',
    (domainCase) => {
      const uncoveredPaths = new Set(
        domainCase.records.flatMap((record) => {
          return collectUncoveredPayloadPaths(domainCase, record).map(formatPathPattern)
        })
      )

      expect([...uncoveredPaths].sort()).toEqual([])
    }
  )

  it('does not treat absent optional payload values as populated authoring fields', () => {
    const paths: RuntimePath[] = []

    collectPayloadLeafPaths({ absent: undefined, present: null }, [], paths)

    expect(paths.map(formatPath)).toEqual(['present'])
  })

  it('allows only the documented fixed structural payload values', () => {
    const proficiencyRecord = {
      id: 'proficiency-record',
      grants: {
        proficiencies: [
          {
            grantKind: 'PROFICIENCY_GRANT',
            proficiencyKind: 'SKILL',
            scalingKind: 'NONE'
          }
        ],
        modifiers: [{ scalingKind: 'NONE' }]
      }
    }
    const nonFixedResourceRecord = {
      id: 'non-fixed-resource',
      resources: {
        charges: {
          limitKind: 'ABILITY_MODIFIER',
          scalingKind: 'NONE'
        }
      }
    }
    const fixedResourceRecord = {
      id: 'fixed-resource',
      resources: {
        charges: {
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE'
        }
      }
    }

    expect(
      isSystemOwnedPayloadValue(proficiencyRecord, ['grants', 'proficiencies', 0, 'grantKind'])
    ).toBe(true)
    expect(
      isSystemOwnedPayloadValue(proficiencyRecord, ['grants', 'proficiencies', 0, 'scalingKind'])
    ).toBe(true)
    expect(
      isSystemOwnedPayloadValue(proficiencyRecord, ['grants', 'modifiers', 0, 'scalingKind'])
    ).toBe(false)
    expect(
      isSystemOwnedPayloadValue(nonFixedResourceRecord, ['resources', 'charges', 'scalingKind'])
    ).toBe(true)
    expect(
      isSystemOwnedPayloadValue(fixedResourceRecord, ['resources', 'charges', 'scalingKind'])
    ).toBe(false)
  })
})

function validateRecord(
  domainCase: DomainCase,
  record: AuthoredSeedRecord,
  knownIds: ReadonlyMap<string, ReadonlySet<string>>
): CompletenessIssue[] {
  const issues: CompletenessIssue[] = []
  const parsed = domainCase.schema.safeParse(record)

  if (!parsed.success) {
    for (const schemaIssue of parsed.error.issues) {
      issues.push(
        createIssue(domainCase.domain, record, schemaIssue.path, `schema: ${schemaIssue.message}`)
      )
    }
  }

  validateNodeMap({
    domain: domainCase.domain,
    record,
    nodeMap: normalizeNodeMap(domainCase.nodeMap),
    values: recordToRuntimeValues(record),
    pathPrefix: [],
    ancestors: [],
    knownIds,
    issues
  })
  validateSemanticCompleteness(domainCase.domain, record, record, [], issues)

  return issues
}

function collectUncoveredPayloadPaths(
  domainCase: DomainCase,
  record: AuthoredSeedRecord
): RuntimePath[] {
  const payloadLeafPaths: RuntimePath[] = []
  const reachableNodePaths = new Set<string>()
  const controlledNodePaths: RuntimePath[] = []

  collectPayloadLeafPaths(record, [], payloadLeafPaths)
  collectReachableNodePaths({
    nodeMap: normalizeNodeMap(domainCase.nodeMap),
    values: recordToRuntimeValues(record),
    pathPrefix: [],
    ancestors: [],
    paths: reachableNodePaths,
    controlledPaths: controlledNodePaths
  })

  return payloadLeafPaths.filter((path) => {
    return (
      !isSystemOwnedPayloadValue(record, path) &&
      !reachableNodePaths.has(formatPath(path)) &&
      !controlledNodePaths.some((controlledPath) => pathStartsWith(path, controlledPath))
    )
  })
}

function collectPayloadLeafPaths(value: unknown, path: RuntimePath, paths: RuntimePath[]) {
  if (value === undefined) return

  if (Array.isArray(value)) {
    if (value.length === 0) {
      paths.push(path)
      return
    }

    value.forEach((item, index) => collectPayloadLeafPaths(item, [...path, index], paths))
    return
  }

  if (!isRuntimeRecord(value)) {
    paths.push(path)
    return
  }

  const entries = Object.entries(value)
  if (entries.length === 0) {
    return
  }

  for (const [key, entry] of entries) {
    collectPayloadLeafPaths(entry, [...path, key], paths)
  }
}

function collectReachableNodePaths(args: {
  nodeMap: NodeMap<Record<string, unknown>>
  values: Record<string, unknown>
  pathPrefix: RuntimePath
  parentValues?: Record<string, unknown>
  ancestors: readonly Record<string, unknown>[]
  paths: Set<string>
  controlledPaths: RuntimePath[]
}) {
  const scope: NodeRuntimeScope = {
    values: args.values,
    parentValues: args.parentValues,
    ancestors: args.ancestors
  }

  for (const node of Object.values(args.nodeMap.nodes)) {
    if (!evaluateConditionIf(node.showIf, scope)) continue

    const path = [...args.pathPrefix, ...node.path]
    const value = getValueAtPath(args.values, node.path)
    args.paths.add(formatPath(path))

    if (node.kind === 'INPUT') {
      args.controlledPaths.push(path)
      continue
    }
    if (value === undefined || value === null) continue

    const childMap = normalizeNodeMap(typeof node.nodes === 'function' ? node.nodes() : node.nodes)
    if (node.groupKind === 'OBJECT') {
      if (!isRuntimeRecord(value)) continue

      collectReachableNodePaths({
        ...args,
        nodeMap: childMap,
        values: value,
        pathPrefix: path,
        parentValues: args.values,
        ancestors: [args.values, ...args.ancestors]
      })
      continue
    }

    if (!Array.isArray(value)) continue

    value.forEach((item, index) => {
      const itemPath = [...path, index]
      if (isPrimitiveArrayWrapper(childMap)) {
        args.paths.add(formatPath(itemPath))
        args.controlledPaths.push(itemPath)
        return
      }
      if (!isRuntimeRecord(item)) return

      collectReachableNodePaths({
        ...args,
        nodeMap: childMap,
        values: item,
        pathPrefix: itemPath,
        parentValues: args.values,
        ancestors: [args.values, ...args.ancestors]
      })
    })
  }
}

function isSystemOwnedPath(path: RuntimePath): boolean {
  const lastSegment = path[path.length - 1]
  return typeof lastSegment === 'string' && SYSTEM_OWNED_PATH_SEGMENTS.has(lastSegment)
}

/**
 * Fixed discriminants and defaults are supplied by their owning model rather
 * than selected by an author. Keep these exceptions path-, value-, and
 * sibling-aware so an unrelated field with the same final key remains audited.
 */
function isSystemOwnedPayloadValue(record: AuthoredSeedRecord, path: RuntimePath): boolean {
  if (isSystemOwnedPath(path)) return true

  const values = recordToRuntimeValues(record)
  const value = getValueAtPath(values, path)
  const parent = getValueAtPath(values, path.slice(0, -1))
  const lastSegment = path[path.length - 1]

  // Proficiency grants are already narrowed by their authored union branch.
  if (
    lastSegment === 'grantKind' &&
    value === 'PROFICIENCY_GRANT' &&
    isRuntimeRecord(parent) &&
    typeof parent.proficiencyKind === 'string'
  ) {
    return true
  }

  if (lastSegment !== 'scalingKind' || value !== 'NONE' || !isRuntimeRecord(parent)) {
    return false
  }

  // Proficiency scaling is deliberately non-configurable in the 2014 model.
  if (parent.grantKind === 'PROFICIENCY_GRANT' && typeof parent.proficiencyKind === 'string') {
    return true
  }

  // A non-fixed resource limit determines its amount without authored scaling.
  return (
    hasNamedPathSuffix(path, ['resources', 'charges', 'scalingKind']) &&
    typeof parent.limitKind === 'string' &&
    parent.limitKind !== 'FIXED_AMOUNT'
  )
}

function hasNamedPathSuffix(path: RuntimePath, suffix: readonly string[]): boolean {
  const namedPath = path.filter((segment): segment is string => typeof segment === 'string')
  if (suffix.length > namedPath.length) return false

  return suffix.every((segment, index) => {
    return namedPath[namedPath.length - suffix.length + index] === segment
  })
}

function pathStartsWith(path: RuntimePath, prefix: RuntimePath): boolean {
  return prefix.length <= path.length && prefix.every((segment, index) => segment === path[index])
}

function formatPathPattern(path: RuntimePath): string {
  return formatPath(path).replace(/\[\d+\]/g, '[]')
}

function validateNodeMap(args: {
  domain: SubjectDomain
  record: AuthoredSeedRecord
  nodeMap: NodeMap<Record<string, unknown>>
  values: Record<string, unknown>
  pathPrefix: RuntimePath
  parentValues?: Record<string, unknown>
  ancestors: readonly Record<string, unknown>[]
  knownIds: ReadonlyMap<string, ReadonlySet<string>>
  issues: CompletenessIssue[]
}) {
  const scope: NodeRuntimeScope = {
    values: args.values,
    parentValues: args.parentValues,
    ancestors: args.ancestors
  }

  for (const [nodeId, node] of Object.entries(args.nodeMap.nodes)) {
    const visible = evaluateConditionIf(node.showIf, scope)
    if (!visible) continue

    const value = getValueAtPath(args.values, node.path)
    const path = [...args.pathPrefix, ...node.path]
    const required =
      node.requiredIf === true ||
      (node.requiredIf !== undefined && evaluateConditionIf(node.requiredIf, scope))

    if (required && isMissingRequiredValue(value, node)) {
      args.issues.push(
        createIssue(args.domain, args.record, path, `required field "${node.label}" is empty`)
      )
    }

    if (node.kind === 'INPUT') {
      if (
        (node.type === 'SELECT_SINGLE' ||
          node.type === 'SELECT_NUMBER' ||
          node.type === 'SELECT_MULTI') &&
        !isEmptyValue(value)
      ) {
        validateSelectValue({
          domain: args.domain,
          record: args.record,
          nodeId,
          node,
          value,
          path,
          scope,
          knownIds: args.knownIds,
          issues: args.issues
        })
      }

      continue
    }

    const childMap = normalizeNodeMap(typeof node.nodes === 'function' ? node.nodes() : node.nodes)
    if (node.groupKind === 'OBJECT') {
      if (value === undefined || value === null) continue
      if (!isRuntimeRecord(value)) {
        args.issues.push(
          createIssue(args.domain, args.record, path, `group "${node.label}" must be an object`)
        )
        continue
      }

      validateNodeMap({
        ...args,
        nodeMap: childMap,
        values: value,
        pathPrefix: path,
        parentValues: args.values,
        ancestors: [args.values, ...args.ancestors]
      })
      continue
    }

    if (value === undefined || value === null) continue
    if (!Array.isArray(value)) {
      args.issues.push(
        createIssue(args.domain, args.record, path, `group "${node.label}" must be an array`)
      )
      continue
    }

    value.forEach((item, index) => {
      const itemPath = [...path, index]
      if (!isRuntimeRecord(item)) {
        if (isPrimitiveArrayWrapper(childMap)) {
          validateNodeMap({
            ...args,
            nodeMap: childMap,
            values: { value: item },
            pathPrefix: itemPath,
            parentValues: args.values,
            ancestors: [args.values, ...args.ancestors]
          })
          return
        }

        args.issues.push(
          createIssue(
            args.domain,
            args.record,
            itemPath,
            `array item in "${node.label}" must be an object`
          )
        )
        return
      }

      if ('id' in childMap.nodes && isEmptyValue(item.id)) {
        args.issues.push(
          createIssue(
            args.domain,
            args.record,
            [...itemPath, 'id'],
            `array item in "${node.label}" requires an id`
          )
        )
      }

      validateNodeMap({
        ...args,
        nodeMap: childMap,
        values: item,
        pathPrefix: itemPath,
        parentValues: args.values,
        ancestors: [args.values, ...args.ancestors]
      })
    })
  }
}

function validateSelectValue(args: {
  domain: SubjectDomain
  record: AuthoredSeedRecord
  nodeId: string
  node: NodeEntry<Record<string, unknown>> & {
    kind: 'INPUT'
    type: 'SELECT_SINGLE' | 'SELECT_NUMBER' | 'SELECT_MULTI'
  }
  value: unknown
  path: RuntimePath
  scope: NodeRuntimeScope
  knownIds: ReadonlyMap<string, ReadonlySet<string>>
  issues: CompletenessIssue[]
}) {
  const values =
    args.node.type === 'SELECT_MULTI'
      ? Array.isArray(args.value)
        ? args.value
        : [args.value]
      : [args.value]

  const inlineValues = collectInlineOptionValues(args.node.source, args.scope)
  if (inlineValues) {
    const invalidValues = values.filter(
      (value) => !inlineValues.has(normalizeInlineSelectValue(value))
    )
    if (invalidValues.length > 0) {
      args.issues.push(
        createIssue(
          args.domain,
          args.record,
          args.path,
          `select field "${args.node.label}" has values outside inline options: ${invalidValues.map(String).join(', ')}`
        )
      )
    }
    return
  }

  const stringValues = values.filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  )
  if (stringValues.length !== values.length) {
    args.issues.push(
      createIssue(
        args.domain,
        args.record,
        args.path,
        `select field "${args.node.label}" must contain string values`
      )
    )
    return
  }

  const candidateIdSets = collectRelationshipTables(args.node.source)
    .map((table) => args.knownIds.get(table))
    .filter((ids): ids is ReadonlySet<string> => ids !== undefined)

  if (candidateIdSets.length === 0) return

  const missingValues = stringValues.filter(
    (value) => !candidateIdSets.some((ids) => ids.has(value))
  )
  if (missingValues.length > 0) {
    args.issues.push(
      createIssue(
        args.domain,
        args.record,
        args.path,
        `select field "${args.node.label}" references unknown ids: ${missingValues.join(', ')}`
      )
    )
  }
}

function isPrimitiveArrayWrapper(nodeMap: NodeMap<Record<string, unknown>>): boolean {
  const nodes = Object.values(nodeMap.nodes)
  if (nodes.length !== 1) return false

  const [node] = nodes
  return node?.kind === 'INPUT' && node.path.length === 1 && node.path[0] === 'value'
}

function normalizeInlineSelectValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value)
}

function validateSemanticCompleteness(
  domain: SubjectDomain,
  record: AuthoredSeedRecord,
  value: unknown,
  path: RuntimePath,
  issues: CompletenessIssue[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateSemanticCompleteness(domain, record, item, [...path, index], issues)
    )
    return
  }

  if (!isRuntimeRecord(value)) return

  if (
    path[path.length - 1] === 'targeting' &&
    value.selectionKind !== undefined &&
    value.selectionKind !== 'SELF' &&
    isEmptyValue(value.dispositionKind)
  ) {
    issues.push(
      createIssue(
        domain,
        record,
        [...path, 'dispositionKind'],
        'non-self targeting must declare target disposition'
      )
    )
  }

  if (Array.isArray(value.paths)) {
    value.paths.forEach((pathValue, index) => {
      const pathPath = [...path, 'paths', index]
      if (!isRuntimeRecord(pathValue)) return

      if (isEmptyValue(pathValue.originKind)) {
        issues.push(
          createIssue(
            domain,
            record,
            [...pathPath, 'originKind'],
            'effect path must declare where it starts from'
          )
        )
      }

      if (pathValue.originKind !== undefined && pathValue.originKind !== PATH_ORIGIN_KIND.SOURCE) {
        const originKind =
          typeof pathValue.originKind === 'string'
            ? pathValue.originKind
            : (JSON.stringify(pathValue.originKind) ?? 'unserializable value')
        issues.push(
          createIssue(
            domain,
            record,
            [...pathPath, 'originKind'],
            `unexpected SRD effect path origin: ${originKind}`
          )
        )
      }

      if (
        pathValue.selectionKind === 'CHOICE' &&
        (!Array.isArray(pathValue.options) || pathValue.options.length === 0)
      ) {
        issues.push(
          createIssue(
            domain,
            record,
            [...pathPath, 'options'],
            'choice effect path must define at least one option'
          )
        )
      }

      if (
        pathValue.selectionKind === 'ROLL_TABLE' &&
        (!Array.isArray(pathValue.rows) || pathValue.rows.length === 0)
      ) {
        issues.push(
          createIssue(
            domain,
            record,
            [...pathPath, 'rows'],
            'roll-table effect path must define at least one row'
          )
        )
      }
    })
  }

  if ('resultKind' in value && Array.isArray(value.outcomes) && value.outcomes.length === 0) {
    issues.push(
      createIssue(
        domain,
        record,
        [...path, 'outcomes'],
        'result block must define at least one outcome'
      )
    )
  }

  for (const [key, entry] of Object.entries(value)) {
    validateSemanticCompleteness(domain, record, entry, [...path, key], issues)
  }
}

function collectInlineOptionValues(
  source: NodeSelectSource,
  scope: NodeRuntimeScope
): ReadonlySet<string> | undefined {
  if (source.kind === 'DATA') return undefined

  if (source.kind === 'INLINE_OPTIONS') {
    return new Set(source.options.map((option) => String(option.code)))
  }

  return new Set(
    source.optionGroups
      .filter((group) => evaluateConditionIf(group.showIf, scope))
      .flatMap((group) => group.options.map((option) => String(option.code)))
  )
}

function collectRelationshipTables(source: NodeSelectSource): string[] {
  if (source.kind !== 'DATA') return []

  const tables = new Set<string>()
  collectRelationshipTablesFromPlan(source.relationship, tables)
  return [...tables]
}

function collectRelationshipTablesFromPlan(plan: unknown, tables: Set<string>) {
  if (!isRuntimeRecord(plan)) return

  if (typeof plan.table === 'string') {
    tables.add(plan.table)
  }

  if (Array.isArray(plan.choices)) {
    for (const choice of plan.choices) {
      if (isRuntimeRecord(choice)) {
        collectRelationshipTablesFromPlan(choice.plan, tables)
      }
    }
  }

  collectRelationshipTablesFromPlan(plan.fallback, tables)

  if (Array.isArray(plan.steps)) {
    for (const step of plan.steps) {
      collectRelationshipTablesFromPlan(step, tables)
    }
  }

  if (Array.isArray(plan.branches)) {
    for (const branch of plan.branches) {
      collectRelationshipTablesFromPlan(branch, tables)
    }
  }
}

function buildKnownReferenceIds(): ReadonlyMap<string, ReadonlySet<string>> {
  const tableIds = new Map<string, Set<string>>()

  addRecordIds(tableIds, 'backgrounds', srdBaselineContent.subjects.backgrounds)
  addRecordIds(tableIds, 'classes', srdBaselineContent.subjects.classes)
  addRecordIds(tableIds, 'creatures', srdBaselineContent.subjects.creatures)
  addRecordIds(tableIds, 'equipment', srdBaselineContent.subjects.equipment)
  addRecordIds(tableIds, 'feats', srdBaselineContent.subjects.feats)
  addRecordIds(tableIds, 'races', srdBaselineContent.subjects.races)
  addRecordIds(tableIds, 'spells', srdBaselineContent.subjects.spells)
  addRecordIds(tableIds, 'vehicles', srdBaselineContent.subjects.vehicles)

  for (const system of srdBaselineContent.vocabulary.systems) {
    for (const [key, table] of Object.entries(vocabularyTableByKey)) {
      const records = system[key as keyof typeof vocabularyTableByKey]
      addRecordIds(tableIds, table, Array.isArray(records) ? records : [])
    }
  }

  collectNestedIds(srdBaselineContent.subjects, tableIds)

  return tableIds
}

function collectNestedIds(value: unknown, tableIds: Map<string, Set<string>>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectNestedIds(item, tableIds))
    return
  }

  if (!isRuntimeRecord(value)) return

  addNestedRecordIds(tableIds, value, 'features', 'features')
  addNestedRecordIds(tableIds, value, 'options', 'options')
  addNestedRecordIds(tableIds, value, 'options', 'feature_options')
  addNestedRecordIds(tableIds, value, 'options', 'race_ancestry_options')
  addNestedRecordIds(tableIds, value, 'resources', 'class_resources')
  addNestedRecordIds(tableIds, value, 'specializations', 'class_specializations')

  for (const entry of Object.values(value)) {
    collectNestedIds(entry, tableIds)
  }
}

function addNestedRecordIds(
  tableIds: Map<string, Set<string>>,
  value: Record<string, unknown>,
  key: string,
  table: string
) {
  const entry = value[key]
  if (Array.isArray(entry)) {
    addRecordIds(tableIds, table, entry)
    return
  }

  if (isRuntimeRecord(entry)) {
    addRecordIds(tableIds, table, [entry])
  }
}

function addRecordIds(
  tableIds: Map<string, Set<string>>,
  table: string,
  records: readonly unknown[]
) {
  const ids = tableIds.get(table) ?? new Set<string>()

  for (const record of records) {
    if (isRuntimeRecord(record) && typeof record.id === 'string') {
      ids.add(record.id)
    }
  }

  tableIds.set(table, ids)
}

function isMissingRequiredValue(value: unknown, node: NodeEntry<Record<string, unknown>>): boolean {
  if (node.kind === 'GROUP') {
    const groupKind = String(node.groupKind)
    return groupKind === 'ARRAY'
      ? !Array.isArray(value) || value.length === 0
      : !isRuntimeRecord(value)
  }

  return isEmptyValue(value)
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return stripHtml(value).length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function recordToRuntimeValues(record: AuthoredSeedRecord): Record<string, unknown> {
  return record as unknown as Record<string, unknown>
}

function normalizeNodeMap(nodeMap: unknown): NodeMap<Record<string, unknown>> {
  return nodeMap as NodeMap<Record<string, unknown>>
}

function createIssue(
  domain: SubjectDomain,
  record: AuthoredSeedRecord,
  path: readonly unknown[],
  issue: string
): CompletenessIssue {
  return {
    domain,
    record: `${record.label ?? 'Unlabeled'} (${record.id})`,
    path: formatPath(path),
    issue
  }
}

function formatPath(path: readonly unknown[]): string {
  if (path.length === 0) return '<root>'

  return path.reduce<string>((result, segment) => {
    if (typeof segment === 'number') return `${result}[${segment}]`
    const key = String(segment)
    return result ? `${result}.${key}` : key
  }, '')
}

function formatIssues(issues: readonly CompletenessIssue[]): string[] {
  return issues.map((issue) => `${issue.domain} > ${issue.record} > ${issue.path} > ${issue.issue}`)
}
