import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'

import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eAcceptedModifierApplicability,
  dnd5eModifierApplies,
  type Dnd5eCastSpell
} from './modifierApplicability.js'

type ModifierFold = Pick<CharacterGrantFoldOutput, 'modifiers'>

/**
 * The range a Character's accepted grants give a cast of this spell, or null when none replaces its
 * own. Like every replacing modifier, the last one that applies wins. The Sheet's facts and the
 * Encounter's cast both read this, so their ranges cannot disagree.
 */
export function dnd5eSpellRangeReplacement(
  grantFold: ModifierFold,
  spell: Omit<Dnd5eCastSpell, 'damageTypeId'>
) {
  const target = { ...DND5E_CHARACTER_WIDE_TARGET, spell: { ...spell, damageTypeId: null } }
  return (
    grantFold.modifiers
      .flatMap((modifier) =>
        modifier.modifierKind === 'REPLACE_RANGE_KIND' &&
        modifier.payload &&
        'rangeKind' in modifier.payload &&
        dnd5eModifierApplies(dnd5eAcceptedModifierApplicability(modifier), target)
          ? [modifier.payload]
          : []
      )
      .at(-1) ?? null
  )
}

/** The Sheet's spell facts, with each spell at the range the Character's grants give it. */
export function dnd5eSpellFactsWithReplacedRanges(
  grantFold: ModifierFold,
  spellFacts: CharacterRulePolicyInput['spellActionFacts']
): CharacterRulePolicyInput['spellActionFacts'] {
  return spellFacts.map((spell) => {
    const replacement = dnd5eSpellRangeReplacement(grantFold, {
      id: spell.spellId,
      level: spell.level,
      magicSchoolId: spell.magicSchoolId
    })
    if (!replacement) return spell
    const { amount, unit } =
      replacement.rangeKind === 'DISTANCE' ? replacement : { amount: null, unit: null }
    const range = { rangeKind: replacement.rangeKind, amount, longAmount: null, unit }
    const withRange = <T extends (typeof spell.effects)[number]>(effect: T): T => ({
      ...effect,
      mechanicFacts: {
        ...effect.mechanicFacts,
        invocation: { ...effect.mechanicFacts.invocation, range }
      }
    })
    return {
      ...spell,
      effects: spell.effects.map(withRange),
      ...(spell.repeatedEffects && { repeatedEffects: spell.repeatedEffects.map(withRange) })
    }
  })
}
