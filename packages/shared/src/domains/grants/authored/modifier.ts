import type {
  GRANT_KIND,
  ModifierScopeKind,
  ValueDomainCode,
  ModifierKindsByDomain,
  AUTHORING_SELECTION_KIND,
  ModifierDomainFor,
  ModifierPayloadFor,
  NodeSubjectCode
} from '#core'
import type { GrantBaseAuthored } from '#authored'

/** One value domain's modifier grants, one member per modifier kind with that kind's payload. */
export type ModifierGrantAuthoredFor<
  V extends ValueDomainCode,
  N extends NodeSubjectCode = NodeSubjectCode
> =
  ModifierKindsByDomain<V> extends infer K
    ? K extends ModifierKindsByDomain<V>
      ? {
          grantKind: typeof GRANT_KIND.MODIFIER_GRANT
          valueDomainCode: V
          domain: ModifierDomainFor<V, K>
          modifierKind: K
          scope: ModifierScopeKind
        } & (ModifierPayloadFor<V, K> extends infer P
          ? P extends undefined
            ? { payload?: undefined }
            : { payload: P }
          : never) &
          GrantBaseAuthored<N> & { selectionKind: typeof AUTHORING_SELECTION_KIND.GRANTED }
      : never
    : never

export type ModifierGrantAuthored<N extends NodeSubjectCode = NodeSubjectCode> = {
  [V in ValueDomainCode]: ModifierGrantAuthoredFor<V, N>
}[ValueDomainCode]
