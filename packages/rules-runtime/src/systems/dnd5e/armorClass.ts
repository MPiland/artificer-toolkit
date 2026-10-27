import type { ArmorClassResult } from '../../armorClassCapability.js'

/**
 * The one D&D armor class formula. The standard base is worn armor (its armor class plus the
 * ability bonuses it grants itself, such as light armor's Dexterity) or 10 + Dexterity unarmored.
 * Authored alternatives ("your AC equals 13 + DEX") compete with it and never stack: the best one
 * wins. A shield and flat bonuses then add.
 */
export function combineDnd5eArmorClass(input: {
  armor: { armorClass: number; abilityBonuses: readonly number[] } | null
  dexterityModifier: number
  setValues: readonly number[]
  shield: number
  additive: readonly number[]
}): { base: number; effective: number } {
  const standardBase =
    input.armor === null
      ? 10 + input.dexterityModifier
      : input.armor.abilityBonuses.reduce((sum, bonus) => sum + bonus, input.armor.armorClass)
  const base = Math.max(standardBase, ...input.setValues) + input.shield
  return { base, effective: input.additive.reduce((sum, value) => sum + value, base) }
}

/**
 * The one shield D&D armor class counts of those held in a hand (D107): the one that adds the most
 * (`addsOf`), the main hand's on a tie.
 */
export function selectDnd5eHeldShield<Shield>(
  held: readonly { inMainHand: boolean; shield: Shield }[],
  addsOf: (shield: Shield) => number
): Shield | null {
  const best = held.reduce<(typeof held)[number] | undefined>((chosen, candidate) => {
    if (chosen === undefined) return candidate
    const difference = addsOf(candidate.shield) - addsOf(chosen.shield)
    return difference > 0 || (difference === 0 && candidate.inMainHand) ? candidate : chosen
  }, undefined)
  return best?.shield ?? null
}

/**
 * An armor or shield's authored armor class, for Characters and Creatures alike (D143): one
 * without it is refused, never given a default.
 */
export function resolveDnd5eEquipmentArmorClass(
  equipmentId: string,
  armorClass: number | null | undefined
): ArmorClassResult {
  return armorClass == null
    ? {
        ok: false,
        equipmentId,
        reason: `Equipment "${equipmentId}" is armor or a shield without an armor class.`
      }
    : { ok: true, armorClass }
}

/** For consumers that must not continue with Equipment the armor class cannot evaluate. */
export function requireDnd5eArmorClass(result: ArmorClassResult | null): number {
  if (result === null) throw new Error('D&D armor class requires a Dexterity score.')
  if (!result.ok) throw new Error(result.reason)
  return result.armorClass
}
