import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'

import { resolveDnd5eCharacterAbilityBonuses } from './characterDerivedStats.js'
import type { CharacterResolvedModifierGroup } from './characterModifiers.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eFoldedModifierApplicability,
  dnd5eModifierApplies,
  type Dnd5eModifierTarget
} from './modifierApplicability.js'

type ArmorClassEquipment = NonNullable<CharacterRulePolicyInput['armorClassFacts']>['equipment']

/** The one active shield D&D armor class counts, with its base armor class. */
export function resolveDnd5eActiveShield(
  equipment: ArmorClassEquipment,
  activeEquipmentInstanceIds: readonly string[]
): { itemInstanceId: string; armorClass: number } | null {
  const shield = equipment
    .filter(
      (item) =>
        item.category === 'SHIELD' && activeEquipmentInstanceIds.includes(item.itemInstanceId)
    )
    .at(-1)
  return shield === undefined
    ? null
    : { itemInstanceId: shield.itemInstanceId, armorClass: shield.armorClass ?? 2 }
}

/** The armor class a shield adds: its base value and the applied modifiers it owns (magic +N). */
export function resolveDnd5eShieldArmorClass(
  shield: { itemInstanceId: string; armorClass: number },
  armorClass: CharacterRulePolicyOutput['derivedStats']['armorClass']
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
        grantFold.activeEquipmentInstanceIds.includes(item.itemInstanceId)
    )
    .at(-1)
  const shield = resolveDnd5eActiveShield(equipment, grantFold.activeEquipmentInstanceIds)
  const shieldItem = equipment.find((item) => item.itemInstanceId === shield?.itemInstanceId)
  // Armor class evaluates the worn armor and the active shield: their own modifiers apply.
  const target: Dnd5eModifierTarget = {
    ...DND5E_CHARACTER_WIDE_TARGET,
    sourceIds: [armor, shieldItem].flatMap((item) =>
      item === undefined ? [] : [createCharacterMechanicSourceKey(item.source)]
    )
  }
  const applicable = modifierGroups
    .filter((group) => group.valueDomainCode === 'ARMOR_CLASS')
    .flatMap((group) =>
      group.contributions
        .filter((contribution) =>
          dnd5eModifierApplies(dnd5eFoldedModifierApplicability(grantFold, contribution), target)
        )
        .map((contribution) => ({ modifierKind: group.modifierKind, contribution }))
    )
  // "Your AC equals X" replaces the armor (or unarmored) value rather than adding to it; the
  // authored restriction says when it applies. With several, the best one is used. A shield adds.
  const replacement = applicable
    .filter((entry) => entry.modifierKind === 'SET_VALUE')
    .reduce<number | null>(
      (best, entry) => Math.max(best ?? Number.NEGATIVE_INFINITY, entry.contribution.value),
      null
    )
  const armorBase =
    (replacement ??
      (armor === undefined
        ? 10 + modifierAt(input.armorClassFacts?.dexterityAbilityIndex)
        : (armor.armorClass ?? 10))) + (shield?.armorClass ?? 0)
  const additive = applicable
    .filter((entry) => entry.modifierKind !== 'SET_VALUE')
    .map(({ contribution }) => ({
      sourceId: contribution.sourceId,
      source: contribution.source,
      value: contribution.value,
      state: contribution.state,
      reasonCode: contribution.reasonCode
    }))
  const armorClass: CharacterRulePolicyOutput['derivedStats']['armorClass'] = {
    base: armorBase,
    effective:
      armorBase +
      additive
        .filter((contribution) => contribution.state === 'APPLIED')
        .reduce((sum, contribution) => sum + contribution.value, 0),
    contributions: additive,
    override: null
  }
  const facts = input.hitPointFacts
  const hitPointProgression = (facts?.progression?.rows ?? []).map((row) => {
    const abilityModifier = modifierAt(row.abilityIndex)
    const value =
      row.die === null
        ? row.fallbackValue
        : facts?.progression?.method === 'FIXED' || row.level === 1
          ? Math.max((row.level === 1 ? row.die : Math.floor(row.die / 2) + 1) + abilityModifier, 1)
          : row.rollValue !== null
            ? Math.max(row.rollValue + abilityModifier, 1)
            : row.legacyOverrideValue !== null
              ? Math.max(row.legacyOverrideValue, 1)
              : Math.max(abilityModifier + 1, 1)
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
      : Math.floor(
          (constitution.baseScore +
            resolveDnd5eCharacterAbilityBonuses(constitution, grantFold, modifierGroups)
              .filter(
                (bonus) => bonus.source.kind !== 'MANUAL_ADJUSTMENT' && bonus.state === 'APPLIED'
              )
              .reduce((sum, bonus) => sum + bonus.value, 0) -
            10) /
            2
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
