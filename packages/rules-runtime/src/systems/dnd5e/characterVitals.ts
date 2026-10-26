import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import { isHandSlot } from '@artificer-toolkit/shared/core'

import type { ArmorClassCapabilityAdapter } from '../../armorClassCapability.js'
import { abilityModifier } from './abilityModifier.js'
import {
  combineDnd5eArmorClass,
  requireDnd5eArmorClass,
  resolveDnd5eCreatureArmorClass,
  resolveDnd5eEquipmentArmorClass,
  selectDnd5eHeldShield
} from './armorClass.js'
import { resolveDnd5eCharacterAbilityBonuses } from './characterDerivedStats.js'
import type { CharacterResolvedModifierGroup } from './characterModifiers.js'
import { hitPointGain } from './hitPointRules.js'
import { DND5E_SYSTEM_ID } from './identity.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eFoldedModifierApplicability,
  dnd5eModifierApplies,
  type Dnd5eModifierTarget
} from './modifierApplicability.js'

type ArmorClassEquipment = NonNullable<CharacterRulePolicyInput['armorClassFacts']>['equipment']

type ActiveShield = { itemInstanceId: string; armorClass: number }

/**
 * The armor class one armor or shield item offers: its authored one (refused when missing, D143)
 * less the corrosion on it. The only reader of an item's armor class degradation.
 */
function equipmentArmorClass(item: ArmorClassEquipment[number]): number {
  return Math.max(
    0,
    requireDnd5eArmorClass(
      resolveDnd5eEquipmentArmorClass(item.source.equipmentId, item.armorClass)
    ) - (item.degradation ?? 0)
  )
}

/**
 * The one active shield D&D armor class counts, with its base armor class (D107). A shield counts
 * only while a hand holds it, and only one counts: the one that adds the most (`armorClassOf`),
 * the main hand's on a tie.
 */
export function resolveDnd5eActiveShield(
  equipment: ArmorClassEquipment,
  activeEquipmentInstanceIds: readonly string[],
  armorClassOf: (shield: ActiveShield) => number
): ActiveShield | null {
  const held = equipment
    .filter(
      (item) =>
        item.category === 'SHIELD' &&
        isHandSlot(item.equippedSlot) &&
        activeEquipmentInstanceIds.includes(item.itemInstanceId)
    )
    .map((item) => ({
      inMainHand: item.equippedSlot === 'MAIN_HAND',
      shield: { itemInstanceId: item.itemInstanceId, armorClass: equipmentArmorClass(item) }
    }))
  return selectDnd5eHeldShield(held, armorClassOf)
}

/** The armor class a shield adds: its base value and the applied modifiers it owns (magic +N). */
export function resolveDnd5eShieldArmorClass(
  shield: ActiveShield,
  armorClass: Pick<CharacterRulePolicyOutput['derivedStats']['armorClass'], 'contributions'>
): number {
  return armorClass.contributions
    .filter(
      (contribution) =>
        contribution.state === 'APPLIED' &&
        contribution.source.kind === 'EQUIPMENT_INSTANCE' &&
        contribution.source.itemInstanceId === shield.itemInstanceId
    )
    .reduce((sum, contribution) => sum + contribution.value, shield.armorClass)
}

export const dnd5eArmorClassCapabilityAdapter: ArmorClassCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  creatureArmorClass: ({ abilityScores, naturalArmorBonus, equipment }) => {
    const dexterityScore = abilityScores.DEXTERITY
    return dexterityScore === undefined
      ? null
      : resolveDnd5eCreatureArmorClass({ dexterityScore, naturalArmorBonus, equipment })
  },
  countedShield: ({ equipment, activeEquipmentInstanceIds, armorClass }) => {
    const addsOf = (shield: ActiveShield) => resolveDnd5eShieldArmorClass(shield, armorClass)
    const shield = resolveDnd5eActiveShield(equipment, activeEquipmentInstanceIds, addsOf)
    return shield && { itemInstanceId: shield.itemInstanceId, armorClass: addsOf(shield) }
  }
}

export function evaluateDnd5eCharacterVitals(
  input: CharacterRulePolicyInput,
  grantFold: CharacterGrantFoldOutput,
  modifierGroups: CharacterResolvedModifierGroup[],
  abilities: CharacterRulePolicyOutput['derivedStats']['abilities']
): Pick<CharacterRulePolicyOutput['derivedStats'], 'armorClass' | 'maxHitPoints'> &
  Pick<CharacterRulePolicyOutput, 'hitPointProgression'> {
  const modifierAt = (index: number | null | undefined) =>
    index == null ? 0 : (abilities[index]?.modifier.effective ?? 0)
  const equipment = input.armorClassFacts?.equipment ?? []
  const armor = equipment
    .filter(
      (item) =>
        item.category === 'ARMOR' &&
        item.equippedSlot === 'WORN' &&
        grantFold.activeEquipmentInstanceIds.includes(item.itemInstanceId)
    )
    .at(-1)
  // Armor class evaluates the worn armor and the active shield: their own modifiers apply.
  const applicableWith = (shieldItemInstanceId: string | undefined) => {
    const shieldItem = equipment.find((item) => item.itemInstanceId === shieldItemInstanceId)
    const target: Dnd5eModifierTarget = {
      ...DND5E_CHARACTER_WIDE_TARGET,
      sourceIds: [armor, shieldItem].flatMap((item) =>
        item === undefined ? [] : [createCharacterMechanicSourceKey(item.source)]
      )
    }
    return modifierGroups
      .filter((group) => group.valueDomainCode === 'ARMOR_CLASS')
      .flatMap((group) =>
        group.contributions
          .filter((contribution) =>
            dnd5eModifierApplies(dnd5eFoldedModifierApplicability(grantFold, contribution), target)
          )
          .map((contribution) => ({ modifierKind: group.modifierKind, contribution }))
      )
  }
  // A creature uses one armor class calculation: worn armor (its base plus its own ability bonus,
  // such as light armor's DEX), 10 + DEX unarmored, or an authored formula ("your AC equals
  // 13 + DEX") whose restriction says when it applies. The best applicable one wins; they never
  // stack. A shield and flat bonuses then add.
  const isArmorFormulaPart = (entry: ReturnType<typeof applicableWith>[number]) =>
    armor !== undefined &&
    (entry.modifierKind === 'ABILITY_MODIFIER_BONUS' ||
      entry.modifierKind === 'OPTIONAL_ABILITY_MODIFIER_BONUS') &&
    entry.contribution.source.kind === 'EQUIPMENT_INSTANCE' &&
    entry.contribution.source.itemInstanceId === armor.itemInstanceId
  const additiveOf = (applicable: ReturnType<typeof applicableWith>) =>
    applicable
      .filter((entry) => entry.modifierKind !== 'SET_VALUE' && !isArmorFormulaPart(entry))
      .map(({ contribution }) => ({
        sourceId: contribution.sourceId,
        source: contribution.source,
        value: contribution.value,
        state: contribution.state,
        reasonCode: contribution.reasonCode
      }))
  // Of two held shields the one adding the most counts, judged with its own modifiers applied.
  const shield = resolveDnd5eActiveShield(
    equipment,
    grantFold.activeEquipmentInstanceIds,
    (candidate) =>
      resolveDnd5eShieldArmorClass(candidate, {
        contributions: additiveOf(applicableWith(candidate.itemInstanceId))
      })
  )
  const applicable = applicableWith(shield?.itemInstanceId)
  const additive = additiveOf(applicable)
  const combined = combineDnd5eArmorClass({
    armor:
      armor === undefined
        ? null
        : {
            armorClass: equipmentArmorClass(armor),
            abilityBonuses: applicable
              .filter(
                (entry) => isArmorFormulaPart(entry) && entry.contribution.state === 'APPLIED'
              )
              .map((entry) => entry.contribution.value)
          },
    dexterityModifier: modifierAt(input.armorClassFacts?.dexterityAbilityIndex),
    setValues: applicable
      .filter((entry) => entry.modifierKind === 'SET_VALUE')
      .map((entry) => entry.contribution.value),
    shield: shield?.armorClass ?? 0,
    additive: additive
      .filter((contribution) => contribution.state === 'APPLIED')
      .map((contribution) => contribution.value)
  })
  const armorClass: CharacterRulePolicyOutput['derivedStats']['armorClass'] = {
    base: combined.base,
    effective: combined.effective,
    contributions: additive,
    override: null
  }
  const facts = input.hitPointFacts
  const hitPointProgression = (facts?.progression?.rows ?? []).map((row) => {
    const value =
      row.die === null
        ? row.fallbackValue
        : hitPointGain({
            die: row.die,
            characterLevel: row.level,
            fixed: facts?.progression?.method === 'FIXED',
            roll: row.rollValue,
            modifier: modifierAt(facts?.constitutionAbilityIndex)
          })
    return {
      sequence: row.sequence,
      level: row.level,
      classId: row.classId,
      classLevel: row.classLevel,
      value
    }
  })
  const hitPointBase =
    facts === undefined
      ? 0
      : (facts.progression === null ? facts.rows : hitPointProgression).reduce(
          (sum, row) => sum + row.value,
          0
        )
  const constitutionIndex = facts?.constitutionAbilityIndex
  const constitution =
    constitutionIndex == null ? undefined : input.derivedBaseFacts.abilities[constitutionIndex]
  const authoredConstitution =
    constitution === undefined
      ? 0
      : abilityModifier(
          constitution.baseScore +
            resolveDnd5eCharacterAbilityBonuses(constitution, grantFold, modifierGroups)
              .filter(
                (bonus) => bonus.source.kind !== 'MANUAL_ADJUSTMENT' && bonus.state === 'APPLIED'
              )
              .reduce((sum, bonus) => sum + bonus.value, 0)
        )
  const constitutionDelta =
    facts === undefined || facts.progression !== null
      ? 0
      : (modifierAt(constitutionIndex) - authoredConstitution) * facts.rows.length
  const hitPointContributions: CharacterRulePolicyOutput['derivedStats']['maxHitPoints']['contributions'] =
    []
  if (constitutionDelta !== 0)
    hitPointContributions.push({
      sourceId: 'hit-points:constitution-modifier-delta',
      source: { kind: 'SYSTEM', systemId: input.grantFoldFacts.base.systemId },
      value: constitutionDelta,
      state: 'APPLIED',
      reasonCode: 'APPLIED'
    })
  for (const group of modifierGroups) {
    if (group.valueDomainCode !== 'HIT_POINTS_MAX' || group.modifierKind === 'SET_VALUE') continue
    for (const contribution of group.contributions) {
      if (
        !dnd5eModifierApplies(
          dnd5eFoldedModifierApplicability(grantFold, contribution),
          DND5E_CHARACTER_WIDE_TARGET
        )
      )
        continue
      hitPointContributions.push({
        sourceId: contribution.sourceId,
        source: contribution.source,
        value: contribution.value,
        state: contribution.state,
        reasonCode: contribution.reasonCode
      })
    }
  }
  if (facts?.manualMaximumModifier != null)
    hitPointContributions.push({
      ...facts.manualMaximumModifier,
      state: 'APPLIED',
      reasonCode: 'APPLIED'
    })
  const override = facts?.manualMaximumOverride ?? null
  const maxHitPoints: CharacterRulePolicyOutput['derivedStats']['maxHitPoints'] = {
    base: hitPointBase,
    effective:
      override?.value ??
      hitPointBase +
        hitPointContributions
          .filter((contribution) => contribution.state === 'APPLIED')
          .reduce((sum, contribution) => sum + contribution.value, 0),
    contributions: hitPointContributions.map((contribution) => ({
      ...contribution,
      state: override === null ? contribution.state : 'SUPPRESSED',
      reasonCode: override === null ? contribution.reasonCode : 'SUPPRESSED_BY_OVERRIDE'
    })),
    override
  }
  return { armorClass, maxHitPoints, hitPointProgression }
}
