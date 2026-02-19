import type { Subject, ScopeKind, SubjectPayload, ScopeCode, ScopePayload } from '#core'

export type ScopeNode<
  S extends ScopeCode = ScopeCode
> = {
  scope: S
} & ScopePayload[S]

// Non-generic public type: union across subjects
export type TargetConditionAuthored = {
  [S in Subject]: {
    id: string
    order: number
    subjectCode: S
    targetKind: ScopeKind
    scopes: ScopeNode[]
  } & SubjectPayload[S]
}[Subject]

export type TargetGroupAuthored = {
  id: string
  conditions: TargetConditionAuthored[]
}

export type TargetGroupsAuthored = {
  id: string
  groups: TargetGroupAuthored[]
}
