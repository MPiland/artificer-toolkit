import { EFFECT_KIND } from '#core'

/**
 * Ends the effects held on the target that grant one of the named conditions (Lesser Restoration,
 * Remove Curse): `ALL` of them, or the `ONE_CHOSEN` the caster picks at cast. Effects linked to an
 * ended one end with it, and a condition only the ended effects held ends with them.
 */
export type EndEffectsAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.END_EFFECTS
  scope: 'ALL' | 'ONE_CHOSEN'
  conditionIds: string[]
  /** Ends only effects whose origin creature is of one of these types (Break Enchantment: a fey, a fiend, an undead). */
  originCreatureTypeIds?: string[]
}
