import type {
  NodeRuntimeQueryRow,
  NodeRuntimeQueryWhere,
  NodeRuntimeSourceReader
} from './nodeRuntimeSourceContract.js'
import type {
  ChainedStep,
  ConditionPlan,
  RelationshipPlan,
  RootChainPlan,
  StepPlan,
  WhereExpr
} from '@artificer-toolkit/shared/maps'
import {
  evaluateConditionIf,
  isIdRef,
  isRuntimeRecord,
  resolveIdRef,
  type NodeRuntimeScope
} from '@artificer-toolkit/shared/utils'
import type { NodeRuntimeOptionDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { NodeRuntimeInputError } from './mapRegistry.js'
import {
  isNodeRuntimeSourceColumn,
  isNodeRuntimeSourceTable,
  type NodeRuntimeSourceTable
} from './nodeRuntimeSourceManifest.js'

type NodeRuntimeReader = NodeRuntimeSourceReader

const implicitTableOptionColumns: Readonly<Record<string, readonly string[]>> = {
  currencies: ['id', 'code', 'label', 'short', 'description']
}

type RuntimeStream = readonly unknown[]

export async function executeRelationshipPlan(
  db: NodeRuntimeReader,
  plan: RelationshipPlan,
  scope: NodeRuntimeScope
): Promise<RuntimeStream> {
  return executeRelationship(db, plan, scope, [])
}

export function streamToOptions(stream: RuntimeStream): NodeRuntimeOptionDto[] {
  return dedupeByValue(
    stream.map((item) => {
      if (isRuntimeRecord(item)) {
        const value = stringFromFirst(item, ['id', 'code', 'value'])
        const label = stringFromFirst(item, ['label', 'name', 'short', 'code', 'id'])

        return {
          value,
          label,
          description: stringFromOptional(item, ['description'])
        }
      }

      const value = String(item)
      return { value, label: value }
    })
  )
}

async function executeRelationship(
  db: NodeRuntimeReader,
  plan: RelationshipPlan,
  scope: NodeRuntimeScope,
  stream: RuntimeStream
): Promise<RuntimeStream> {
  switch (plan.kind) {
    case 'TABLE': {
      const table = assertTrustedTable(plan.table)
      const where = resolveWhere(plan.where, scope, table)
      const selectedColumns = plan.selectColumns ?? implicitTableOptionColumns[plan.table] ?? ['id']
      const columns = requiredColumns(table, selectedColumns, where)
      return filterRows(await queryTrustedTable(db, table, columns, where, scope.systemId), where)
    }
    case 'MAP_VALUES':
      return executeMapValues(db, plan, scope, stream)
    case 'CHAIN':
      return executeChain(db, plan, scope, stream)
    case 'CONDITION':
      return executeConditionPlan(db, plan, scope, stream)
  }
}

async function executeStep(
  db: NodeRuntimeReader,
  step: StepPlan,
  scope: NodeRuntimeScope,
  stream: RuntimeStream
): Promise<RuntimeStream> {
  switch (step.kind) {
    case 'SEED': {
      const table = assertTrustedTable(step.table)
      const valueColumn = assertTrustedColumn(table, step.valueColumn)
      const where = resolveWhere(step.where, scope, table)
      const columns = requiredColumns(table, [valueColumn], where)
      return filterRows(
        await queryTrustedTable(db, table, columns, where, scope.systemId),
        where
      ).map((row) => row[valueColumn])
    }
    case 'MAP_VALUES':
      return executeMapValues(db, step, scope, stream)
    case 'CHAIN':
      return executeChain(db, step, scope, stream)
    case 'CONDITION':
      return executeConditionPlan(db, step, scope, stream)
  }
}

async function executeChainedStep(
  db: NodeRuntimeReader,
  step: ChainedStep,
  scope: NodeRuntimeScope,
  stream: RuntimeStream
): Promise<RuntimeStream> {
  switch (step.kind) {
    case 'MAP_VALUES':
      return executeMapValues(db, step, scope, stream)
    case 'CHAIN':
      return executeChain(db, step, scope, stream)
    case 'UNION': {
      const branches = await Promise.all(
        step.branches.map((branch) => executeChain(db, branch, scope, stream))
      )
      return dedupeUnknown(branches.flat())
    }
    case 'CONDITION':
      return executeConditionPlan(db, step, scope, stream)
  }
}

async function executeChain(
  db: NodeRuntimeReader,
  plan: RootChainPlan | Extract<ChainedStep, { kind: 'CHAIN' }>,
  scope: NodeRuntimeScope,
  stream: RuntimeStream
): Promise<RuntimeStream> {
  let current = stream

  if (plan.mode === 'ROOT') {
    const [firstStep, ...rest] = plan.steps
    current = await executeStep(db, firstStep, scope, [])

    for (const step of rest) {
      current = await executeChainedStep(db, step, scope, current)
    }

    return current
  }

  for (const step of plan.steps) {
    current = await executeChainedStep(db, step, scope, current)
  }

  return current
}

async function executeConditionPlan<P extends RelationshipPlan | StepPlan | ChainedStep>(
  db: NodeRuntimeReader,
  plan: ConditionPlan<P>,
  scope: NodeRuntimeScope,
  stream: RuntimeStream
): Promise<RuntimeStream> {
  const selected =
    plan.choices.find((choice) => evaluateConditionIf(choice.useIf, scope))?.plan ?? plan.fallback

  if (!selected) return []

  if (isStepPlan(selected)) return executeStep(db, selected, scope, stream)
  if (isChainedStep(selected)) return executeChainedStep(db, selected, scope, stream)

  return executeRelationship(db, selected, scope, stream)
}

async function executeMapValues(
  db: NodeRuntimeReader,
  step: Extract<RelationshipPlan | StepPlan | ChainedStep, { kind: 'MAP_VALUES' }>,
  scope: NodeRuntimeScope,
  stream: RuntimeStream
): Promise<RuntimeStream> {
  const table = assertTrustedTable(step.table)
  const whereColumn = assertTrustedColumn(table, step.whereColumn)
  const valueColumn = assertTrustedColumn(table, step.valueColumn)
  step.selectColumns?.forEach((column) => assertTrustedColumn(table, column))

  const inputValues =
    'input' in step && step.input ? toArray(resolveIdRef(step.input, scope)) : stream
  if (inputValues.length === 0) return []

  const where = andWhere(resolveWhere(step.where, scope, table), {
    kind: 'PREDICATE',
    column: whereColumn,
    op: 'IN',
    values: inputValues
  })
  const selectedColumns = step.selectColumns ?? [valueColumn]
  const columns = requiredColumns(table, [whereColumn, valueColumn, ...selectedColumns], where)
  const rows = filterRows(await queryTrustedTable(db, table, columns, where, scope.systemId), where)

  if (step.selectColumns) {
    const columns = step.selectColumns
    return rows.map((row) => pickColumns(row, columns))
  }

  return rows.map((row) => row[valueColumn])
}

async function queryTrustedTable(
  db: NodeRuntimeReader,
  tableName: string,
  columns: readonly string[],
  where: NodeRuntimeQueryWhere | undefined,
  systemId: string | undefined
): Promise<NodeRuntimeQueryRow[]> {
  const table = assertTrustedTable(tableName)
  columns.forEach((column) => assertTrustedColumn(table, column))
  return db(table, columns, where, systemId)
}

function filterRows(
  rows: readonly NodeRuntimeQueryRow[],
  where: NodeRuntimeQueryWhere | undefined
): NodeRuntimeQueryRow[] {
  if (!where) return [...rows]
  return rows.filter((row) => evaluateWhere(row, where))
}

function evaluateWhere(row: NodeRuntimeQueryRow, where: NodeRuntimeQueryWhere): boolean {
  switch (where.kind) {
    case 'CONSTANT':
      return where.value
    case 'AND':
      return where.expressions.every((expr) => evaluateWhere(row, expr))
    case 'OR':
      return where.expressions.some((expr) => evaluateWhere(row, expr))
    case 'NOT':
      return !evaluateWhere(row, where.expression)
    case 'PREDICATE': {
      const left = row[where.column]

      if (where.op === 'IN') return where.values.includes(left)
      if (where.op === '=') return left === where.value
      if (where.op === '!=') return left !== where.value

      throw new Error(`Unknown node runtime predicate: ${JSON.stringify(where)}`)
    }
    default: {
      const impossibleWhere: never = where
      throw new Error(`Unknown node runtime where kind: ${JSON.stringify(impossibleWhere)}`)
    }
  }
}

function resolveWhere(
  where: WhereExpr | undefined,
  scope: NodeRuntimeScope,
  table: NodeRuntimeSourceTable
): NodeRuntimeQueryWhere | undefined {
  if (!where) return undefined

  switch (where.kind) {
    case 'AND':
      return {
        kind: 'AND',
        expressions: where.expressions.map(
          (expr) => resolveWhere(expr, scope, table) ?? { kind: 'CONSTANT', value: true }
        )
      }
    case 'OR':
      return {
        kind: 'OR',
        expressions: where.expressions.map(
          (expr) => resolveWhere(expr, scope, table) ?? { kind: 'CONSTANT', value: false }
        )
      }
    case 'NOT':
      return {
        kind: 'NOT',
        expression: resolveWhere(where.expression, scope, table) ?? {
          kind: 'CONSTANT',
          value: true
        }
      }
    case 'PREDICATE': {
      const column = assertTrustedColumn(table, where.column)
      if (where.op === 'IN') {
        const values = isIdRef(where.values)
          ? toArray(resolveIdRef(where.values, scope))
          : [...where.values]
        return { kind: 'PREDICATE', column, op: 'IN', values }
      }

      const value = isIdRef(where.value) ? resolveIdRef(where.value, scope) : where.value
      if (value === undefined) return { kind: 'CONSTANT', value: where.op === '!=' }
      return { kind: 'PREDICATE', column, op: where.op, value }
    }
    default: {
      const impossibleWhere: never = where
      throw new Error(`Unknown relationship where kind: ${JSON.stringify(impossibleWhere)}`)
    }
  }
}

function andWhere(
  ...where: readonly (NodeRuntimeQueryWhere | undefined)[]
): NodeRuntimeQueryWhere | undefined {
  const predicates = where.filter(
    (predicate): predicate is NodeRuntimeQueryWhere => predicate !== undefined
  )
  if (predicates.length === 0) return undefined
  if (predicates.length === 1) return predicates[0]
  return { kind: 'AND', expressions: predicates }
}

function requiredColumns(
  table: NodeRuntimeSourceTable,
  selectedColumns: readonly string[],
  where: NodeRuntimeQueryWhere | undefined
): string[] {
  const columns = new Set(selectedColumns.map((column) => assertTrustedColumn(table, column)))
  collectWhereColumns(table, where, columns)
  return [...columns]
}

function collectWhereColumns(
  table: NodeRuntimeSourceTable,
  where: NodeRuntimeQueryWhere | undefined,
  columns: Set<string>
): void {
  if (!where) return

  switch (where.kind) {
    case 'CONSTANT':
      return
    case 'AND':
    case 'OR':
      where.expressions.forEach((expr) => collectWhereColumns(table, expr, columns))
      return
    case 'NOT':
      collectWhereColumns(table, where.expression, columns)
      return
    case 'PREDICATE':
      columns.add(assertTrustedColumn(table, where.column))
      return
    default: {
      const impossibleWhere: never = where
      throw new Error(`Unknown node runtime where kind: ${JSON.stringify(impossibleWhere)}`)
    }
  }
}

function isStepPlan(value: RelationshipPlan | StepPlan | ChainedStep): value is StepPlan {
  return (
    value.kind === 'SEED' ||
    value.kind === 'MAP_VALUES' ||
    value.kind === 'CHAIN' ||
    value.kind === 'CONDITION'
  )
}

function isChainedStep(value: RelationshipPlan | StepPlan | ChainedStep): value is ChainedStep {
  return (
    value.kind === 'MAP_VALUES' ||
    value.kind === 'CHAIN' ||
    value.kind === 'UNION' ||
    value.kind === 'CONDITION'
  )
}

function assertTrustedTable(tableName: string): NodeRuntimeSourceTable {
  if (!isNodeRuntimeSourceTable(tableName)) {
    throw new NodeRuntimeInputError(`Untrusted node runtime table: ${tableName}`)
  }

  return tableName
}

function assertTrustedColumn(table: NodeRuntimeSourceTable, columnName: string): string {
  if (!isNodeRuntimeSourceColumn(table, columnName)) {
    throw new NodeRuntimeInputError(`Untrusted node runtime column for ${table}: ${columnName}`)
  }

  return columnName
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return value == null ? [] : [value]
}

function pickColumns(row: NodeRuntimeQueryRow, columns: readonly string[]): NodeRuntimeQueryRow {
  return columns.reduce<NodeRuntimeQueryRow>((picked, column) => {
    picked[column] = row[column]
    return picked
  }, {})
}

function stringFromFirst(row: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.length > 0) return value
    if (typeof value === 'number') return String(value)
  }

  return ''
}

function stringFromOptional(
  row: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.length > 0) return value
  }

  return undefined
}

function dedupeByValue(options: readonly NodeRuntimeOptionDto[]): NodeRuntimeOptionDto[] {
  const seen = new Set<string>()
  return options.filter((option) => {
    if (seen.has(option.value)) return false
    seen.add(option.value)
    return true
  })
}

function dedupeUnknown(values: readonly unknown[]): unknown[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = stableKey(value)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function stableKey(value: unknown): string {
  if (isRuntimeRecord(value)) {
    return JSON.stringify(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    )
  }

  return String(value)
}
