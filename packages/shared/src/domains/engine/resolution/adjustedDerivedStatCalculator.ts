import type { CharacterMechanicSourceRef } from '../../character/sheetCalculation.js'
import { CHARACTER_CALCULATION_CONTRIBUTION_STATE } from '../../character/sheetCalculation.js'
import type {
  EngineCalculationBreakdowns,
  EngineDerivedStats,
  EngineProficiency,
  EngineSense
} from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import { resolveAbilityRecordKey } from './abilityKey.js'
import { resolveAdjustedAbilityAndSkillStats } from './adjustedAbilityAndSkillResolver.js'
import {
  resolveAdjustedMovement,
  resolveAdjustedSenses
} from './adjustedMovementAndSenseResolver.js'
import { resolveNumericCalculation, toCalculationOverride } from './calculationResolver.js'
import { calculateDerivedStats } from './derivedStatCalculator.js'
import { modifierContributions, type ResolvedModifierState } from './modifierResolver.js'

export interface AdjustedDerivedStatResult {
  derivedStats: EngineDerivedStats
  calculations: EngineCalculationBreakdowns
  senses: EngineSense[]
}

function resolveSpellcastingAbility(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): string | undefined {
  for (const classRecord of snapshot.classes) {
    const ability = registry.classes[classRecord.classId]?.spellcasting?.ability
    if (ability) return ability
  }
  return undefined
}

export function calculateAdjustedDerivedStats(
  snapshot: CharacterBuildSnapshot,
  modifierState: ResolvedModifierState,
  proficiencies: EngineProficiency[],
  senses: EngineSense[],
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem,
  activeEquipmentInstanceIds?: ReadonlySet<string>
): AdjustedDerivedStatResult {
  const authored = calculateDerivedStats(
    snapshot,
    modifierState.values,
    proficiencies,
    registry,
    rules,
    activeEquipmentInstanceIds
  )
  const abilityAndSkill = resolveAdjustedAbilityAndSkillStats(
    snapshot,
    modifierState,
    proficiencies,
    registry,
    rules,
    authored.abilityScores,
    authored.proficiencyBonus
  )
  const {
    proficiencyBonus,
    abilityScores,
    abilityModifiers,
    savingThrowProficiencyLevels,
    savingThrows,
    skillGoverningAbilities,
    skillProficiencyLevels,
    skillBonuses,
    passiveChecks
  } = abilityAndSkill
  const source: CharacterMechanicSourceRef = { kind: 'SYSTEM', systemId: snapshot.systemId }

  const hitPointAdjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'HIT_POINTS'
  )
  const hitPointModifier = hitPointAdjustments.find(
    (adjustment) => adjustment.field === 'MAXIMUM_MODIFIER'
  )
  const hitPointOverride = hitPointAdjustments.find(
    (adjustment) => adjustment.field === 'MAXIMUM_OVERRIDE'
  )
  const constitutionKey =
    resolveAbilityRecordKey(abilityModifiers, 'CONSTITUTION') ?? 'CONSTITUTION'
  const authoredConstitutionKey =
    resolveAbilityRecordKey(authored.abilityModifiers, 'CONSTITUTION') ?? 'CONSTITUTION'
  const constitutionHitPointDelta =
    ((abilityModifiers[constitutionKey]?.effective ?? 0) -
      (authored.abilityModifiers[authoredConstitutionKey] ?? 0)) *
    snapshot.hitpoints.length
  const maxHitPoints = resolveNumericCalculation(
    snapshot.hitpoints.reduce((total, entry) => total + entry.value, 0),
    [
      ...(constitutionHitPointDelta === 0
        ? []
        : [
            {
              id: 'hit-points:constitution-modifier-delta',
              source,
              value: constitutionHitPointDelta,
              state: CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
            }
          ]),
      ...modifierContributions(
        modifierState,
        (parsed) =>
          parsed.valueDomainCode === 'HIT_POINTS_MAX' && parsed.modifierKind !== 'SET_VALUE'
      ),
      ...(hitPointModifier && typeof hitPointModifier.value === 'number'
        ? [
            {
              id: hitPointModifier.id,
              source: { kind: 'MANUAL_ADJUSTMENT' as const, adjustmentId: hitPointModifier.id },
              value: hitPointModifier.value,
              state: CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
            }
          ]
        : [])
    ],
    hitPointOverride && typeof hitPointOverride.value === 'number'
      ? toCalculationOverride(hitPointOverride)
      : undefined
  )

  const dexterityKey = resolveAbilityRecordKey(abilityModifiers, 'DEXTERITY') ?? 'DEXTERITY'
  const oldDexterityKey =
    resolveAbilityRecordKey(authored.abilityModifiers, 'DEXTERITY') ?? 'DEXTERITY'
  const activeArmor = snapshot.equipmentItems.some(
    (item) =>
      item.equippedState?.slot === 'ARMOR' &&
      (!activeEquipmentInstanceIds || activeEquipmentInstanceIds.has(item.instanceId))
  )
  const armorModifierContributions = modifierContributions(
    modifierState,
    (parsed) => parsed.valueDomainCode === 'ARMOR_CLASS' && parsed.modifierKind !== 'SET_VALUE'
  )
  const armorModifierTotal = armorModifierContributions.reduce(
    (total, contribution) =>
      contribution.state === CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
        ? total + contribution.value
        : total,
    0
  )
  const adjustedAuthoredArmorClass =
    authored.armorClass +
    (activeArmor
      ? 0
      : (abilityModifiers[dexterityKey]?.effective ?? 0) -
        (authored.abilityModifiers[oldDexterityKey] ?? 0))
  const armorClass = resolveNumericCalculation(
    adjustedAuthoredArmorClass - armorModifierTotal,
    armorModifierContributions
  )
  const initiativeModifierContributions = modifierContributions(
    modifierState,
    (parsed) => parsed.valueDomainCode === 'INITIATIVE' && parsed.modifierKind !== 'SET_VALUE'
  )
  const initiative = resolveNumericCalculation(
    abilityModifiers[dexterityKey]?.effective ?? 0,
    initiativeModifierContributions
  )
  const movement = resolveAdjustedMovement(snapshot, registry, rules, modifierState)
  const resolvedSenses = resolveAdjustedSenses(snapshot, senses, modifierState)
  const spellcastingAbility = resolveSpellcastingAbility(snapshot, registry)
  const spellcastingAbilityKey = spellcastingAbility
    ? resolveAbilityRecordKey(abilityModifiers, spellcastingAbility)
    : undefined
  const spellModifier = spellcastingAbilityKey
    ? (abilityModifiers[spellcastingAbilityKey]?.effective ?? 0)
    : undefined
  const spellSaveDC =
    spellModifier === undefined
      ? undefined
      : resolveNumericCalculation(
          8 + proficiencyBonus.effective + spellModifier,
          modifierContributions(
            modifierState,
            (parsed) => parsed.valueDomainCode === 'SAVE_DC' && parsed.modifierKind !== 'SET_VALUE'
          )
        )
  const spellAttackBonus =
    spellModifier === undefined
      ? undefined
      : resolveNumericCalculation(
          proficiencyBonus.effective + spellModifier,
          modifierContributions(
            modifierState,
            (parsed) =>
              parsed.valueDomainCode === 'ATTACK_ROLL' &&
              parsed.params.attackDomain === 'SPELL' &&
              parsed.modifierKind !== 'SET_VALUE'
          )
        )
  const calculations: EngineCalculationBreakdowns = {
    proficiencyBonus,
    abilityScores,
    abilityModifiers,
    savingThrowProficiencyLevels,
    savingThrows,
    skillGoverningAbilities,
    skillProficiencyLevels,
    skillBonuses,
    passiveChecks,
    movementSpeeds: movement.calculations,
    senseRanges: resolvedSenses.calculations,
    initiative,
    armorClass,
    maxHitPoints,
    ...(spellSaveDC ? { spellSaveDC } : {}),
    ...(spellAttackBonus ? { spellAttackBonus } : {})
  }
  const derivedStats: EngineDerivedStats = {
    proficiencyBonus: proficiencyBonus.effective,
    abilityScores: Object.fromEntries(
      Object.entries(abilityScores).map(([key, calculation]) => [key, calculation.effective])
    ),
    abilityModifiers: Object.fromEntries(
      Object.entries(abilityModifiers).map(([key, calculation]) => [key, calculation.effective])
    ),
    savingThrows: Object.fromEntries(
      Object.entries(savingThrows).map(([key, calculation]) => [key, calculation.effective])
    ),
    skillBonuses: Object.fromEntries(
      Object.entries(skillBonuses).map(([key, calculation]) => [key, calculation.effective])
    ),
    skillGoverningAbilities: Object.fromEntries(
      Object.entries(skillGoverningAbilities).map(([key, calculation]) => [
        key,
        calculation.effective
      ])
    ),
    passiveChecks: Object.fromEntries(
      Object.entries(passiveChecks).map(([key, calculation]) => [key, calculation.effective])
    ),
    movementSpeeds: movement.speeds,
    ...(movement.primarySpeedId ? { primaryMovementSpeedId: movement.primarySpeedId } : {}),
    initiative: initiative.effective,
    armorClass: armorClass.effective,
    maxHitPoints: maxHitPoints.effective,
    ...(spellSaveDC ? { spellSaveDC: spellSaveDC.effective } : {}),
    ...(spellAttackBonus ? { spellAttackBonus: spellAttackBonus.effective } : {})
  }
  return { derivedStats, calculations, senses: resolvedSenses.senses }
}
