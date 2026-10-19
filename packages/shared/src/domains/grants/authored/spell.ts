import type { AbilityCode, GRANT_KIND, NodeSubjectCode, SpellGrantAttribute } from '#core'
import type { ScalingGrant, ChargeAuthored, FacetAuthored } from '#authored'

/** What an at-will grant adds to its casts (D156): a narrower target and a once-per-target lockout. */
type SpellGrantCastRules = {
  /** The creature types its casts may target, narrowing the spell's own targeting. */
  allowedCreatureTypeIds?: string[]
  /** Each creature a cast targets can't be targeted by this grant again until the caster's long rest. */
  perTargetLockout?: { until: 'SOURCE_LONG_REST' }
}

export type SpellGrantAuthored<N extends NodeSubjectCode = NodeSubjectCode> = ScalingGrant<
  { spellIds: string[] },
  N
> &
  SpellGrantCastRules &
  (
    | {
        grantKind: typeof GRANT_KIND.SPELL_GRANT
        castAtLevel?: number
        castingAbility?: AbilityCode
        attributes?: Exclude<SpellGrantAttribute, 'LIMITED_USE'>[]
        filters?: FacetAuthored<Extract<NodeSubjectCode, 'SPELL'>>
      }
    | {
        grantKind: typeof GRANT_KIND.SPELL_GRANT
        castAtLevel?: number
        castingAbility?: AbilityCode
        charges?: ChargeAuthored<true>
        attributes?: SpellGrantAttribute[]
        filters?: FacetAuthored<Extract<NodeSubjectCode, 'SPELL'>>
      }
  )
