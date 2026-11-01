import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'

import { affordablePoolFor } from '../../character/characterResourcePool.js'
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
 * a cast, and one with uses spends them per cast, so both are listed apart and count per cast
 * (`dnd5eConcentrationCapacityForCast`).
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
      chargeId: grantFold.modifiers[contribution.acceptedModifierIndex]?.domain.usesChargeId,
      applicability: dnd5eFoldedModifierApplicability(grantFold, contribution)
    }))
  return {
    concentrationCapacity:
      1 +
      bonuses
        .filter(
          (bonus) =>
            bonus.chargeId === undefined &&
            dnd5eModifierApplies(bonus.applicability, DND5E_CHARACTER_WIDE_TARGET)
        )
        .reduce((sum, bonus) => sum + bonus.value, 0),
    gatedConcentrationCapacity: bonuses
      .filter(
        (bonus) => bonus.applicability.deferredRequirements.length > 0 || bonus.chargeId !== undefined
      )
      .map(({ acceptedModifierIndex, value, chargeId }) => ({
        acceptedModifierIndex,
        value,
        ...(chargeId !== undefined && { chargeId })
      }))
  }
}

/**
 * The Concentrations a cast lets its caster keep: the Character-wide capacity plus each gated bonus
 * whose requirement the new spell and every spell already held meet. A held Concentration that no
 * spell cast started has no spell, so it meets none. When the holder already keeps that many, the
 * first bonus with uses that applies and has a use left makes room for one more, and the cast pays
 * that charge's pool (`use`); `usesAvailable` is false where the cast cannot pay one.
 */
export function dnd5eConcentrationCapacityForCast(input: {
  policyOutput: Pick<
    CharacterRulePolicyOutput,
    'grantFold' | 'concentrationCapacity' | 'gatedConcentrationCapacity' | 'resources'
  >
  /** The spell being cast, at its cast level. */
  newSpell: Pick<Dnd5eCastSpell, 'id' | 'level'>
  /** The cast level of each Concentration already held, null where no spell cast started it. */
  heldSpellLevels: readonly (number | null)[]
  usesAvailable: boolean
}): { capacity: number; use: { poolId: string; chargeId: string } | null } {
  const { policyOutput } = input
  const targets = [
    { id: input.newSpell.id, level: input.newSpell.level },
    ...input.heldSpellLevels.map((level) => ({ id: '', level }))
  ].map((spell) => ({
    ...DND5E_CHARACTER_WIDE_TARGET,
    spell: { ...spell, magicSchoolId: null, damageTypeId: null }
  }))
  const applying = policyOutput.gatedConcentrationCapacity.filter((bonus) =>
    targets.every((target) =>
      dnd5eModifierApplies(
        dnd5eFoldedModifierApplicability(policyOutput.grantFold, bonus),
        target
      )
    )
  )
  const capacity =
    policyOutput.concentrationCapacity +
    applying.filter(({ chargeId }) => chargeId === undefined).reduce((sum, { value }) => sum + value, 0)
  if (!input.usesAvailable || input.heldSpellLevels.length < capacity) return { capacity, use: null }
  for (const { chargeId, value } of applying) {
    if (chargeId === undefined) continue
    const pool = affordablePoolFor(policyOutput.resources, { chargeId, cost: 1 })
    if (pool) return { capacity: capacity + value, use: { poolId: pool.poolId, chargeId } }
  }
  return { capacity, use: null }
}
