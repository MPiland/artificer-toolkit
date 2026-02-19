import type {
  GRANT_KIND,
  ModifierScopeKind,
  ValueDomainCode,
  ModifierKindsByDomiain,
  ModifierValuePayload,
  AUTHORING_SELECTION_KIND
} from '#core'
import type { GrantBaseAuthored, TargetGroupsAuthored } from '#authored'

export type ModifierGrantAuthored = {
  [V in ValueDomainCode]: {
    grantKind: typeof GRANT_KIND.MODIFIER_GRANT
    valueDomainCode: V
    modifierKind: ModifierKindsByDomiain<V>
    scope: ModifierScopeKind
    targetGroups?: TargetGroupsAuthored
  } & ModifierValuePayload<ModifierKindsByDomiain<V>>
  & GrantBaseAuthored
  & (
    | {
      selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED
    }
    | {
      selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN
      count: number
    }
    )
}[ValueDomainCode]
