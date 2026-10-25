import type { GRANT_KIND, NodeSubjectCode, SpellGrantAccess, SpellGrantAttribute } from '#core'
import type { ScalingGrant, ChargeAuthored, FacetAuthored } from '#authored'

/** What a grant adds to its casts (D156): a narrower target, a once-per-target lockout, a slot cost. */
type SpellGrantCastRules = {
  /** The creature types its casts may target, narrowing the spell's own targeting. */
  allowedCreatureTypeIds?: string[]
  /** Each creature a cast targets can't be targeted by this grant again until the caster's long rest. */
  perTargetLockout?: { until: 'SOURCE_LONG_REST' }
  /** Each cast also spends a slot of this System-supplied pool (D175); the cast's own charges still apply. */
  slotCost?: { poolCode: string }
  /** `CAST` (the default) gives the spells to cast; `CLASS_LIST_ONLY` only adds them to `classListIds` (D175). */
  access?: SpellGrantAccess
  /** The classes and subclasses whose spell lists the spells join; required by, and only for, `CLASS_LIST_ONLY`. */
  classListIds?: string[]
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
        castingAbility?: string
        attributes?: Exclude<SpellGrantAttribute, 'LIMITED_USE'>[]
        filters?: FacetAuthored<Extract<NodeSubjectCode, 'SPELL'>>
      }
    | {
        grantKind: typeof GRANT_KIND.SPELL_GRANT
        castAtLevel?: number
        castingAbility?: string
        charges?: ChargeAuthored<true>
        attributes?: SpellGrantAttribute[]
        filters?: FacetAuthored<Extract<NodeSubjectCode, 'SPELL'>>
      }
  )
