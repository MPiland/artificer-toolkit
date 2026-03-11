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
  conditions: readonly FacetConditionAuthored<S>[] // AND
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
 * A subject context block.
 * Conditions are AND-only within the subject.
 */
export type FacetContextAuthored<N extends NodeSubjectCode = NodeSubjectCode>
  = N extends NodeSubjectCode ? {
    id: string
    order: number
    subject: N
    conditions: readonly FacetConditionAuthored<N>[] // AND
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
