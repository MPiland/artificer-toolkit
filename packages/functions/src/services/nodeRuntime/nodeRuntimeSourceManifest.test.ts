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
  type ChainedStep,
  type NodeMap,
  type RelationshipPlan,
  type StepPlan,
  type WhereExpr
} from '@artificer-toolkit/shared/maps'
import { nodeRuntimeSourceManifest } from './nodeRuntimeSourceManifest.js'

type RuntimeMap = NodeMap<Record<string, unknown>>
type RuntimePlan = RelationshipPlan | StepPlan | ChainedStep

const activeRootMaps = [
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

describe('node runtime source manifest', () => {
  it('exactly covers every table and column used by reachable data sources', () => {
    const expected = collectReachableSourceManifest(activeRootMaps)
    const actual = Object.fromEntries(
      Object.entries(nodeRuntimeSourceManifest).map(([table, columns]) => [
        table,
        [...columns].sort()
      ])
    )

    expect(actual).toEqual(expected)
  })
})

function collectReachableSourceManifest(
  roots: readonly unknown[]
): Readonly<Record<string, readonly string[]>> {
  const maps = new Map<string, RuntimeMap>()
  const columnsByTable = new Map<string, Set<string>>()

  roots.forEach((root) => collectMap(root as RuntimeMap, maps))
  maps.forEach((nodeMap) => {
    Object.values(nodeMap.nodes).forEach((node) => {
      if (node.kind !== 'INPUT' || !('source' in node) || node.source.kind !== 'DATA') return
      collectPlan(node.source.relationship, columnsByTable)
    })
  })

  return Object.fromEntries(
    [...columnsByTable.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([table, columns]) => [table, [...columns].sort()])
  )
}

function collectMap(nodeMap: RuntimeMap, maps: Map<string, RuntimeMap>): void {
  if (maps.has(nodeMap.mapId)) return
  maps.set(nodeMap.mapId, nodeMap)

  Object.values(nodeMap.nodes).forEach((node) => {
    if (node.kind !== 'GROUP') return
    collectMap(typeof node.nodes === 'function' ? node.nodes() : node.nodes, maps)
  })
}

function collectPlan(plan: RuntimePlan, columnsByTable: Map<string, Set<string>>): void {
  switch (plan.kind) {
    case 'TABLE':
      addColumns(
        columnsByTable,
        plan.table,
        plan.selectColumns ??
          (plan.table === 'currencies'
            ? ['id', 'code', 'label', 'short', 'tooltip', 'description']
            : ['id'])
      )
      collectWhere(plan.table, plan.where, columnsByTable)
      return
    case 'SEED':
      addColumns(columnsByTable, plan.table, [plan.valueColumn])
      collectWhere(plan.table, plan.where, columnsByTable)
      return
    case 'MAP_VALUES':
      addColumns(columnsByTable, plan.table, [
        plan.whereColumn,
        plan.valueColumn,
        ...(plan.selectColumns ?? [])
      ])
      collectWhere(plan.table, plan.where, columnsByTable)
      return
    case 'CHAIN':
      plan.steps.forEach((step) => collectPlan(step, columnsByTable))
      return
    case 'UNION':
      plan.branches.forEach((branch) => collectPlan(branch, columnsByTable))
      return
    case 'CONDITION':
      plan.choices.forEach((choice) => collectPlan(choice.plan, columnsByTable))
      if (plan.fallback) collectPlan(plan.fallback, columnsByTable)
  }
}

function collectWhere(
  table: string,
  where: WhereExpr | undefined,
  columnsByTable: Map<string, Set<string>>
): void {
  if (!where) return
  switch (where.kind) {
    case 'PREDICATE':
      addColumns(columnsByTable, table, [where.column])
      return
    case 'NOT':
      collectWhere(table, where.expression, columnsByTable)
      return
    case 'AND':
    case 'OR':
      where.expressions.forEach((expression) =>
        collectWhere(table, expression, columnsByTable)
      )
  }
}

function addColumns(
  columnsByTable: Map<string, Set<string>>,
  table: string,
  columns: readonly string[]
): void {
  const tableColumns = columnsByTable.get(table) ?? new Set<string>()
  columns.forEach((column) => tableColumns.add(column))
  columnsByTable.set(table, tableColumns)
}
