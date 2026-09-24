import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { resolveDnd5eCharacterAbilityBonuses } from './characterDerivedStats.js'
import type { CharacterResolvedModifierGroup } from './characterModifiers.js'

export function evaluateDnd5eCharacterVitals(
  input: CharacterRulePolicyInput,
  grantFold: CharacterGrantFoldOutput,
  modifierGroups: CharacterResolvedModifierGroup[],
  abilities: CharacterRulePolicyOutput['derivedStats']['abilities']
): Pick<CharacterRulePolicyOutput['derivedStats'], 'armorClass' | 'maxHitPoints'> &
  Pick<CharacterRulePolicyOutput, 'hitPointProgression'> {
  const modifierAt = (index: number | null | undefined) =>
    index == null ? 0 : (abilities[index]?.modifier.effective ?? 0)
  const equipment = (input.armorClassFacts?.equipment ?? []).filter((item) =>
    grantFold.activeEquipmentInstanceIds.includes(item.itemInstanceId)
  )
  const armor = equipment.filter((item) => item.category === 'ARMOR').at(-1)
  const shield = equipment.filter((item) => item.category === 'SHIELD').at(-1)
  const armorBase =
    (armor === undefined
      ? 10 + modifierAt(input.armorClassFacts?.dexterityAbilityIndex)
      : (armor.armorClass ?? 10)) + (shield === undefined ? 0 : (shield.armorClass ?? 2))
  const armorGroups = modifierGroups.filter((group) => group.valueDomainCode === 'ARMOR_CLASS')
  const armorClass: CharacterRulePolicyOutput['derivedStats']['armorClass'] = {
    base: armorBase,
    effective: armorBase + armorGroups.reduce((sum, group) => sum + group.effective, 0),
    contributions: armorGroups
      .filter((group) => group.modifierKind !== 'SET_VALUE')
      .flatMap((group) =>
        group.contributions.map((contribution) => ({
          sourceId: contribution.sourceId,
          source: contribution.source,
          value: contribution.value,
          state: contribution.state,
          reasonCode: contribution.reasonCode
        }))
      ),
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
            resolveDnd5eCharacterAbilityBonuses(constitution, modifierGroups)
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
      if (contribution.source === undefined)
        throw new Error('Hit point modifier provenance is missing.')
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
