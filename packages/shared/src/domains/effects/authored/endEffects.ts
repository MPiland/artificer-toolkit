import { EFFECT_KIND } from '#core'

/**
 * What an END_EFFECTS outcome matches on a held effect (D174, D182): it owns a condition the
 * selector names, or the spell that made it was cast at a level the selector admits. A
 * `SLOT_LEVEL` limit is the level the ending spell is itself cast at (Dispel Magic); a `FIXED`
 * limit is `level`. An effect cast from no spell never matches a spell-level selector.
 */
export type EndEffectsSelectorAuthored =
  | { kind: 'CONDITION'; conditionIds: string[] }
  | { kind: 'SPELL_LEVEL'; limit: 'SLOT_LEVEL' | 'FIXED'; level?: number }

/**
 * Ends the effects held on the target that any selector matches (Lesser Restoration, Dispel
 * Magic): `ALL` of them, or the `ONE_CHOSEN` the caster picks at cast. Effects linked to an ended
 * one end with it, and a condition only the ended effects held ends with them.
 */
export type EndEffectsAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.END_EFFECTS
  scope: 'ALL' | 'ONE_CHOSEN'
  selectors: EndEffectsSelectorAuthored[]
  /** Ends only effects whose origin creature is of one of these types (Break Enchantment: a fey, a fiend, an undead). */
  originCreatureTypeIds?: string[]
}
