import type {
  AuthoringConstraintCode,
  NodeSubjectCode,
  SubjectPredicateCode,
  RelationCode,
  RelationTargetSubject,
  SubjectWithRelations,
  PredicatePayloadByCode,
  SubjectSelectionPayload
} from '#core'
import type { Selectable } from '#utils'
import { EmptyObject } from 'type-fest'

/* ──────────────────────────────────────────────────────────────
 * Selection
 * ────────────────────────────────────────────────────────────── */

export type SubjectSelectionAuthored<
  S extends NodeSubjectCode = NodeSubjectCode
> = Selectable<SubjectSelectionPayload<S>>

/**
 * Selection applied at an EXISTS hop.
 * The selected payload targets the related subject implied by (S, R).
 */
export type FacetRelationSelectionAuthored<
  S extends NodeSubjectCode = NodeSubjectCode,
  R extends RelationCode<S> = RelationCode<S>
> = SubjectSelectionAuthored<RelationTargetSubject<S, R>>

/* ──────────────────────────────────────────────────────────────
 * Single-subject body (used inside EXISTS.where)
 * OR-of-AND groups scoped to a single subject.
 * ────────────────────────────────────────────────────────────── */

export type FacetBodyAuthored<S extends NodeSubjectCode = NodeSubjectCode> = {
  groups: readonly FacetBodyGroupAuthored<S>[] // OR
} & SubjectSelectionAuthored<S>

export type FacetBodyGroupAuthored<S extends NodeSubjectCode = NodeSubjectCode> = {
  id: string
  order: number
  /** AND-combined property checks. Omit rather than passing []. */
  conditions?: readonly FacetConditionAuthored<S>[]
}

/**
 * Single-subject entry-point facet (optional helper).
 * Useful when an authored field is explicitly rooted at a single subject.
 */
export type ScopedFacetAuthored<S extends NodeSubjectCode = NodeSubjectCode> = {
  id: string
  subject: S
} & FacetBodyAuthored<S>

/* ──────────────────────────────────────────────────────────────
 * Multi-subject facet
 * Top-level OR groups, each group is AND across subject contexts.
 * ────────────────────────────────────────────────────────────── */

export type FacetAuthored<N extends NodeSubjectCode = NodeSubjectCode> = {
  id: string
  groups: readonly FacetGroupAuthored<N>[] // OR
}

export type FacetGroupAuthored<N extends NodeSubjectCode = NodeSubjectCode> = {
  id: string
  order: number
  contexts: readonly FacetContextAuthored<N>[] // AND
}

/**
 * A subject context block within a facet group.
 *
 * The chain is: **subject type → identity selection → property predicates (optional)**
 *
 * 1. `subject` — declares the kind of node being checked (e.g. `'CHARACTER'`, `'SPELL'`, `'EQUIPMENT'`).
 * 2. Identity selection (from `SubjectSelectionAuthored<N>`) — narrows to specific instances
 *    by ID (e.g. `spellIds: [ELDRITCH_BLAST_ID]`). `CHARACTER` has no selection payload
 *    because there is always exactly one character in context.
 * 3. `conditions` (optional) — further AND-combined property checks on the selected subjects
 *    (e.g. `MAGIC_SCHOOL`, `SPELL_LEVEL`). Predicates are the terminal nodes of the chain.
 *    Omitting `conditions` means the identity selection alone is the complete restriction —
 *    do not provide an empty array, omit the field entirely.
 *
 * @example Identity-only restriction — "applies only to Eldritch Blast"
 * ```ts
 * { subject: 'SPELL', spellIds: [ELDRITCH_BLAST_ID] }
 * ```
 *
 * @example Identity + property — "applies to evocation spells of level 1–3"
 * ```ts
 * { subject: 'SPELL', spellIds: [...],
 *   conditions: [
 *     { kind: 'PREDICATE', predicateCode: 'MAGIC_SCHOOL', magicSchoolIds: [EVOCATION_ID], ... },
 *     { kind: 'PREDICATE', predicateCode: 'SPELL_LEVEL', min: 1, max: 3, ... }
 *   ] }
 * ```
 *
 * @example Character prerequisite — "character must have obtained Eldritch Blast"
 * ```ts
 * { subject: 'CHARACTER',
 *   conditions: [{ kind: 'PREDICATE', predicateCode: 'SPELL_OBTAINED', spellIds: [ELDRITCH_BLAST_ID], ... }] }
 * ```
 */
export type FacetContextAuthored<N extends NodeSubjectCode = NodeSubjectCode>
  = N extends NodeSubjectCode ? {
    id: string
    order: number
    subject: N
    conditions?: readonly FacetConditionAuthored<N>[] // AND; omit rather than passing []
  } & (N extends 'CHARACTER' ? EmptyObject : SubjectSelectionAuthored<N>)
    : never

/* ──────────────────────────────────────────────────────────────
 * Conditions
 * ────────────────────────────────────────────────────────────── */

export type FacetConditionAuthored<S extends NodeSubjectCode = NodeSubjectCode>
  = | PredicateConditionAuthored<S>
    | ExistsConditionAuthored<S>

/**
 * Predicate node: code + payload.
 * Payload is correlated to the predicate code for the given subject.
 */
export type PredicateNodeAuthored<S extends NodeSubjectCode = NodeSubjectCode>
  = SubjectPredicateCode<S> extends infer C
    ? C extends keyof PredicatePayloadByCode
      ? { predicateCode: C } & PredicatePayloadByCode[C]
      : never
    : never

export type PredicateConditionAuthored<S extends NodeSubjectCode = NodeSubjectCode>
  = SubjectPredicateCode<S> extends never
    ? never
    : {
      id: string
      order: number
      kind: 'PREDICATE'
      constraint: AuthoringConstraintCode
    } & PredicateNodeAuthored<S>

/**
 * EXISTS condition.
 * Allowed only for subjects that have relations.
 */
export type ExistsConditionAuthored<S extends NodeSubjectCode = NodeSubjectCode>
  = S extends SubjectWithRelations ? ExistsConditionAuthoredInner<S> : never

/**
 * EXISTS condition with correlated relationCode → target subject typing.
 * The where clause uses a single-subject OR-of-AND body.
 */
export type ExistsConditionAuthoredInner<S extends SubjectWithRelations = SubjectWithRelations>
  = RelationCode<S> extends infer R
    ? R extends RelationCode<S> ? {
      id: string
      order: number
      kind: 'EXISTS'
      constraint: AuthoringConstraintCode
      relationCode: R
      where?: FacetBodyAuthored<RelationTargetSubject<S, R>>
    } & FacetRelationSelectionAuthored<S, R>
      : never
    : never
