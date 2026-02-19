import type { CoreMeta } from '#core'
import type { SupabaseDatabase } from '@artificer-toolkit/db'
import type { EmptyObject } from 'type-fest'
import type { AtPath, NormalizeForAccess, StrPath } from './nodeHelpers.js'

export const NODE_KIND = {
  INPUT: 'INPUT',
  GROUP: 'GROUP'
} as const

export type NodeKind = (typeof NODE_KIND)[keyof typeof NODE_KIND]

type ValueForField<
  NLocal extends object,
  NContext extends object,
  F extends ShowIfField<NLocal, NContext>
>
  = F extends FieldKey<NLocal>
    ? NormalizeForAccess<NLocal>[F]
    : F extends FieldKey<NContext>
      ? NormalizeForAccess<NContext>[F]
      : never

/* ──────────────────────────────────────────────────────────────
 * ShowIf Utilities
 * ────────────────────────────────────────────────────────────── */

/**
 * Top-level keys available for showIf.field.
 * Exclusified surface avoids “missing key” issues on object unions.
 */
type FieldKey<T extends object> = Extract<keyof NormalizeForAccess<T>, string>

/** showIf.field may reference either the local object or its parent (top-level only). */
type ShowIfField<NLocal extends object, NContext extends object>
  = | FieldKey<NLocal>
    | FieldKey<NContext>

type ShowIfCondition<
  NLocal extends object,
  NContext extends object,
  F extends ShowIfField<NLocal, NContext> = ShowIfField<NLocal, NContext>
> = | {
  field: F
  op: '=' | '>' | '<' | '>=' | '<=' | 'contains'
  value: ValueForField<NLocal, NContext, F>
} | {
  field: F
  op: 'empty'
}

type ShowIfExpr<NLocal extends object, NContext extends object>
  = | ShowIfCondition<NLocal, NContext>
    | { and: readonly ShowIfExpr<NLocal, NContext>[] }
    | { or: readonly ShowIfExpr<NLocal, NContext>[] }
    | { not: ShowIfExpr<NLocal, NContext> }

/* ──────────────────────────────────────────────────────────────
 * NodeMap Child Resolution Helpers
 * ────────────────────────────────────────────────────────────── */

type Obj<T> = Extract<T, object>
type ElemObj<T> = T extends readonly (infer U)[] ? Obj<NonNullable<U>> : never

/**
 * Computes the child NodeMap type for a given path P.
 * - Arrays recurse into the element object type.
 * - Objects recurse into the nested object type.
 * - Scalars produce never (no child nodes).
 *
 * Parent context for children is the immediate parent object (NLocal).
 */
type ChildMapFor<NLocal extends object, P extends StrPath<NLocal>>
  = AtPath<NLocal, P> extends readonly unknown[]
    ? [ElemObj<AtPath<NLocal, P>>] extends [never]
        ? never
        : NodeMap<ElemObj<AtPath<NLocal, P>>, NLocal>
    : [Obj<AtPath<NLocal, P>>] extends [never]
        ? never
        : NodeMap<Obj<AtPath<NLocal, P>>, NLocal>

/* ──────────────────────────────────────────────────────────────
 * Data Relationship (unchanged)
 * ────────────────────────────────────────────────────────────── */

export type Relationship
  = | {
    [K in keyof SupabaseDatabase['public']['Tables']]:
      | {
        kind: 'BRIDGE'
        table: K
        parentColumn: keyof SupabaseDatabase['public']['Tables'][K]['Row']
        childColumn: keyof SupabaseDatabase['public']['Tables'][K]['Row']
      }
      | { kind: 'ROOT', table: K }
      | {
        kind: 'FOREIGN_KEY'
        table: K
        parentColumn: keyof SupabaseDatabase['public']['Tables'][K]['Row']
      }
      | {
        kind: 'CONDITION'
        table: K
        column: keyof SupabaseDatabase['public']['Tables'][K]['Row']
        condition: string
      }
  }[keyof SupabaseDatabase['public']['Tables']]
  | {
    kind: 'FOREIGN_KEY'
    parent: {
      [K in keyof SupabaseDatabase['public']['Tables']]: {
        table: K
        column: keyof SupabaseDatabase['public']['Tables'][K]['Row']
      }
    }[keyof SupabaseDatabase['public']['Tables']]
    child: {
      [K in keyof SupabaseDatabase['public']['Tables']]: {
        table: K
        column: keyof SupabaseDatabase['public']['Tables'][K]['Row']
      }
    }[keyof SupabaseDatabase['public']['Tables']]
  }

/* ──────────────────────────────────────────────────────────────
 * Node Types
 * ────────────────────────────────────────────────────────────── */

export type NodeInputBase<NLocal extends object, NContext extends object>
  = | { type: 'RICH_TEXT' | 'TEXT' | 'NUMBER' }
    | {
      type: 'SELECT_MULTI' | 'SELECT_SINGLE'
      source:
        | ({ kind: 'INLINE' }
          & (
            { options: readonly CoreMeta[] }
            | {
              optionGroups: readonly {
                showIf: ShowIfExpr<NLocal, NContext>
                options: readonly CoreMeta[]
              }[]
            })
        )
        | { kind: 'DATA', relationship: Relationship | ({ showIf: ShowIfExpr<NLocal, NContext> } & Relationship)[] }
    }

export type NodeInput<NLocal extends object, NContext extends object> = {
  kind: typeof NODE_KIND.INPUT
  label?: string
  requiredIf?: true | ShowIfExpr<NLocal, NContext>
  showIf?: ShowIfExpr<NLocal, NContext>
  nodes?: never
} & NodeInputBase<NLocal, NContext>

export type NodeGroup<
  NLocal extends object,
  NContext extends object,
  P extends StrPath<NLocal>
>
  = ChildMapFor<NLocal, P> extends never
    ? never
    : {
        kind: typeof NODE_KIND.GROUP
        label?: string
        showIf?: ShowIfExpr<NLocal, NContext>
        nodes: ChildMapFor<NLocal, P>
      }

type NodeEntry<
  NLocal extends object,
  NContext extends object,
  P extends StrPath<NLocal>
> = NodeInput<NLocal, NContext> | NodeGroup<NLocal, NContext, P>

export type NodeMap<
  NLocal extends object,
  NContext extends object = EmptyObject
> = Partial<{
  [P in StrPath<NLocal>]: NodeEntry<NLocal, NContext, P>
}>

/* ──────────────────────────────────────────────────────────────
 * Extra Key Guard
 * ────────────────────────────────────────────────────────────── */

/**
 * Enforces that an object does not contain keys outside Allowed.
 * Extra keys become optional-never, producing assignment errors.
 */

type ForbidExtraKeys<T, Allowed extends PropertyKey> = T & {
  [K in Exclude<keyof T, Allowed>]?: `Invalid key: ${Extract<K, string>}`
}

/* ──────────────────────────────────────────────────────────────
 * NodeMap Builder
 * ────────────────────────────────────────────────────────────── */
type FieldConditions<
  NLocal extends object,
  NContext extends object,
  F extends ShowIfField<NLocal, NContext>
> = {
  eq(value: ValueForField<NLocal, NContext, F>): ShowIfExpr<NLocal, NContext>
  gt(value: ValueForField<NLocal, NContext, F>): ShowIfExpr<NLocal, NContext>
  gte(value: ValueForField<NLocal, NContext, F>): ShowIfExpr<NLocal, NContext>
  lt(value: ValueForField<NLocal, NContext, F>): ShowIfExpr<NLocal, NContext>
  lte(value: ValueForField<NLocal, NContext, F>): ShowIfExpr<NLocal, NContext>
  contains(
    value: ValueForField<NLocal, NContext, F>
  ): ShowIfExpr<NLocal, NContext>
  empty(): ShowIfExpr<NLocal, NContext>
}

export type ShowIfBuilder<NLocal extends object, NContext extends object> = {
  and(
    exprs: readonly ShowIfExpr<NLocal, NContext>[]
  ): ShowIfExpr<NLocal, NContext>
  or(
    exprs: readonly ShowIfExpr<NLocal, NContext>[]
  ): ShowIfExpr<NLocal, NContext>
  not(expr: ShowIfExpr<NLocal, NContext>): ShowIfExpr<NLocal, NContext>

  field<F extends ShowIfField<NLocal, NContext>>(
    field: F
  ): FieldConditions<NLocal, NContext, F>
}

function createShowIfBuilder<
  NLocal extends object,
  NContext extends object
>(): ShowIfBuilder<NLocal, NContext> {
  return {
    and: (exprs) => ({ and: exprs }),
    or: (exprs) => ({ or: exprs }),
    not: (expr) => ({ not: expr }),

    field: (field) => ({
      eq: (value) => ({ field, op: '=', value }),
      gt: (value) => ({ field, op: '>', value }),
      gte: (value) => ({ field, op: '>=', value }),
      lt: (value) => ({ field, op: '<', value }),
      lte: (value) => ({ field, op: '<=', value }),
      contains: (value) => ({ field, op: 'contains', value }),
      empty: () => ({ field, op: 'empty' })
    })
  }
}

/**
 * Returns a typed environment for defining NodeMaps.
 * - define(...) validates keys against StrPath<NLocal>
 * - node exposes typed helper builders
 */

type DefineBuilder<NLocal extends object, NContext extends object> = (
  build: (
    map: MapFn<NLocal, NContext>,
    showIf: ShowIfBuilder<NLocal, NContext>
  ) => ForbidExtraKeys<NodeMap<NLocal, NContext>, StrPath<NLocal>>
) => NodeMap<NLocal, NContext>

type MapFn<NLocal extends object, NContext extends object> = <
  T extends NodeMap<NLocal, NContext>
>(
  map: ForbidExtraKeys<T, StrPath<NLocal>>
) => T

export type BuildNodeMap<
  NLocal extends object,
  NContext extends object = NLocal
> = {
  define: DefineBuilder<NLocal, NContext>
  showIf: ShowIfBuilder<NLocal, NContext>
}

export function buildNodeMap<
  NLocal extends object,
  NContext extends object = NLocal
>(): BuildNodeMap<NLocal, NContext> {
  const map: MapFn<NLocal, NContext> = (m) => m

  const showIf: ShowIfBuilder<NLocal, NContext> = createShowIfBuilder()

  function define(
    arg: (
      map: MapFn<NLocal, NContext>,
      showIf: ShowIfBuilder<NLocal, NContext>
    ) => ForbidExtraKeys<NodeMap<NLocal, NContext>, StrPath<NLocal>>
  ): NodeMap<NLocal, NContext> {
    return arg(map, showIf)
  }

  return { define, showIf }
}
