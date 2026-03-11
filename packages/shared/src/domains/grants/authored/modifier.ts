import type {
  GRANT_KIND,
  ModifierScopeKind,
  ValueDomainCode,
  ModifierKindsByDomiain,
  AUTHORING_SELECTION_KIND,
  ValueDomainParam,
  ModifierPayloadByDomain,
  NodeSubjectCode
} from '#core'
import type { GrantBaseAuthored } from '#authored'

export type ModifierGrantAuthored<N extends NodeSubjectCode = NodeSubjectCode> = {
  [V in ValueDomainCode]: {
    grantKind: typeof GRANT_KIND.MODIFIER_GRANT
    valueDomainCode: V
    domain: ValueDomainParam<V>
    modifierKind: ModifierKindsByDomiain<V>
    scope: ModifierScopeKind
  }
  & (
    ModifierKindsByDomiain<V> extends infer K
      ? K extends ModifierKindsByDomiain<V>
        ? ModifierPayloadByDomain<V, K> extends infer P
          ? (P extends undefined ? { payload?: undefined } : { payload: P })
          : never
        : never
      : never
  )
  & GrantBaseAuthored<N>
  & (
    | { selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED }
    | { selectionKind: typeof AUTHORING_SELECTION_KIND.CHOSEN, count: number }
  )
}[ValueDomainCode]
