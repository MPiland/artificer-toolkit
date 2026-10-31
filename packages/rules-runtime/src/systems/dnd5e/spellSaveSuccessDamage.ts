import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eAcceptedModifierApplicability,
  dnd5eModifierApplies,
  type Dnd5eCastSpell
} from './modifierApplicability.js'

type ModifierFold = Pick<CharacterGrantFoldOutput, 'modifiers'>
type Entry = Extract<CompiledEffectGroup['entries'][number], { outcome: unknown }>

/** Whether a Character's grants give a cast of this spell a success path for damage of this type. */
function savedDamageApplies(
  grantFold: ModifierFold,
  spell: Omit<Dnd5eCastSpell, 'damageTypeId'>,
  damageTypeId: string | null
): boolean {
  const target = { ...DND5E_CHARACTER_WIDE_TARGET, spell: { ...spell, damageTypeId } }
  return grantFold.modifiers.some(
    (modifier) =>
      modifier.modifierKind === 'SAVE_SUCCESS_DAMAGE' &&
      modifier.payload &&
      'amountKind' in modifier.payload &&
      modifier.payload.amountKind === 'HALF' &&
      dnd5eModifierApplies(dnd5eAcceptedModifierApplicability(modifier), target)
  )
}

/**
 * A spell effect that deals damage when its target fails a save and has no success path of its own,
 * given the success path a Character's grants add: its damage at the modifier's fraction, and
 * nothing else of the failure. Only a damage entry the grants' spell facets accept is carried over;
 * the effect is returned unchanged when none is.
 */
export function dnd5eWithSaveSuccessDamage<TEffect extends CompiledEffectGroup>(
  grantFold: ModifierFold,
  spell: Omit<Dnd5eCastSpell, 'damageTypeId'>,
  effect: TEffect
): TEffect {
  const entries = effect.entries.filter((entry): entry is Entry => 'outcome' in entry)
  if (entries.some((entry) => entry.pathCode === 'ON_SAVE_SUCCESS')) return effect
  const successPathOrder = Math.max(...entries.map((entry) => entry.pathOrder)) + 1
  const carried = entries.flatMap((entry): Entry[] => {
    const { outcome } = entry
    if (
      entry.pathCode !== 'ON_SAVE_FAIL' ||
      entry.resolutionKind !== 'DIRECT' ||
      outcome.effectKind !== 'DAMAGE' ||
      outcome.amountKind !== undefined
    )
      return []
    const applies = savedDamageApplies(grantFold, spell, outcome.damageTypeId ?? null)
    if (!applies) return []
    const {
      lifecycle: _lifecycle,
      failureMarginRider: _failureMarginRider,
      gate: _gate,
      usage: _usage,
      usageKey: _usageKey,
      hitPointTier: _hitPointTier,
      duration: _duration,
      ...damage
    } = entry
    return [
      {
        ...damage,
        id: `${entry.id}:save-success`,
        entryId: `${entry.entryId}:save-success`,
        resultBlockId: `${entry.resultBlockId}:save-success`,
        pathGroupId: `${entry.pathGroupId}:save-success`,
        pathCode: 'ON_SAVE_SUCCESS',
        pathOrder: successPathOrder,
        groupKind: 'SINGLE',
        outcome: { ...outcome, amountKind: 'HALF' }
      }
    ]
  })
  return carried.length === 0 ? effect : { ...effect, entries: [...effect.entries, ...carried] }
}

/**
 * The Sheet's spell facts with the success path the same grants add to a cast (see
 * `dnd5eWithSaveSuccessDamage`), so a spell's listed damage and its cast agree.
 */
export function dnd5eSpellFactsWithSaveSuccessDamage(
  grantFold: ModifierFold,
  spellFacts: CharacterRulePolicyInput['spellActionFacts']
): CharacterRulePolicyInput['spellActionFacts'] {
  return spellFacts.map((spell) => {
    const withSuccessPath = <T extends (typeof spell.effects)[number]>(effect: T): T => {
      const { outcomes } = effect.mechanicFacts
      if (outcomes.some((outcome) => outcome.pathCode === 'ON_SAVE_SUCCESS')) return effect
      const carried = outcomes.flatMap((outcome) =>
        outcome.kind === 'DAMAGE' &&
        outcome.pathCode === 'ON_SAVE_FAIL' &&
        outcome.amountKind === null &&
        savedDamageApplies(
          grantFold,
          { id: spell.spellId, level: spell.level, magicSchoolId: spell.magicSchoolId },
          outcome.damageTypeId
        )
          ? [
              {
                ...outcome,
                outcomeId: `${outcome.outcomeId}:save-success`,
                pathCode: 'ON_SAVE_SUCCESS' as const,
                amountKind: 'HALF' as const
              }
            ]
          : []
      )
      return carried.length === 0
        ? effect
        : {
            ...effect,
            mechanicFacts: { ...effect.mechanicFacts, outcomes: [...outcomes, ...carried] }
          }
    }
    return {
      ...spell,
      effects: spell.effects.map(withSuccessPath),
      ...(spell.repeatedEffects && { repeatedEffects: spell.repeatedEffects.map(withSuccessPath) })
    }
  })
}
