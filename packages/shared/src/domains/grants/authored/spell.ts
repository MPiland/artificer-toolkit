import type { GRANT_KIND, NodeSubjectCode, SpellGrantAttribute } from '#core'
import type { ScalingGrant, ChargeAuthored, FacetAuthored } from '#authored'

export type SpellGrantAuthored<N extends NodeSubjectCode = NodeSubjectCode> = ScalingGrant<
  { spellIds: string[] },
  N
> &
  (
    | {
        grantKind: typeof GRANT_KIND.SPELL_GRANT
        castAtLevel?: number
        attributes?: Exclude<SpellGrantAttribute, 'LIMITED_USE'>[]
        filters?: FacetAuthored<Extract<NodeSubjectCode, 'SPELL'>>
      }
    | {
        grantKind: typeof GRANT_KIND.SPELL_GRANT
        castAtLevel?: number
        charges?: ChargeAuthored
        attributes?: SpellGrantAttribute[]
        filters?: FacetAuthored<Extract<NodeSubjectCode, 'SPELL'>>
      }
  )
