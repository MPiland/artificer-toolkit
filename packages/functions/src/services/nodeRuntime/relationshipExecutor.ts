import type { DBLike, NodeRuntimeQueryRow } from '@artificer-toolkit/db'
import { selectNodeRuntimeRows } from '@artificer-toolkit/db'
import type {
  ChainedStep,
  ConditionPlan,
  RelationshipPlan,
  RootChainPlan,
  StepPlan,
  WhereExpr
} from '@artificer-toolkit/shared'
import {
  evaluateConditionIf,
  isIdRef,
  isRuntimeRecord,
  resolveIdRef,
  type NodeRuntimeScope
} from '@artificer-toolkit/shared'
import type { NodeRuntimeOptionDto } from '@artificer-toolkit/schema'
import { NodeRuntimeInputError } from './mapRegistry.js'

const trustedTables = new Set([
  'background_features',
  'background_proficiency_grants',
  'characteristic_durations',
  'characteristic_ranges',
  'charge_limits',
  'charges',
  'class_features',
  'class_proficiency_grants',
  'class_resources',
  'class_spellcasting',
  'classes',
  'conditions',
  'currencies',
  'damages',
  'effect_invocations',
  'effect_path_choice_options',
  'effect_path_roll_table_rows',
  'effect_paths',
  'effect_result_block_outcomes',
  'effect_result_blocks',
  'equipment',
  'equipment_effects',
  'equipment_features',
  'equipment_properties',
  'feat_effects',
  'feat_features',
  'feat_proficiency_grants',
  'feats',
  'feature_effects',
  'feature_options',
  'feature_proficiency_grants',
  'features',
  'languages',
  'magic_schools',
  'option_effects',
  'option_proficiency_grants',
  'options',
  'proficiency_grant_equipment',
  'proficiency_grant_equipment_properties',
  'proficiency_grant_languages',
  'proficiency_grant_save_abilities',
  'race_ancestries',
  'race_ancestry_option_features',
  'race_ancestry_options',
  'race_features',
  'races',
  'rarities',
  'skills',
  'spell_effects'
])

const trustedColumns = new Set([
  'ability_code',
  'ancestry_id',
  'ancestry_option_id',
  'background_id',
  'category',
  'characteristic_id',
  'charge_id',
  'class_id',
  'code',
  'condition_type_id',
  'damage_type_id',
  'description',
  'duration_id',
  'effect_id',
  'equipment_id',
  'feat_id',
  'feature_id',
  'id',
  'kind',
  'label',
  'language_id',
  'limit_kind',
  'magic_school_id',
  'option_id',
  'outcome_id',
  'parent_class_id',
  'parent_race_id',
  'path_id',
  'proficiency_grant_id',
  'property_code',
  'race_id',
  'range_characteristic_id',
  'reset_kind',
  'result_block_id',
  'short',
  'spell_id',
  'system_id',
  'tooltip'
])

type RuntimeStream = readonly unknown[]

export async function executeRelationshipPlan(
  db: DBLike,
  plan: RelationshipPlan,
  scope: NodeRuntimeScope
): Promise<RuntimeStream> {
  return executeRelationship(db, plan, scope, [])
}

export function streamToOptions(stream: RuntimeStream): NodeRuntimeOptionDto[] {
  return dedupeByValue(stream.map((item) => {
    if (isRuntimeRecord(item)) {
      const value = stringFromFirst(item, ['id', 'code', 'value'])
      const label = stringFromFirst(item, ['label', 'name', 'short', 'code', 'id'])

      return {
        value,
        label,
        description: stringFromOptional(item, ['tooltip', 'description'])
      }
    }

    const value = String(item)
    return { value, label: value }
  }))
}

async function executeRelationship(
  db: DBLike,
  plan: RelationshipPlan,
  scope: NodeRuntimeScope,
  stream: RuntimeStream
): Promise<RuntimeStream> {
  switch (plan.kind) {
    case 'TABLE':
      return filterRows(await queryTrustedTable(db, plan.table), plan.where, scope)
    case 'MAP_VALUES':
      return executeMapValues(db, plan, scope, stream)
    case 'CHAIN':
      return executeChain(db, plan, scope, stream)
    case 'CONDITION':
      return executeConditionPlan(db, plan, scope, stream)
  }
}

async function executeStep(
  db: DBLike,
  step: StepPlan,
  scope: NodeRuntimeScope,
  stream: RuntimeStream
): Promise<RuntimeStream> {
  switch (step.kind) {
    case 'SEED':
      return filterRows(await queryTrustedTable(db, step.table), step.where, scope)
        .map((row) => row[assertTrustedColumn(step.valueColumn)])
    case 'MAP_VALUES':
      return executeMapValues(db, step, scope, stream)
    case 'CHAIN':
      return executeChain(db, step, scope, stream)
    case 'CONDITION':
      return executeConditionPlan(db, step, scope, stream)
  }
}

async function executeChainedStep(
  db: DBLike,
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
  db: DBLike,
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
  db: DBLike,
  plan: ConditionPlan<P>,
  scope: NodeRuntimeScope,
  stream: RuntimeStream
): Promise<RuntimeStream> {
  const selected = plan.choices.find((choice) => evaluateConditionIf(choice.useIf, scope))?.plan
    ?? plan.fallback

  if (!selected) return []

  if (isStepPlan(selected)) return executeStep(db, selected, scope, stream)
  if (isChainedStep(selected)) return executeChainedStep(db, selected, scope, stream)

  return executeRelationship(db, selected, scope, stream)
}

async function executeMapValues(
  db: DBLike,
  step: Extract<RelationshipPlan | StepPlan | ChainedStep, { kind: 'MAP_VALUES' }>,
  scope: NodeRuntimeScope,
  stream: RuntimeStream
): Promise<RuntimeStream> {
  const table = assertTrustedTable(step.table)
  const whereColumn = assertTrustedColumn(step.whereColumn)
  const valueColumn = assertTrustedColumn(step.valueColumn)
  step.selectColumns?.forEach(assertTrustedColumn)

  const inputValues = 'input' in step && step.input ? toArray(resolveIdRef(step.input, scope)) : stream
  if (inputValues.length === 0) return []

  const rows = filterRows(await queryTrustedTable(db, table), step.where, scope)
    .filter((row) => inputValues.includes(row[whereColumn]))

  if (step.selectColumns) {
    const columns = step.selectColumns
    return rows.map((row) => pickColumns(row, columns))
  }

  return rows.map((row) => row[valueColumn])
}

async function queryTrustedTable(db: DBLike, tableName: string): Promise<NodeRuntimeQueryRow[]> {
  const table = assertTrustedTable(tableName)
  return selectNodeRuntimeRows(db, table, [])
}

function filterRows(
  rows: readonly NodeRuntimeQueryRow[],
  where: WhereExpr | undefined,
  scope: NodeRuntimeScope
): NodeRuntimeQueryRow[] {
  if (!where) return [...rows]
  return rows.filter((row) => evaluateWhere(row, where, scope))
}

function evaluateWhere(row: NodeRuntimeQueryRow, where: WhereExpr, scope: NodeRuntimeScope): boolean {
  if ('and' in where) return where.and.every((expr) => evaluateWhere(row, expr, scope))
  if ('or' in where) return where.or.some((expr) => evaluateWhere(row, expr, scope))
  if ('not' in where) return !evaluateWhere(row, where.not, scope)

  const column = assertTrustedColumn(where.column)
  const left = row[column]

  if (where.op !== 'IN') {
    return where.op === '='
      ? left === resolveWhereValue(where.value, scope)
      : left !== resolveWhereValue(where.value, scope)
  }

  const values = isIdRef(where.values)
    ? toArray(resolveIdRef(where.values, scope))
    : [...where.values]
  return values.includes(left)
}

function resolveWhereValue(value: unknown, scope: NodeRuntimeScope): unknown {
  return isIdRef(value) ? resolveIdRef(value, scope) : value
}

function isStepPlan(value: RelationshipPlan | StepPlan | ChainedStep): value is StepPlan {
  return value.kind === 'SEED'
    || value.kind === 'MAP_VALUES'
    || value.kind === 'CHAIN'
    || value.kind === 'CONDITION'
}

function isChainedStep(value: RelationshipPlan | StepPlan | ChainedStep): value is ChainedStep {
  return value.kind === 'MAP_VALUES'
    || value.kind === 'CHAIN'
    || value.kind === 'UNION'
    || value.kind === 'CONDITION'
}

function assertTrustedTable(tableName: string): string {
  if (!trustedTables.has(tableName)) {
    throw new NodeRuntimeInputError(`Untrusted node runtime table: ${tableName}`)
  }

  return tableName
}

function assertTrustedColumn(columnName: string): string {
  if (!trustedColumns.has(columnName)) {
    throw new NodeRuntimeInputError(`Untrusted node runtime column: ${columnName}`)
  }

  return columnName
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return value == null ? [] : [value]
}

function pickColumns(
  row: NodeRuntimeQueryRow,
  columns: readonly string[]
): NodeRuntimeQueryRow {
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

function stringFromOptional(row: Record<string, unknown>, keys: readonly string[]): string | undefined {
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
    return JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
  }

  return String(value)
}
