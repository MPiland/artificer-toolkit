import { ScopeNode, type TargetConditionAuthored } from '#authored'
import { SCOPE_OPTIONS, SUBJECT_ALLOWED_SCOPES, SUBJECT_OPTIONS } from '#core'
import { buildNodeMap } from '#util'
import { AllUnionFields } from 'type-fest'

const scope = buildNodeMap<ScopeNode, TargetConditionAuthored>()

const SCOPE_NODE_MAP = scope.define((map, { field }) => map({
  scope: {
    kind: 'INPUT',
    label: 'Scope',
    type: 'SELECT_SINGLE',
    source: {
      kind: 'INLINE',
      options: SCOPE_OPTIONS
    }
  }
}))

const target = buildNodeMap<TargetConditionAuthored>()

const TARGET_NODE_MAP = target.define((map, { field, and }) => map({
  subjectCode: {
    kind: 'INPUT',
    type: 'SELECT_SINGLE',
    source: {
      kind: 'INLINE',
      options: SUBJECT_OPTIONS
    },
    requiredIf: true
  }
}))
