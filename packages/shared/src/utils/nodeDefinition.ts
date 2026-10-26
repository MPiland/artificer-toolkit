import { type CoreMeta } from '#core'
import type { AllUnionFields } from 'type-fest'
import {
  ARRAY_GROUP_PRESENTATION,
  OBJECT_GROUP_PRESENTATION,
  assertUniqueActionTypes,
  resolveInputAuthoringMeta,
  type ArrayGroupPresentation,
  type GroupPresentation,
  type NodeArrayAuthoringMeta,
  type NodeAuthoringMeta,
  type NodeMapAuthoringMeta,
  type NodeObjectAuthoringMeta,
  type ObjectGroupPresentation
} from './authoringSchema.js'
import { valuesOf } from './valuesOf.js'
import { AUTHORED_LIMITS, type AuthoringInputConstraints } from './authoringLimits.js'

type TableName = string
type ColumnOf<_K extends TableName> = string
type ColumnValueOf<_K extends TableName, _C extends ColumnOf<_K>> = unknown

/* ──────────────────────────────────────────────────────────────
 * Normalization (run once per map)
 * ────────────────────────────────────────────────────────────── */
/** Strict surface used only to decide which keys/paths are legal. */
export type NormalizeForAccess<T extends object> = Extract<AllUnionFields<T>, object>
export type EmptyObject = Record<never, never>

/** Strict key set (string keys only). */
type NKey<T extends object> = Extract<keyof NormalizeForAccess<T>, string>

/* ──────────────────────────────────────────────────────────────
 * Shared: Path model (shallow)
 * ────────────────────────────────────────────────────────────── */

export type ShallowPath = readonly [string] | readonly [string, number]

type IsArrayLike<T> = T extends readonly unknown[] ? true : T extends unknown[] ? true : false
type IsObjectLike<T> = T extends object ? (T extends readonly unknown[] ? false : true) : false

// INPUT paths: ['key'] or ['key', number] when key is array-like on the normalized surface
type InputPathFor<T extends object> = {
  [K in NKey<T>]:
    | readonly [K]
    | (IsArrayLike<NonNullable<NormalizeForAccess<T>[K]>> extends true
        ? readonly [K, number]
        : never)
}[NKey<T>]

type DirectInputPathFor<T extends object, TValue> = {
  [K in NKey<T>]: Extract<NonNullable<NormalizeForAccess<T>[K]>, TValue> extends never
    ? never
    : readonly [K]
}[NKey<T>]

type ArrayElementInputPathFor<T extends object, TValue> = {
  [K in NKey<T>]: NonNullable<NormalizeForAccess<T>[K]> extends readonly (infer TItem)[]
    ? Extract<NonNullable<TItem>, TValue> extends never
      ? never
      : readonly [K, number]
    : never
}[NKey<T>]

type ScalarInputPathFor<T extends object, TValue> =
  | DirectInputPathFor<T, TValue>
  | ArrayElementInputPathFor<T, TValue>

type MultiSelectInputPathFor<T extends object> = {
  [K in NKey<T>]: Extract<NonNullable<NormalizeForAccess<T>[K]>, readonly string[]> extends never
    ? never
    : readonly [K]
}[NKey<T>]

// GROUP keys: any normalized key whose value is object-like OR array-like
type ObjectGroupKey<T extends object> = {
  [K in NKey<T>]: IsObjectLike<NonNullable<NormalizeForAccess<T>[K]>> extends true ? K : never
}[NKey<T>]

type ArrayGroupKey<T extends object> = {
  [K in NKey<T>]: IsArrayLike<NonNullable<NormalizeForAccess<T>[K]>> extends true ? K : never
}[NKey<T>]

type GroupKey<T extends object> = ObjectGroupKey<T> | ArrayGroupKey<T>

// Child type for group: element type for arrays, value type for objects (both from normalized surface)
type ChildForGroupKey<T extends object, K extends GroupKey<T>> =
  NonNullable<NormalizeForAccess<T>[K]> extends readonly (infer U)[]
    ? Extract<U, object>
    : Extract<NonNullable<NormalizeForAccess<T>[K]>, object>

/* ──────────────────────────────────────────────────────────────
 * Node kinds + identity
 * ────────────────────────────────────────────────────────────── */

export const NODE_KIND = {
  INPUT: 'INPUT',
  GROUP: 'GROUP'
} as const

export type NodeId = string
type Lazy<T> = T | (() => T)

/* ──────────────────────────────────────────────────────────────
 * Minimal schema meta
 * ────────────────────────────────────────────────────────────── */

export const HIDDEN_BEHAVIOR = {
  KEEP: 'KEEP',
  CLEAR: 'CLEAR'
} as const

export type HiddenBehavior = (typeof HIDDEN_BEHAVIOR)[keyof typeof HIDDEN_BEHAVIOR]

/* ──────────────────────────────────────────────────────────────
 * Logic AST
 * ────────────────────────────────────────────────────────────── */

export type Logic = {
  and<E>(expressions: readonly E[]): { kind: 'AND'; expressions: readonly E[] }
  or<E>(expressions: readonly E[]): { kind: 'OR'; expressions: readonly E[] }
  not<E>(expression: E): { kind: 'NOT'; expression: E }
}

function createLogic(): Logic {
  return {
    and: (expressions) => ({ kind: 'AND', expressions }),
    or: (expressions) => ({ kind: 'OR', expressions }),
    not: (expression) => ({ kind: 'NOT', expression })
  }
}

/* ──────────────────────────────────────────────────────────────
 * ID Refs (serializable, shallow)
 * ────────────────────────────────────────────────────────────── */

type InputRefSupported = string | readonly string[] | string[] | undefined

type IdPathFor<T extends object> = {
  [K in NKey<T>]: NonNullable<NormalizeForAccess<T>[K]> extends InputRefSupported
    ? readonly [K]
    : never
}[NKey<T>]

export type IdRef =
  | { from: 'LOCAL'; path: ShallowPath }
  | { from: 'PARENT'; path: ShallowPath }
  | { from: 'ANCESTOR'; up: number; path: ShallowPath }

/* ──────────────────────────────────────────────────────────────
 * ConditionIf AST (serializable, shallow)
 * ────────────────────────────────────────────────────────────── */

type CmpOp = '=' | '>' | '<' | '>=' | '<='

type ConditionIfSupported =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly string[]
  | readonly number[]
  | readonly boolean[]
  | string[]
  | number[]
  | boolean[]

export type CondPathFor<T extends object> = T extends unknown
  ? {
      [K in NKey<T>]:
        | (NonNullable<NormalizeForAccess<T>[K]> extends ConditionIfSupported
            ? readonly [K]
            : never)
        | (IsArrayLike<NonNullable<NormalizeForAccess<T>[K]>> extends true
            ? readonly [K, number]
            : never)
    }[NKey<T>]
  : never

type ValueAtPath<T extends object, P extends ShallowPath> = T extends unknown
  ? P extends readonly [infer K]
    ? K extends NKey<T>
      ? NormalizeForAccess<T>[K]
      : never
    : P extends readonly [infer K, number]
      ? K extends NKey<T>
        ? NonNullable<NormalizeForAccess<T>[K]> extends readonly (infer U)[]
          ? U
          : never
        : never
      : never
  : never

type ContainsArg<V> = V extends string
  ? string
  : V extends readonly (infer U)[]
    ? U
    : V extends (infer U)[]
      ? U
      : never

export type ConditionIfLeaf =
  | { kind: 'PREDICATE'; from: 'LOCAL'; path: ShallowPath; op: CmpOp; value: unknown }
  | {
      kind: 'PREDICATE'
      from: 'LOCAL'
      path: ShallowPath
      op: 'contains'
      value: readonly unknown[]
    }
  | { kind: 'PREDICATE'; from: 'LOCAL'; path: ShallowPath; op: 'empty' }
  | {
      kind: 'PREDICATE'
      from: 'LOCAL'
      path: ShallowPath
      op: 'onlyValues'
      value: readonly unknown[]
    }
  | { kind: 'PREDICATE'; from: 'PARENT'; path: ShallowPath; op: CmpOp; value: unknown }
  | {
      kind: 'PREDICATE'
      from: 'PARENT'
      path: ShallowPath
      op: 'contains'
      value: readonly unknown[]
    }
  | { kind: 'PREDICATE'; from: 'PARENT'; path: ShallowPath; op: 'empty' }
  | {
      kind: 'PREDICATE'
      from: 'PARENT'
      path: ShallowPath
      op: 'onlyValues'
      value: readonly unknown[]
    }
  | {
      kind: 'PREDICATE'
      from: 'ANCESTOR'
      up: number
      path: ShallowPath
      op: CmpOp
      value: unknown
    }
  | {
      kind: 'PREDICATE'
      from: 'ANCESTOR'
      up: number
      path: ShallowPath
      op: 'contains'
      value: readonly unknown[]
    }
  | { kind: 'PREDICATE'; from: 'ANCESTOR'; up: number; path: ShallowPath; op: 'empty' }
  | {
      kind: 'PREDICATE'
      from: 'ANCESTOR'
      up: number
      path: ShallowPath
      op: 'onlyValues'
      value: readonly unknown[]
    }

export type ConditionIfExpr =
  | ConditionIfLeaf
  | { kind: 'AND'; expressions: readonly ConditionIfExpr[] }
  | { kind: 'OR'; expressions: readonly ConditionIfExpr[] }
  | { kind: 'NOT'; expression: ConditionIfExpr }

type FieldHandle<TScope extends object, P extends ShallowPath> = {
  eq(value: ValueAtPath<TScope, P>): ConditionIfExpr
  gt(value: ValueAtPath<TScope, P>): ConditionIfExpr
  gte(value: ValueAtPath<TScope, P>): ConditionIfExpr
  lt(value: ValueAtPath<TScope, P>): ConditionIfExpr
  lte(value: ValueAtPath<TScope, P>): ConditionIfExpr
  contains(value: readonly ContainsArg<ValueAtPath<TScope, P>>[]): ConditionIfExpr
  empty(): ConditionIfExpr
  onlyValues(value: readonly ContainsArg<ValueAtPath<TScope, P>>[]): ConditionIfExpr
}

type HasAuthoringMode = { authoringModeKind?: 'ALL' | 'SELECTED' }

export type ScopeFlags = {
  selected: ConditionIfExpr
  all: ConditionIfExpr
  allOrMissing: ConditionIfExpr
}

type BaseFrameBinder<TScope extends object> = {
  field<P extends CondPathFor<TScope>>(path: P): FieldHandle<TScope, Extract<P, ShallowPath>>
  id<P extends IdPathFor<TScope>>(path: P): IdRef
}

type ScopeFrameBinder<TScope extends object> = TScope extends HasAuthoringMode
  ? {
      scope<P extends CondPathFor<TScope>>(path: P): ScopeFlags
    }
  : EmptyObject

type FrameBinder<TScope extends object> = BaseFrameBinder<TScope> & ScopeFrameBinder<TScope>

export type ConditionIfBuilder<NLocal extends object> = {
  local(): FrameBinder<NLocal>
  parent<TScope extends object>(): FrameBinder<TScope>
  ancestor<TScope extends object>(up: number): FrameBinder<TScope>
}

function createConditionIfBuilder<NLocal extends object>(): ConditionIfBuilder<NLocal> {
  const logic = createLogic()

  const handle = <TScope extends object, P extends ShallowPath>(
    from: 'LOCAL' | 'PARENT' | 'ANCESTOR',
    path: P,
    up?: number
  ): FieldHandle<TScope, P> => ({
    eq: (value) =>
      up === undefined
        ? ({ kind: 'PREDICATE', from, path, op: '=', value } as ConditionIfLeaf)
        : ({ kind: 'PREDICATE', from, up, path, op: '=', value } as ConditionIfLeaf),
    gt: (value) =>
      up === undefined
        ? ({ kind: 'PREDICATE', from, path, op: '>', value } as ConditionIfLeaf)
        : ({ kind: 'PREDICATE', from, up, path, op: '>', value } as ConditionIfLeaf),
    gte: (value) =>
      up === undefined
        ? ({ kind: 'PREDICATE', from, path, op: '>=', value } as ConditionIfLeaf)
        : ({ kind: 'PREDICATE', from, up, path, op: '>=', value } as ConditionIfLeaf),
    lt: (value) =>
      up === undefined
        ? ({ kind: 'PREDICATE', from, path, op: '<', value } as ConditionIfLeaf)
        : ({ kind: 'PREDICATE', from, up, path, op: '<', value } as ConditionIfLeaf),
    lte: (value) =>
      up === undefined
        ? ({ kind: 'PREDICATE', from, path, op: '<=', value } as ConditionIfLeaf)
        : ({ kind: 'PREDICATE', from, up, path, op: '<=', value } as ConditionIfLeaf),
    contains: (value) =>
      up === undefined
        ? ({ kind: 'PREDICATE', from, path, op: 'contains', value } as ConditionIfLeaf)
        : ({ kind: 'PREDICATE', from, up, path, op: 'contains', value } as ConditionIfLeaf),
    empty: () =>
      up === undefined
        ? ({ kind: 'PREDICATE', from, path, op: 'empty' } as ConditionIfLeaf)
        : ({ kind: 'PREDICATE', from, up, path, op: 'empty' } as ConditionIfLeaf),
    onlyValues: (value) =>
      up === undefined
        ? ({ kind: 'PREDICATE', from, path, op: 'onlyValues', value } as ConditionIfLeaf)
        : ({ kind: 'PREDICATE', from, up, path, op: 'onlyValues', value } as ConditionIfLeaf)
  })

  const MODE_SELECTED: HasAuthoringMode['authoringModeKind'] = 'SELECTED'
  const MODE_ALL: HasAuthoringMode['authoringModeKind'] = 'ALL'

  const mkScope = (
    from: 'LOCAL' | 'PARENT' | 'ANCESTOR',
    path: ShallowPath,
    up?: number
  ): ScopeFlags => {
    const f =
      from === 'LOCAL'
        ? handle<object, ShallowPath>('LOCAL', path)
        : from === 'PARENT'
          ? handle<object, ShallowPath>('PARENT', path)
          : handle<object, ShallowPath>('ANCESTOR', path, up)

    const modeSelected: ConditionIfLeaf =
      from === 'ANCESTOR'
        ? {
            kind: 'PREDICATE',
            from,
            up: up!,
            path: ['authoringModeKind'],
            op: '=',
            value: MODE_SELECTED
          }
        : {
            kind: 'PREDICATE',
            from,
            path: ['authoringModeKind'],
            op: '=',
            value: MODE_SELECTED
          }

    const modeAll: ConditionIfLeaf =
      from === 'ANCESTOR'
        ? {
            kind: 'PREDICATE',
            from,
            up: up!,
            path: ['authoringModeKind'],
            op: '=',
            value: MODE_ALL
          }
        : {
            kind: 'PREDICATE',
            from,
            path: ['authoringModeKind'],
            op: '=',
            value: MODE_ALL
          }

    const modeEmpty =
      from === 'LOCAL'
        ? handle('LOCAL', ['authoringModeKind'] as const).empty()
        : from === 'PARENT'
          ? handle('PARENT', ['authoringModeKind'] as const).empty()
          : handle('ANCESTOR', ['authoringModeKind'] as const, up).empty()

    return {
      selected: logic.and([modeSelected, logic.not(f.empty())]),
      all: modeAll,
      allOrMissing: logic.or([modeAll, modeEmpty])
    }
  }

  // `scope` exists on every binder at run time; FrameBinder exposes it only for scopes that carry an
  // authoring mode, a conditional type the overload states and the implementation cannot narrow to.
  function makeFrameBinder<TScope extends object>(
    from: 'LOCAL' | 'PARENT' | 'ANCESTOR',
    up?: number
  ): FrameBinder<TScope>
  function makeFrameBinder(
    from: 'LOCAL' | 'PARENT' | 'ANCESTOR',
    up?: number
  ): BaseFrameBinder<HasAuthoringMode> & ScopeFrameBinder<HasAuthoringMode> {
    return {
      field: (path) => handle(from, path, up),
      id: (path) =>
        from === 'LOCAL'
          ? { from: 'LOCAL', path }
          : from === 'PARENT'
            ? { from: 'PARENT', path }
            : { from: 'ANCESTOR', up: up!, path },
      scope: (path) => mkScope(from, path, up)
    }
  }

  return {
    local: () => makeFrameBinder<NLocal>('LOCAL'),
    parent: <TScope extends object>() => makeFrameBinder<TScope>('PARENT'),
    ancestor: <TScope extends object>(up: number) => makeFrameBinder<TScope>('ANCESTOR', up)
  }
}

/* ──────────────────────────────────────────────────────────────
 * WHERE AST (serializable)
 * ────────────────────────────────────────────────────────────── */

export type WhereLeaf =
  | { kind: 'PREDICATE'; column: string; op: '=' | '!='; value: unknown }
  | { kind: 'PREDICATE'; column: string; op: 'IN'; values: readonly unknown[] | IdRef }

export type WhereExpr =
  | WhereLeaf
  | { kind: 'AND'; expressions: readonly WhereExpr[] }
  | { kind: 'OR'; expressions: readonly WhereExpr[] }
  | { kind: 'NOT'; expression: WhereExpr }

type ColFn<K extends TableName> = <C extends ColumnOf<K>>(
  column: C
) => {
  eq(value: ColumnValueOf<K, C>): WhereExpr
  neq(value: ColumnValueOf<K, C>): WhereExpr
  in(values: readonly ColumnValueOf<K, C>[] | IdRef): WhereExpr
}

function createColFn<K extends TableName>(): ColFn<K> {
  return (column) => ({
    eq: (value) => ({ kind: 'PREDICATE', column: String(column), op: '=', value }),
    neq: (value) => ({ kind: 'PREDICATE', column: String(column), op: '!=', value }),
    in: (values) => ({ kind: 'PREDICATE', column: String(column), op: 'IN', values })
  })
}

/* ──────────────────────────────────────────────────────────────
 * Relationship AST
 * ────────────────────────────────────────────────────────────── */

type SelectColumns = readonly [string, ...string[]]

export type TablePlan = {
  kind: 'TABLE'
  table: TableName
  selectColumns?: SelectColumns
  where?: WhereExpr
}

export type SeedTableStep = {
  kind: 'SEED'
  table: TableName
  valueColumn: string
  where?: WhereExpr
}

export type MapValuesStep = {
  kind: 'MAP_VALUES'
  table: TableName
  whereColumn: string
  valueColumn: string
  selectColumns?: SelectColumns
  where?: WhereExpr
  input?: IdRef
}

export type NextMapValuesStep = Omit<MapValuesStep, 'input'>

export type ConditionChoice<P> = {
  useIf: ConditionIfExpr
  plan: P
}

export interface ConditionPlan<P> {
  kind: 'CONDITION'
  choices: readonly ConditionChoice<P>[]
  fallback?: P
}

/**
 * Root chains establish their own initial value stream.
 */
export interface RootChainPlan {
  kind: 'CHAIN'
  mode: 'ROOT'
  steps: readonly [StepPlan, ...ChainedStep[]]
}

/**
 * Continuation chains inherit the current value stream and continue transforming it.
 */
export interface ContinueChainPlan {
  kind: 'CHAIN'
  mode: 'CONTINUE'
  steps: readonly [ChainedStep, ...ChainedStep[]]
}

/**
 * Union runs each branch against the same current value stream, merges outputs,
 * and forwards the merged result to the next chained step.
 */
export interface UnionPlan {
  kind: 'UNION'
  branches: readonly [ContinueChainPlan, ...ContinueChainPlan[]]
}

export type ChainPlan = RootChainPlan | ContinueChainPlan

export type ChainedStep =
  | NextMapValuesStep
  | ContinueChainPlan
  | UnionPlan
  | ConditionPlan<ChainedStep>

export type StepPlan = SeedTableStep | MapValuesStep | RootChainPlan | ConditionPlan<StepPlan>

export type RelationshipPlan =
  | TablePlan
  | MapValuesStep
  | RootChainPlan
  | ConditionPlan<RelationshipPlan>

/* ──────────────────────────────────────────────────────────────
 * DataBuilder
 * ────────────────────────────────────────────────────────────── */

type TableSpec<K extends TableName> = {
  selectColumns?: readonly [ColumnOf<K>, ...ColumnOf<K>[]]
  where?: (col: ColFn<K>, logic: Logic) => WhereExpr
}

type SeedSpec<K extends TableName> = {
  valueColumn: ColumnOf<K>
  where?: (col: ColFn<K>, logic: Logic) => WhereExpr
}

type MapValuesSpec<K extends TableName> = {
  whereColumn: ColumnOf<K>
  valueColumn: ColumnOf<K>
  selectColumns?: readonly [ColumnOf<K>, ...ColumnOf<K>[]]
  input?: IdRef
  where?: (col: ColFn<K>, logic: Logic) => WhereExpr
}

/* ──────────────────────────────────────────────────────────────
 * Shared helpers
 * ────────────────────────────────────────────────────────────── */

type OutcomeResolver<P, O> = (o: O) => P

function isOutcomeResolver<P, O>(value: P | OutcomeResolver<P, O>): value is OutcomeResolver<P, O> {
  return typeof value === 'function'
}

const mkCondition = <P>(
  choices: readonly ConditionChoice<P>[],
  fallback?: P
): ConditionPlan<P> => ({
  kind: 'CONDITION',
  choices,
  fallback
})

const toSelectColumns = <K extends TableName>(
  columns?: readonly [ColumnOf<K>, ...ColumnOf<K>[]]
): SelectColumns | undefined => {
  if (!columns) return undefined
  const [first, ...rest] = columns
  return [String(first), ...rest.map(String)]
}

/* ──────────────────────────────────────────────────────────────
 * Condition DSL
 * ────────────────────────────────────────────────────────────── */

interface OutcomeBuilder<P, TSelf> {
  condition(build: (c: CondBuilder<P, TSelf>) => ConditionPlan<P>): P
}

type CondIf<P, O> = {
  then(plan: P): CondChain<P, O>
  then(build: OutcomeResolver<P, O>): CondChain<P, O>
}

type CondChain<P, O> = {
  elseIf(useIf: ConditionIfExpr): CondIf<P, O>
  else(plan: P): CondChain<P, O>
  else(build: OutcomeResolver<P, O>): CondChain<P, O>
  end(): ConditionPlan<P>
}

type CondBuilder<P, O> = {
  if(useIf: ConditionIfExpr): CondIf<P, O>
}

function createCondBuilder<P, O>(outcomeFactory: () => O): CondBuilder<P, O> {
  const makeBuilder = (): CondBuilder<P, O> => {
    const choices: ConditionChoice<P>[] = []
    let fallback: P | undefined

    const resolvePlan = (arg: P | OutcomeResolver<P, O>): P =>
      isOutcomeResolver<P, O>(arg) ? arg(outcomeFactory()) : arg

    function makeIf(useIf: ConditionIfExpr): CondIf<P, O> {
      function then(plan: P): CondChain<P, O>
      function then(build: OutcomeResolver<P, O>): CondChain<P, O>
      function then(arg: P | OutcomeResolver<P, O>): CondChain<P, O> {
        choices.push({ useIf, plan: resolvePlan(arg) })
        return chain
      }

      return { then }
    }

    function elsePlan(plan: P): CondChain<P, O>
    function elsePlan(build: OutcomeResolver<P, O>): CondChain<P, O>
    function elsePlan(arg: P | OutcomeResolver<P, O>): CondChain<P, O> {
      fallback = resolvePlan(arg)
      return chain
    }

    const chain: CondChain<P, O> = {
      elseIf: makeIf,
      else: elsePlan,
      end: () => mkCondition(choices, fallback)
    }

    return {
      if: makeIf
    }
  }

  return makeBuilder()
}

/* ──────────────────────────────────────────────────────────────
 * Union DSL
 * ────────────────────────────────────────────────────────────── */

type UnionBuilder = {
  branch(build: (s: ContinueChainStartBuilder) => ContinueChainPlan): UnionBuilder

  end(): UnionPlan
}

/* ──────────────────────────────────────────────────────────────
 * Chain DSL
 * ────────────────────────────────────────────────────────────── */

type RootChainContinueBuilder = {
  mapValues<K extends TableName>(
    table: K,
    spec: Omit<MapValuesSpec<K>, 'input'>
  ): RootChainContinueBuilder

  condition(
    build: (c: CondBuilder<ChainedStep, ChainedOutcomeBuilder>) => ConditionPlan<ChainedStep>
  ): RootChainContinueBuilder

  chain(build: (s: ContinueChainStartBuilder) => ContinueChainPlan): RootChainContinueBuilder

  union(build: (u: UnionBuilder) => UnionPlan): RootChainContinueBuilder

  end(): RootChainPlan
}

type RootChainStartBuilder = {
  seed<K extends TableName>(table: K, spec: SeedSpec<K>): RootChainContinueBuilder

  input<K extends TableName>(
    table: K,
    spec: MapValuesSpec<K> & { input: IdRef }
  ): RootChainContinueBuilder

  condition(
    build: (c: CondBuilder<StepPlan, StepOutcomeBuilder>) => ConditionPlan<StepPlan>
  ): RootChainContinueBuilder

  chain(build: (s: RootChainStartBuilder) => RootChainPlan): RootChainContinueBuilder
}

type ContinueChainContinueBuilder = {
  mapValues<K extends TableName>(
    table: K,
    spec: Omit<MapValuesSpec<K>, 'input'>
  ): ContinueChainContinueBuilder

  condition(
    build: (c: CondBuilder<ChainedStep, ChainedOutcomeBuilder>) => ConditionPlan<ChainedStep>
  ): ContinueChainContinueBuilder

  chain(build: (s: ContinueChainStartBuilder) => ContinueChainPlan): ContinueChainContinueBuilder

  union(build: (u: UnionBuilder) => UnionPlan): ContinueChainContinueBuilder

  end(): ContinueChainPlan
}

type ContinueChainStartBuilder = {
  mapValues<K extends TableName>(
    table: K,
    spec: Omit<MapValuesSpec<K>, 'input'>
  ): ContinueChainContinueBuilder

  condition(
    build: (c: CondBuilder<ChainedStep, ChainedOutcomeBuilder>) => ConditionPlan<ChainedStep>
  ): ContinueChainContinueBuilder

  chain(build: (s: ContinueChainStartBuilder) => ContinueChainPlan): ContinueChainContinueBuilder

  union(build: (u: UnionBuilder) => UnionPlan): ContinueChainContinueBuilder
}

/* ──────────────────────────────────────────────────────────────
 * Outcome builders by context
 * ────────────────────────────────────────────────────────────── */

interface RelationshipOutcomeBuilder extends OutcomeBuilder<
  RelationshipPlan,
  RelationshipOutcomeBuilder
> {
  table<K extends TableName>(table: K, spec: TableSpec<K>): RelationshipPlan
  mapValues<K extends TableName>(table: K, spec: MapValuesSpec<K>): RelationshipPlan
  chain(build: (s: RootChainStartBuilder) => RootChainPlan): RelationshipPlan
}

interface StepOutcomeBuilder extends OutcomeBuilder<StepPlan, StepOutcomeBuilder> {
  seed<K extends TableName>(table: K, spec: SeedSpec<K>): StepPlan
  mapValues<K extends TableName>(table: K, spec: MapValuesSpec<K>): StepPlan
  chain(build: (s: RootChainStartBuilder) => RootChainPlan): StepPlan
}

interface ChainedOutcomeBuilder extends OutcomeBuilder<ChainedStep, ChainedOutcomeBuilder> {
  mapValues<K extends TableName>(table: K, spec: Omit<MapValuesSpec<K>, 'input'>): ChainedStep

  chain(build: (s: ContinueChainStartBuilder) => ContinueChainPlan): ChainedStep

  union(build: (u: UnionBuilder) => UnionPlan): ChainedStep
}

/* ──────────────────────────────────────────────────────────────
 * Public DataBuilder surface
 * ────────────────────────────────────────────────────────────── */

export type DataBuilder = {
  logic: Logic

  table<K extends TableName>(table: K, spec: TableSpec<K>): TablePlan
  seed<K extends TableName>(table: K, spec: SeedSpec<K>): SeedTableStep
  mapValues<K extends TableName>(table: K, spec: MapValuesSpec<K>): MapValuesStep

  chain(build: (s: RootChainStartBuilder) => RootChainPlan): RootChainPlan

  condition(
    build: (
      c: CondBuilder<RelationshipPlan, RelationshipOutcomeBuilder>
    ) => ConditionPlan<RelationshipPlan>
  ): ConditionPlan<RelationshipPlan>
}

/* ──────────────────────────────────────────────────────────────
 * Factory
 * ────────────────────────────────────────────────────────────── */

function createDataBuilder(): DataBuilder {
  const logic = createLogic()

  const seedStep = <K extends TableName>(table: K, spec: SeedSpec<K>): SeedTableStep => {
    const col = createColFn<K>()

    return {
      kind: 'SEED',
      table,
      valueColumn: String(spec.valueColumn),
      where: spec.where ? spec.where(col, logic) : undefined
    }
  }

  const inputMapValuesStep = <K extends TableName>(
    table: K,
    spec: MapValuesSpec<K>
  ): MapValuesStep => {
    const col = createColFn<K>()

    return {
      kind: 'MAP_VALUES',
      table,
      whereColumn: String(spec.whereColumn),
      valueColumn: String(spec.valueColumn),
      selectColumns: toSelectColumns(spec.selectColumns),
      input: spec.input,
      where: spec.where ? spec.where(col, logic) : undefined
    }
  }

  const chainedMapValuesStep = <K extends TableName>(
    table: K,
    spec: Omit<MapValuesSpec<K>, 'input'>
  ): NextMapValuesStep => {
    const col = createColFn<K>()

    return {
      kind: 'MAP_VALUES',
      table,
      whereColumn: String(spec.whereColumn),
      valueColumn: String(spec.valueColumn),
      selectColumns: toSelectColumns(spec.selectColumns),
      where: spec.where ? spec.where(col, logic) : undefined
    }
  }

  function createContinueChainBuilder(): ContinueChainStartBuilder {
    const steps: ChainedStep[] = []

    const createUnionBuilder = (): UnionBuilder => {
      const branches: ContinueChainPlan[] = []

      const api: UnionBuilder = {
        branch: (build: (s: ContinueChainStartBuilder) => ContinueChainPlan): UnionBuilder => {
          branches.push(build(createContinueChainBuilder()))
          return api
        },

        end: (): UnionPlan => {
          if (branches.length === 0) {
            throw new Error('Union must contain at least one branch')
          }

          return {
            kind: 'UNION',
            branches: branches as [ContinueChainPlan, ...ContinueChainPlan[]]
          }
        }
      }

      return api
    }

    const pushStart = (step: ChainedStep): ContinueChainContinueBuilder => {
      if (steps.length > 0) {
        throw new Error('Continuation chain start already defined')
      }

      steps.push(step)
      return continueBuilder
    }

    const pushNext = (step: ChainedStep): ContinueChainContinueBuilder => {
      if (steps.length === 0) {
        throw new Error('Continuation chain start must be defined before next steps')
      }

      steps.push(step)
      return continueBuilder
    }

    const createChainedOutcomeBuilder = (): ChainedOutcomeBuilder => ({
      mapValues: <K extends TableName>(
        table: K,
        spec: Omit<MapValuesSpec<K>, 'input'>
      ): ChainedStep => chainedMapValuesStep(table, spec),

      chain: (build: (s: ContinueChainStartBuilder) => ContinueChainPlan): ChainedStep =>
        build(createContinueChainBuilder()),

      union: (build: (u: UnionBuilder) => UnionPlan): ChainedStep => build(createUnionBuilder()),

      condition: (
        build: (c: CondBuilder<ChainedStep, ChainedOutcomeBuilder>) => ConditionPlan<ChainedStep>
      ): ChainedStep =>
        build(createCondBuilder<ChainedStep, ChainedOutcomeBuilder>(createChainedOutcomeBuilder))
    })

    const continueBuilder: ContinueChainContinueBuilder = {
      mapValues: <K extends TableName>(
        table: K,
        spec: Omit<MapValuesSpec<K>, 'input'>
      ): ContinueChainContinueBuilder => pushNext(chainedMapValuesStep(table, spec)),

      condition: (
        build: (c: CondBuilder<ChainedStep, ChainedOutcomeBuilder>) => ConditionPlan<ChainedStep>
      ): ContinueChainContinueBuilder =>
        pushNext(
          build(createCondBuilder<ChainedStep, ChainedOutcomeBuilder>(createChainedOutcomeBuilder))
        ),

      chain: (
        build: (s: ContinueChainStartBuilder) => ContinueChainPlan
      ): ContinueChainContinueBuilder => pushNext(build(createContinueChainBuilder())),

      union: (build: (u: UnionBuilder) => UnionPlan): ContinueChainContinueBuilder =>
        pushNext(build(createUnionBuilder())),

      end: (): ContinueChainPlan => {
        if (steps.length === 0) {
          throw new Error('Continuation chain must contain at least one step')
        }

        return {
          kind: 'CHAIN',
          mode: 'CONTINUE',
          steps: steps as [ChainedStep, ...ChainedStep[]]
        }
      }
    }

    const startBuilder: ContinueChainStartBuilder = {
      mapValues: <K extends TableName>(
        table: K,
        spec: Omit<MapValuesSpec<K>, 'input'>
      ): ContinueChainContinueBuilder => pushStart(chainedMapValuesStep(table, spec)),

      condition: (
        build: (c: CondBuilder<ChainedStep, ChainedOutcomeBuilder>) => ConditionPlan<ChainedStep>
      ): ContinueChainContinueBuilder =>
        pushStart(
          build(createCondBuilder<ChainedStep, ChainedOutcomeBuilder>(createChainedOutcomeBuilder))
        ),

      chain: (
        build: (s: ContinueChainStartBuilder) => ContinueChainPlan
      ): ContinueChainContinueBuilder => pushStart(build(createContinueChainBuilder())),

      union: (build: (u: UnionBuilder) => UnionPlan): ContinueChainContinueBuilder =>
        pushStart(build(createUnionBuilder()))
    }

    return startBuilder
  }

  function createRootChainBuilder(): RootChainStartBuilder {
    const steps: (StepPlan | ChainedStep)[] = []

    const createUnionBuilder = (): UnionBuilder => {
      const branches: ContinueChainPlan[] = []

      const api: UnionBuilder = {
        branch: (build: (s: ContinueChainStartBuilder) => ContinueChainPlan): UnionBuilder => {
          branches.push(build(createContinueChainBuilder()))
          return api
        },

        end: (): UnionPlan => {
          if (branches.length === 0) {
            throw new Error('Union must contain at least one branch')
          }

          return {
            kind: 'UNION',
            branches: branches as [ContinueChainPlan, ...ContinueChainPlan[]]
          }
        }
      }

      return api
    }

    const pushStart = (step: StepPlan): RootChainContinueBuilder => {
      if (steps.length > 0) {
        throw new Error('Root chain start already defined')
      }

      steps.push(step)
      return continueBuilder
    }

    const pushNext = (step: ChainedStep): RootChainContinueBuilder => {
      if (steps.length === 0) {
        throw new Error('Root chain start must be defined before next steps')
      }

      steps.push(step)
      return continueBuilder
    }

    const createChainedOutcomeBuilder = (): ChainedOutcomeBuilder => ({
      mapValues: <K extends TableName>(
        table: K,
        spec: Omit<MapValuesSpec<K>, 'input'>
      ): ChainedStep => chainedMapValuesStep(table, spec),

      chain: (build: (s: ContinueChainStartBuilder) => ContinueChainPlan): ChainedStep =>
        build(createContinueChainBuilder()),

      union: (build: (u: UnionBuilder) => UnionPlan): ChainedStep => build(createUnionBuilder()),

      condition: (
        build: (c: CondBuilder<ChainedStep, ChainedOutcomeBuilder>) => ConditionPlan<ChainedStep>
      ): ChainedStep =>
        build(createCondBuilder<ChainedStep, ChainedOutcomeBuilder>(createChainedOutcomeBuilder))
    })

    const createStepOutcomeBuilder = (): StepOutcomeBuilder => ({
      seed: <K extends TableName>(table: K, spec: SeedSpec<K>): StepPlan => seedStep(table, spec),

      mapValues: <K extends TableName>(table: K, spec: MapValuesSpec<K>): StepPlan =>
        inputMapValuesStep(table, spec),

      chain: (build: (s: RootChainStartBuilder) => RootChainPlan): StepPlan =>
        build(createRootChainBuilder()),

      condition: (
        build: (c: CondBuilder<StepPlan, StepOutcomeBuilder>) => ConditionPlan<StepPlan>
      ): StepPlan =>
        build(createCondBuilder<StepPlan, StepOutcomeBuilder>(createStepOutcomeBuilder))
    })

    const continueBuilder: RootChainContinueBuilder = {
      mapValues: <K extends TableName>(
        table: K,
        spec: Omit<MapValuesSpec<K>, 'input'>
      ): RootChainContinueBuilder => pushNext(chainedMapValuesStep(table, spec)),

      condition: (
        build: (c: CondBuilder<ChainedStep, ChainedOutcomeBuilder>) => ConditionPlan<ChainedStep>
      ): RootChainContinueBuilder =>
        pushNext(
          build(createCondBuilder<ChainedStep, ChainedOutcomeBuilder>(createChainedOutcomeBuilder))
        ),

      chain: (
        build: (s: ContinueChainStartBuilder) => ContinueChainPlan
      ): RootChainContinueBuilder => pushNext(build(createContinueChainBuilder())),

      union: (build: (u: UnionBuilder) => UnionPlan): RootChainContinueBuilder =>
        pushNext(build(createUnionBuilder())),

      end: (): RootChainPlan => {
        if (steps.length === 0) {
          throw new Error('Root chain must contain at least one step')
        }

        return {
          kind: 'CHAIN',
          mode: 'ROOT',
          steps: steps as [StepPlan, ...ChainedStep[]]
        }
      }
    }

    const startBuilder: RootChainStartBuilder = {
      seed: <K extends TableName>(table: K, spec: SeedSpec<K>): RootChainContinueBuilder =>
        pushStart(seedStep(table, spec)),

      input: <K extends TableName>(
        table: K,
        spec: MapValuesSpec<K> & { input: IdRef }
      ): RootChainContinueBuilder => pushStart(inputMapValuesStep(table, spec)),

      condition: (
        build: (c: CondBuilder<StepPlan, StepOutcomeBuilder>) => ConditionPlan<StepPlan>
      ): RootChainContinueBuilder =>
        pushStart(build(createCondBuilder<StepPlan, StepOutcomeBuilder>(createStepOutcomeBuilder))),

      chain: (build: (s: RootChainStartBuilder) => RootChainPlan): RootChainContinueBuilder =>
        pushStart(build(createRootChainBuilder()))
    }

    return startBuilder
  }

  const createRelationshipOutcomeBuilder = (): RelationshipOutcomeBuilder => ({
    table: <K extends TableName>(table: K, spec: TableSpec<K>): RelationshipPlan => {
      const col = createColFn<K>()

      return {
        kind: 'TABLE',
        table,
        selectColumns: toSelectColumns(spec.selectColumns),
        where: spec.where ? spec.where(col, logic) : undefined
      }
    },

    mapValues: <K extends TableName>(table: K, spec: MapValuesSpec<K>): RelationshipPlan =>
      inputMapValuesStep(table, spec),

    chain: (build: (s: RootChainStartBuilder) => RootChainPlan): RelationshipPlan =>
      build(createRootChainBuilder()),

    condition: (
      build: (
        c: CondBuilder<RelationshipPlan, RelationshipOutcomeBuilder>
      ) => ConditionPlan<RelationshipPlan>
    ): RelationshipPlan =>
      build(
        createCondBuilder<RelationshipPlan, RelationshipOutcomeBuilder>(
          createRelationshipOutcomeBuilder
        )
      )
  })

  const table: DataBuilder['table'] = <K extends TableName>(
    table: K,
    spec: TableSpec<K>
  ): TablePlan => {
    const col = createColFn<K>()

    return {
      kind: 'TABLE',
      table,
      selectColumns: toSelectColumns(spec.selectColumns),
      where: spec.where ? spec.where(col, logic) : undefined
    }
  }

  const seed: DataBuilder['seed'] = <K extends TableName>(
    table: K,
    spec: SeedSpec<K>
  ): SeedTableStep => seedStep(table, spec)

  const mapValues: DataBuilder['mapValues'] = <K extends TableName>(
    table: K,
    spec: MapValuesSpec<K>
  ): MapValuesStep => inputMapValuesStep(table, spec)

  function chain(build: (s: RootChainStartBuilder) => RootChainPlan): RootChainPlan {
    return build(createRootChainBuilder())
  }

  function condition(
    build: (
      c: CondBuilder<RelationshipPlan, RelationshipOutcomeBuilder>
    ) => ConditionPlan<RelationshipPlan>
  ): ConditionPlan<RelationshipPlan> {
    return build(
      createCondBuilder<RelationshipPlan, RelationshipOutcomeBuilder>(
        createRelationshipOutcomeBuilder
      )
    )
  }

  return {
    logic,
    table,
    seed,
    mapValues,
    chain,
    condition
  }
}

/* ──────────────────────────────────────────────────────────────
 * Node sources
 * ────────────────────────────────────────────────────────────── */
export const INLINE_FILTER_KIND = {
  ALLOW: 'ALLOW',
  DENY: 'DENY'
} as const

type InlineFilterKind = keyof typeof INLINE_FILTER_KIND

type InlineFilterOption = CoreMeta<keyof typeof INLINE_FILTER_KIND>

export const INLINE_FILTER_REGISTRY: Record<InlineFilterKind, InlineFilterOption> = {
  ALLOW: {
    code: 'ALLOW',
    label: 'Allow'
  },
  DENY: {
    code: 'DENY',
    label: 'DENY'
  }
} as const

export const INLINE_FILTER_OPTIONS = valuesOf(
  INLINE_FILTER_REGISTRY
) as readonly InlineFilterOption[]

export type InlineFilter = {
  kind: InlineFilterKind
  by: RelationshipPlan
}

export type NodeInlineSource =
  | { kind: 'INLINE_OPTIONS'; options: readonly CoreMeta[]; filter?: InlineFilter }
  | {
      kind: 'INLINE_GROUPS'
      optionGroups: readonly {
        showIf: ConditionIfExpr
        options: readonly CoreMeta[]
        filter?: InlineFilter
      }[]
    }

export type NodeDataSource = {
  kind: 'DATA'
  relationship: RelationshipPlan
  preserveUnknownOptions?: boolean
  /** Narrows the table's options to the values another relationship allows or denies. */
  filter?: InlineFilter
}

export type NodeLocalCollectionSource = {
  kind: 'LOCAL_COLLECTION'
  /** The ancestor (1 = parent) the collection path starts at; the authored document's root when unset. */
  up?: number
  rootCollectionPath: ShallowPath
  valuePath: ShallowPath
  labelPath: ShallowPath
}

export type NodeSelectSource = NodeInlineSource | NodeDataSource | NodeLocalCollectionSource

/* ──────────────────────────────────────────────────────────────
 * Node specs (nodeId is record key; node value has path)
 * ────────────────────────────────────────────────────────────── */

type NodeMetaBase = {
  label: string
  order?: number
  section?: NodeSectionSpec
  hiddenBehavior?: HiddenBehavior
  showIf?: ConditionIfExpr
  requiredIf?: true | ConditionIfExpr
}

/**
 * Serializable authoring intent. Maps describe author-facing semantics; web
 * renderers choose components, CSS, icons, and responsive behavior.
 */
export const GROUP_PRESENTATION = {
  INLINE: OBJECT_GROUP_PRESENTATION.INLINE,
  TABLE: ARRAY_GROUP_PRESENTATION.TABLE,
  SUMMARY: ARRAY_GROUP_PRESENTATION.SUMMARY,
  BRANCH: ARRAY_GROUP_PRESENTATION.BRANCH,
  FOCUSED: ARRAY_GROUP_PRESENTATION.FOCUSED
} as const

export type NodeSectionSpec = {
  id: string
  label: string
  description?: string
  order: number
  step?: NodeStepSpec
}

export type NodeStepSpec = {
  id: string
  label: string
  description?: string
  order: number
}

export type NodeInput<NLocal extends object> =
  | (NodeMetaBase & {
      kind: typeof NODE_KIND.INPUT
      type: 'RICH_TEXT' | 'TEXT' | 'NUMBER' | 'TOGGLE'
      path: InputPathFor<NLocal>
      constraints?: AuthoringInputConstraints
      authoring?: NodeAuthoringMeta
    })
  | (NodeMetaBase & {
      kind: typeof NODE_KIND.INPUT
      type: 'SELECT_MULTI' | 'SELECT_NUMBER' | 'SELECT_SINGLE'
      path: InputPathFor<NLocal>
      source: NodeSelectSource
      constraints?: AuthoringInputConstraints
      authoring?: NodeAuthoringMeta
    })

export type NodeGroupObject<NLocal extends object, K extends ObjectGroupKey<NLocal>> = Pick<
  NodeMetaBase,
  'label' | 'order' | 'section' | 'hiddenBehavior' | 'showIf' | 'requiredIf'
> & {
  kind: typeof NODE_KIND.GROUP
  groupKind: 'OBJECT'
  presentation: ObjectGroupPresentation
  path: readonly [K]
  nodes: Lazy<NodeMap<ChildForGroupKey<NLocal, K>>>
  authoring?: NodeObjectAuthoringMeta
}

export type NodeGroupArray<NLocal extends object, K extends ArrayGroupKey<NLocal>> = Pick<
  NodeMetaBase,
  'label' | 'order' | 'section' | 'hiddenBehavior' | 'showIf' | 'requiredIf'
> & {
  kind: typeof NODE_KIND.GROUP
  groupKind: 'ARRAY'
  presentation: ArrayGroupPresentation
  path: readonly [K]
  nodes: Lazy<NodeMap<ChildForGroupKey<NLocal, K>>>
  authoring?: NodeArrayAuthoringMeta
}

export type NodeEntry<NLocal extends object> =
  | NodeInput<NLocal>
  | {
      [K in ObjectGroupKey<NLocal>]: NodeGroupObject<NLocal, K>
    }[ObjectGroupKey<NLocal>]
  | {
      [K in ArrayGroupKey<NLocal>]: NodeGroupArray<NLocal, K>
    }[ArrayGroupKey<NLocal>]

export type NodeMap<NLocal extends object> = {
  authoring?: NodeMapAuthoringMeta
  schemaVersion: 1
  mapId: string
  nodes: Record<NodeId, NodeEntry<NLocal>>
  /** Set on a map keyed by a System table's rows; its `nodes` are empty until the resolver expands it. */
  keyedBy?: NodeKeyedBy
}

/**
 * A map whose keys are the rows of a System table (D193): the resolver adds one `entry` per row of
 * the request's System, keyed by the row code, labelled by the row and in row order.
 */
export type NodeKeyedBy = {
  rows: TablePlan
  entry:
    | { kind: typeof NODE_KIND.INPUT; type: 'NUMBER'; constraints?: AuthoringInputConstraints }
    | {
        kind: typeof NODE_KIND.GROUP
        groupKind: 'OBJECT'
        presentation: ObjectGroupPresentation
        nodes: Lazy<RuntimeNodeMap>
      }
}

/** Any node map with its document type erased, for code that walks maps generically (registries, masking). */
export type RuntimeNodeMap = Omit<NodeMap<Record<string, unknown>>, 'nodes'> & {
  nodes: Record<NodeId, RuntimeNodeEntry>
}

export type RuntimeNodeEntry =
  | NodeInput<Record<string, readonly unknown[]>>
  | (Omit<NodeGroupObject<Record<string, Record<string, unknown>>, string>, 'nodes'> & {
      nodes: Lazy<RuntimeNodeMap>
    })
  | (Omit<NodeGroupArray<Record<string, readonly Record<string, unknown>[]>, string>, 'nodes'> & {
      nodes: Lazy<RuntimeNodeMap>
    })

/* ──────────────────────────────────────────────────────────────
 * Node helpers
 * ────────────────────────────────────────────────────────────── */

type NodeMetaSpec = Pick<
  NodeMetaBase,
  'order' | 'section' | 'hiddenBehavior' | 'showIf' | 'requiredIf'
> & {
  constraints?: AuthoringInputConstraints
  authoring?: NodeAuthoringMeta
}
type GroupMetaSpec<TPresentation extends GroupPresentation> = Pick<
  NodeMetaBase,
  'order' | 'section' | 'hiddenBehavior' | 'showIf' | 'requiredIf'
> & {
  presentation: TPresentation
}

type ObjectGroupMetaSpec = GroupMetaSpec<ObjectGroupPresentation> & {
  authoring?: NodeObjectAuthoringMeta
}

type ArrayGroupMetaSpec = GroupMetaSpec<ArrayGroupPresentation> & {
  authoring?: NodeArrayAuthoringMeta
}

export type NodeBuilder<NLocal extends object> = {
  text(
    path: ScalarInputPathFor<NLocal, string>,
    label: string,
    meta?: NodeMetaSpec
  ): NodeInput<NLocal>
  richText(
    path: ScalarInputPathFor<NLocal, string>,
    label: string,
    meta?: NodeMetaSpec
  ): NodeInput<NLocal>
  number(
    path: ScalarInputPathFor<NLocal, number>,
    label: string,
    meta?: NodeMetaSpec
  ): NodeInput<NLocal>
  toggle(
    path: ScalarInputPathFor<NLocal, boolean>,
    label: string,
    meta?: NodeMetaSpec
  ): NodeInput<NLocal>

  selectSingle(
    path: ScalarInputPathFor<NLocal, string>,
    label: string,
    source: NodeSelectSource,
    meta?: NodeMetaSpec
  ): NodeInput<NLocal>
  selectNumber(
    path: ScalarInputPathFor<NLocal, number>,
    label: string,
    source: NodeSelectSource,
    meta?: NodeMetaSpec
  ): NodeInput<NLocal>
  selectMulti(
    path: MultiSelectInputPathFor<NLocal>,
    label: string,
    source: NodeSelectSource,
    meta?: NodeMetaSpec
  ): NodeInput<NLocal>

  groupObject<K extends ObjectGroupKey<NLocal>>(
    path: readonly [K],
    label: string,
    child: Lazy<NodeMap<ChildForGroupKey<NLocal, K>>>,
    meta: ObjectGroupMetaSpec
  ): NodeGroupObject<NLocal, K>

  groupArray<K extends ArrayGroupKey<NLocal>>(
    path: readonly [K],
    label: string,
    child: Lazy<NodeMap<ChildForGroupKey<NLocal, K>>>,
    meta: ArrayGroupMetaSpec
  ): NodeGroupArray<NLocal, K>
}

function createNodeBuilder<NLocal extends object>(): NodeBuilder<NLocal> {
  return {
    text: (path, label, meta) => ({
      kind: 'INPUT',
      type: 'TEXT',
      path,
      label,
      order: meta?.order,
      section: meta?.section,
      hiddenBehavior: meta?.hiddenBehavior,
      showIf: meta?.showIf,
      requiredIf: meta?.requiredIf,
      constraints: {
        maximumLength: AUTHORED_LIMITS.shortTextCharacters,
        ...meta?.constraints
      },
      authoring: resolveInputAuthoringMeta(meta?.authoring)
    }),

    richText: (path, label, meta) => ({
      kind: 'INPUT',
      type: 'RICH_TEXT',
      path,
      label,
      order: meta?.order,
      section: meta?.section,
      hiddenBehavior: meta?.hiddenBehavior,
      showIf: meta?.showIf,
      requiredIf: meta?.requiredIf,
      constraints: {
        maximumLength: AUTHORED_LIMITS.richTextVisibleCharacters,
        ...meta?.constraints
      },
      authoring: resolveInputAuthoringMeta(meta?.authoring)
    }),

    number: (path, label, meta) => ({
      kind: 'INPUT',
      type: 'NUMBER',
      path,
      label,
      order: meta?.order,
      section: meta?.section,
      hiddenBehavior: meta?.hiddenBehavior,
      showIf: meta?.showIf,
      requiredIf: meta?.requiredIf,
      constraints: meta?.constraints,
      authoring: resolveInputAuthoringMeta(meta?.authoring)
    }),

    toggle: (path, label, meta) => ({
      kind: 'INPUT',
      type: 'TOGGLE',
      path,
      label,
      order: meta?.order,
      section: meta?.section,
      hiddenBehavior: meta?.hiddenBehavior,
      showIf: meta?.showIf,
      requiredIf: meta?.requiredIf,
      constraints: meta?.constraints,
      authoring: resolveInputAuthoringMeta(meta?.authoring)
    }),

    selectSingle: (path, label, source, meta) => ({
      kind: 'INPUT',
      type: 'SELECT_SINGLE',
      path,
      label,
      source,
      order: meta?.order,
      section: meta?.section,
      hiddenBehavior: meta?.hiddenBehavior,
      showIf: meta?.showIf,
      requiredIf: meta?.requiredIf,
      constraints: meta?.constraints,
      authoring: resolveInputAuthoringMeta(meta?.authoring)
    }),

    selectNumber: (path, label, source, meta) => ({
      kind: 'INPUT',
      type: 'SELECT_NUMBER',
      path,
      label,
      source,
      order: meta?.order,
      section: meta?.section,
      hiddenBehavior: meta?.hiddenBehavior,
      showIf: meta?.showIf,
      requiredIf: meta?.requiredIf,
      constraints: meta?.constraints,
      authoring: resolveInputAuthoringMeta(meta?.authoring)
    }),

    selectMulti: (path, label, source, meta) => ({
      kind: 'INPUT',
      type: 'SELECT_MULTI',
      path,
      label,
      source,
      order: meta?.order,
      section: meta?.section,
      hiddenBehavior: meta?.hiddenBehavior,
      showIf: meta?.showIf,
      requiredIf: meta?.requiredIf,
      constraints: meta?.constraints,
      authoring: resolveInputAuthoringMeta(meta?.authoring)
    }),

    groupObject: (path, label, child, meta) => ({
      kind: 'GROUP',
      groupKind: 'OBJECT',
      presentation: meta.presentation,
      path,
      label,
      order: meta?.order,
      section: meta?.section,
      hiddenBehavior: meta?.hiddenBehavior,
      showIf: meta?.showIf,
      requiredIf: meta?.requiredIf,
      authoring: meta?.authoring,
      nodes: child
    }),

    groupArray: (path, label, child, meta) => {
      if (meta.authoring?.collection) {
        assertUniqueActionTypes(meta.authoring.collection.actions, `${label} collection`)
      }
      return {
        kind: 'GROUP',
        groupKind: 'ARRAY',
        presentation: meta.presentation,
        path,
        label,
        order: meta?.order,
        section: meta?.section,
        hiddenBehavior: meta?.hiddenBehavior,
        showIf: meta?.showIf,
        requiredIf: meta?.requiredIf,
        authoring: meta?.authoring,
        nodes: child
      }
    }
  }
}

/* ──────────────────────────────────────────────────────────────
 * NodeMapBuilder (.set/.build)
 * ────────────────────────────────────────────────────────────── */

export type NodeMapBuilder<NLocal extends object> = {
  set(nodeId: NodeId, node: NodeEntry<NLocal>): NodeMapBuilder<NLocal>
  merge(nodes: Record<NodeId, NodeEntry<NLocal>>): NodeMapBuilder<NLocal>
  build(): Record<NodeId, NodeEntry<NLocal>>
}

function createNodeMapBuilder<NLocal extends object>(): NodeMapBuilder<NLocal> {
  const acc: Record<NodeId, NodeEntry<NLocal>> = {}

  const api: NodeMapBuilder<NLocal> = {
    set: (nodeId, node) => {
      if (nodeId in acc) throw new Error(`Duplicate node id: ${nodeId}`)
      acc[nodeId] = node
      return api
    },
    merge: (nodes) => {
      for (const [k, v] of Object.entries(nodes)) {
        if (k in acc) throw new Error(`Duplicate node id: ${k}`)
        acc[k] = v
      }
      return api
    },
    build: () => acc
  }

  return api
}

/* ──────────────────────────────────────────────────────────────
 * BuildNodeMap API
 * ────────────────────────────────────────────────────────────── */

type BuildApi<NLocal extends object> = {
  logic: Logic
  cond: ConditionIfBuilder<NLocal>
  data: DataBuilder
  nodes: NodeBuilder<NLocal>
  map: NodeMapBuilder<NLocal>
}

export type BuildNodeMap<NLocal extends object> = {
  define(
    mapId: string,
    build: (api: BuildApi<NLocal>) => void,
    authoring?: NodeMapAuthoringMeta
  ): NodeMap<NLocal>
  defineKeyed(mapId: string, keyedBy: NodeKeyedBy): NodeMap<NLocal>
  logic: Logic
  cond: ConditionIfBuilder<NLocal>
  data: DataBuilder
  nodes: NodeBuilder<NLocal>
}

export function buildNodeMap<NLocalIn extends object = EmptyObject>(): BuildNodeMap<
  NormalizeForAccess<NLocalIn>
> {
  type NLocal = NormalizeForAccess<NLocalIn>

  const logic = createLogic()
  const cond = createConditionIfBuilder<NLocal>()
  const data = createDataBuilder()
  const nodes = createNodeBuilder<NLocal>()

  return {
    define: (mapId, build, authoring) => {
      const map = createNodeMapBuilder<NLocal>()
      build({ logic, cond, data, nodes, map })
      return { schemaVersion: 1, mapId, nodes: map.build(), authoring }
    },
    defineKeyed: (mapId, keyedBy) => ({ schemaVersion: 1, mapId, nodes: {}, keyedBy }),
    logic,
    cond,
    data,
    nodes
  }
}

/* ──────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────── */

export type OptionWithCode = CoreMeta<string>

export function buildRegistryOptionGroups<
  TCode extends string,
  TOption extends CoreMeta<TCode>,
  TMap extends Record<string, readonly TCode[]>
>(
  registry: Record<TCode, TOption>,
  byCategory: TMap,
  showIfForCategory: (category: keyof TMap & string) => ConditionIfExpr,
  fallbackShowIf?: ConditionIfExpr
): readonly {
  showIf: ConditionIfExpr
  options: readonly TOption[]
}[] {
  const groups = Object.entries(byCategory).map(([category, codes]) => ({
    showIf: showIfForCategory(category),
    options: codes.map((code) => registry[code as TCode])
  }))

  return fallbackShowIf
    ? [
        ...groups,
        {
          showIf: fallbackShowIf,
          options: Object.values(registry)
        }
      ]
    : groups
}
