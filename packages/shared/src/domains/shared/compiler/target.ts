import type { Subject } from '#core'

import type {
  TargetAuthored,
  TargetGroupAuthored,
  TargetGroupsAuthored
} from '#authored'

/* ──────────────────────────────────────────────
 * Utilities
 * ────────────────────────────────────────────── */

function byOrder<T extends { order: number }>(a: T, b: T): number {
  return a.order - b.order
}

/* ──────────────────────────────────────────────
 * Compiled Types
 * ────────────────────────────────────────────── */

// Remove authoring-only identity fields
export type CompiledTarget<S extends Subject = Subject> = Omit<
  TargetAuthored<S>,
  'id'
>

// One AND-group
export type CompiledTargetGroup<S extends Subject = Subject> = {
  conditions: CompiledTarget<S>[]
}

// OR-groups root
export type CompiledTargetGroups<S extends Subject = Subject> = {
  groups: CompiledTargetGroup<S>[]
}

/* ──────────────────────────────────────────────
 * Compiler
 * ────────────────────────────────────────────── */

/**
 * Compile a single target leaf.
 * - strips `id`
 * - clones nodes defensively
 */
export function compileTarget<S extends Subject>(
  authored: TargetAuthored<S>
): CompiledTarget<S> {
  const rest = authored as Omit<TargetAuthored<S>, 'id'>

  return {
    ...rest,

    // Defensive copy: avoid mutation bugs later
    nodes: [...rest.nodes] as typeof rest.nodes
  }
}

/**
 * Compile one AND-group.
 * - strips group id
 * - sorts conditions by `order`
 */
export function compileTargetGroup<S extends Subject>(
  authored: TargetGroupAuthored
): CompiledTargetGroup<S> {
  const compiled = authored.conditions
    .slice()
    .sort(byOrder)
    .map((c) => compileTarget<S>(c))

  return {
    conditions: compiled
  }
}

/**
 * Compile OR-groups.
 * - preserves group order
 * - returns undefined if absent
 */
export function compileTargetGroups<S extends Subject>(
  authored?: TargetGroupsAuthored
): CompiledTargetGroups<S> | undefined {
  if (!authored) return undefined

  return {
    groups: authored.groups.map((g) => compileTargetGroup<S>(g))
  }
}
