import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'

import type { CharacterResolvedModifierGroup } from './characterModifiers.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eFoldedModifierApplicability,
  dnd5eModifierApplies,
  type Dnd5eCastSpell
} from './modifierApplicability.js'

type Fold = Pick<CharacterGrantFoldOutput, 'modifiers'>

/**
 * How many Concentrations a Character keeps: 1 plus the `CONCENTRATION_CAPACITY` bonuses that apply
 * Character-wide. A bonus with a deferred requirement (a spell-level limit) cannot be judged without
 * a cast, so it is listed apart and counts per cast (`dnd5eConcentrationCapacityForCast`).
 */
export function evaluateDnd5eConcentrationCapacity(
  grantFold: Fold,
  modifierGroups: readonly CharacterResolvedModifierGroup[]
) {
  const bonuses = modifierGroups
    .filter(
      (group) =>
        group.valueDomainCode === 'CONCENTRATION_CAPACITY' && group.modifierKind === 'BONUS'
    )
    .flatMap((group) => group.contributions)
    .map((contribution) => ({
      acceptedModifierIndex: contribution.acceptedModifierIndex,
      value: contribution.value,
      applicability: dnd5eFoldedModifierApplicability(grantFold, contribution)
    }))
  return {
    concentrationCapacity:
      1 +
      bonuses
        .filter((bonus) => dnd5eModifierApplies(bonus.applicability, DND5E_CHARACTER_WIDE_TARGET))
        .reduce((sum, bonus) => sum + bonus.value, 0),
    gatedConcentrationCapacity: bonuses
      .filter((bonus) => bonus.applicability.deferredRequirements.length > 0)
      .map(({ acceptedModifierIndex, value }) => ({ acceptedModifierIndex, value }))
  }
}

/**
 * The Concentrations a cast lets its caster keep: the Character-wide capacity plus each gated bonus
 * whose requirement the new spell and every spell already held meet. A held Concentration that no
 * spell cast started has no spell, so it meets none.
 */
export function dnd5eConcentrationCapacityForCast(input: {
  policyOutput: Pick<
    CharacterRulePolicyOutput,
    'grantFold' | 'concentrationCapacity' | 'gatedConcentrationCapacity'
  >
  /** The spell being cast, at its cast level. */
  newSpell: Pick<Dnd5eCastSpell, 'id' | 'level'>
  /** The cast level of each Concentration already held, null where no spell cast started it. */
  heldSpellLevels: readonly (number | null)[]
}): number {
  const { policyOutput } = input
  const targets = [
    { id: input.newSpell.id, level: input.newSpell.level },
    ...input.heldSpellLevels.map((level) => ({ id: '', level }))
  ].map((spell) => ({
    ...DND5E_CHARACTER_WIDE_TARGET,
    spell: { ...spell, magicSchoolId: null, damageTypeId: null }
  }))
  return (
    policyOutput.concentrationCapacity +
    policyOutput.gatedConcentrationCapacity
      .filter((bonus) => {
        const applicability = dnd5eFoldedModifierApplicability(policyOutput.grantFold, bonus)
        return targets.every((target) => dnd5eModifierApplies(applicability, target))
      })
      .reduce((sum, bonus) => sum + bonus.value, 0)
  )
}
