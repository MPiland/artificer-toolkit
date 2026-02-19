import type { ExclusifyUnion, Get, Paths, SimplifyDeep } from 'type-fest'

/* ──────────────────────────────────────────────────────────────
 * Normalization Strategy
 *
 * - Path enumeration (Paths<T>) must run on the “raw” structural type.
 *   Exclusifying unions can collapse/degenerate Paths for complex unions.
 *
 * - Value lookup (Get<T, P>) and top-level key access benefit from
 *   exclusifying unions, which makes union members mutually exclusive
 *   and allows safe property access across the union surface.
 * ────────────────────────────────────────────────────────────── */

/** Structural object extraction used for path enumeration. */
export type NormalizeForPaths<T> = Extract<T, object>

/** Exclusified union surface used for key access and value lookup. */
export type NormalizeForAccess<T extends object> = Extract<ExclusifyUnion<SimplifyDeep<T>>, object>

/* ──────────────────────────────────────────────────────────────
 * Path Utilities
 * ────────────────────────────────────────────────────────────── */

/** Distributes Paths over unions so each member contributes paths. */
export type DistPaths<T> = T extends unknown ? Paths<T, { maxRecursionDepth: 2 }> : never

/** Dot-notation paths for an authored shape, based on raw structural type. */
export type StrPath<T extends object> = Extract<
  DistPaths<NormalizeForPaths<T>>,
  string
>

/* ──────────────────────────────────────────────────────────────
 * Value Lookup Utilities
 * ────────────────────────────────────────────────────────────── */

/** Distributes Get over unions so lookups are computed per union member. */
export type DistGet<T, P extends string> = T extends unknown ? Get<T, P> : never

/**
 * Value type located at a path P.
 * Uses an exclusified union surface to improve lookup behavior across unions.
 */
export type AtPath<T extends object, P extends StrPath<T>> = NonNullable<
  DistGet<NormalizeForAccess<T>, P>
>

export type ArrayElement<T>
  = T extends readonly (infer U)[] ? U
    : T extends (infer U)[] ? U
      : never

export type ArrayElementAt<
  T extends object,
  P extends StrPath<T>
> = ArrayElement<NonNullable<AtPath<T, P>>>
