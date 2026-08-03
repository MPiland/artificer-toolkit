import type {
  CharacterCalculation,
  CharacterCalculationContribution
} from '../../character/sheetCalculation.js'
import { CHARACTER_CALCULATION_CONTRIBUTION_STATE } from '../../character/sheetCalculation.js'
import type { CharacterMechanicalAdjustment } from '../../character/sheetAdjustment.js'
import {
  createCharacterSpellSourceKey,
  type CharacterSpellSourceRef
} from '../../character/sheetResource.js'
import type {
  EngineCalculationBreakdowns,
  EngineCompanionStats,
  EngineItemMechanics,
  EngineSpellAccess,
  EngineSpellMechanics
} from '../contracts/engineState.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import { modifierContributions } from './adjustedDerivedStatCalculator.js'
import { resolveAbilityRecordKey } from './abilityKey.js'
import { resolveNumericCalculation, resolveSelectionCalculation } from './calculationResolver.js'
import type { ResolvedModifierState } from './modifierResolver.js'

type NumericMechanicalAdjustment = Extract<CharacterMechanicalAdjustment, { value: number }>

type ItemMechanicalAdjustment = Extract<CharacterMechanicalAdjustment, { family: 'ITEM' }>

type NumericItemAdjustment = Extract<ItemMechanicalAdjustment, { value: number }>

type CompanionMechanicalAdjustment = Extract<CharacterMechanicalAdjustment, { family: 'COMPANION' }>

type NumericCompanionAdjustment = Extract<CompanionMechanicalAdjustment, { value: number }>

type StringCompanionAdjustment = Extract<CompanionMechanicalAdjustment, { value: string }>

function manualContribution(
  adjustment: NumericMechanicalAdjustment
): CharacterCalculationContribution<number> {
  return {
    id: adjustment.id,
    source: {
      kind: 'MANUAL_ADJUSTMENT',
      adjustmentId: adjustment.id
    },
    value: adjustment.value,
    state: CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
  }
}

function numericOverride(
  adjustment: NumericMechanicalAdjustment | undefined
): CharacterCalculation<number>['override'] | undefined {
  return adjustment
    ? {
        adjustmentId: adjustment.id,
        value: adjustment.value
      }
    : undefined
}

function selectionOverride<T extends string>(
  adjustment: { id: string; value: T } | undefined
): CharacterCalculation<T>['override'] | undefined {
  return adjustment
    ? {
        adjustmentId: adjustment.id,
        value: adjustment.value
      }
    : undefined
}

function copyCalculationWithAdjustments(
  base: CharacterCalculation<number> | undefined,
  additive: NumericMechanicalAdjustment | undefined,
  override: NumericMechanicalAdjustment | undefined
): CharacterCalculation<number> {
  return resolveNumericCalculation(
    base?.base ?? 0,
    [
      ...(base?.contributions ?? []).map((contribution) => ({ ...contribution })),
      ...(additive ? [manualContribution(additive)] : [])
    ],
    numericOverride(override)
  )
}

function spellSourceForAccess(access: EngineSpellAccess): CharacterSpellSourceRef {
  return {
    spellId: access.spellId,
    sourceKind: 'FEATURE',
    sourceInstanceId: access.sourceInstanceId
  }
}

function resolveSourceSpellCalculation(
  calculations: EngineCalculationBreakdowns,
  modifierState: ResolvedModifierState,
  castingAbility: EngineSpellAccess['castingAbility'],
  kind: 'ATTACK_BONUS' | 'SAVE_DC'
): CharacterCalculation<number> | undefined {
  const fallback =
    kind === 'ATTACK_BONUS' ? calculations.spellAttackBonus : calculations.spellSaveDC
  if (!castingAbility) return fallback

  const abilityKey = resolveAbilityRecordKey(calculations.abilityModifiers, castingAbility)
  const abilityModifier = abilityKey
    ? calculations.abilityModifiers[abilityKey]?.effective
    : undefined
  if (abilityModifier === undefined) return fallback

  return resolveNumericCalculation(
    calculations.proficiencyBonus.effective + abilityModifier + (kind === 'SAVE_DC' ? 8 : 0),
    modifierContributions(modifierState, (parsed) =>
      kind === 'ATTACK_BONUS'
        ? parsed.valueDomainCode === 'ATTACK_ROLL' &&
          parsed.params.attackDomain === 'SPELL' &&
          parsed.modifierKind !== 'SET_VALUE'
        : parsed.valueDomainCode === 'SAVE_DC' && parsed.modifierKind !== 'SET_VALUE'
    )
  )
}

function resolveSpellMechanics(
  snapshot: CharacterBuildSnapshot,
  calculations: EngineCalculationBreakdowns,
  spellAccess: readonly EngineSpellAccess[],
  modifierState: ResolvedModifierState
): EngineSpellMechanics[] {
  const adjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'SPELL'
  )
  const accessSources = spellAccess.map((access) => ({
    access,
    source: spellSourceForAccess(access)
  }))
  const accessBySourceKey = new Map(
    accessSources.map(({ access, source }) => [createCharacterSpellSourceKey(source), access])
  )
  const sources = [
    ...(snapshot.spellSources ?? []),
    ...accessSources.map(({ source }) => source),
    ...adjustments.map((adjustment) => adjustment.source)
  ].filter(
    (source, index, all) =>
      all.findIndex(
        (candidate) =>
          createCharacterSpellSourceKey(candidate) === createCharacterSpellSourceKey(source)
      ) === index
  )

  return sources.map((source) => {
    const sourceKey = createCharacterSpellSourceKey(source)
    const access = accessBySourceKey.get(sourceKey)
    const targetAdjustments = adjustments.filter(
      (adjustment) => createCharacterSpellSourceKey(adjustment.source) === sourceKey
    )
    const attackBonus = targetAdjustments.find((adjustment) => adjustment.field === 'ATTACK_BONUS')
    const attackOverride = targetAdjustments.find(
      (adjustment) => adjustment.field === 'ATTACK_OVERRIDE'
    )
    const dcBonus = targetAdjustments.find((adjustment) => adjustment.field === 'DC_BONUS')
    const dcOverride = targetAdjustments.find((adjustment) => adjustment.field === 'DC_OVERRIDE')
    const damageBonus = targetAdjustments.find((adjustment) => adjustment.field === 'DAMAGE_BONUS')
    const baseAttackCalculation = resolveSourceSpellCalculation(
      calculations,
      modifierState,
      access?.castingAbility,
      'ATTACK_BONUS'
    )
    const baseSaveCalculation = resolveSourceSpellCalculation(
      calculations,
      modifierState,
      access?.castingAbility,
      'SAVE_DC'
    )
    const attackCalculation = baseAttackCalculation
      ? copyCalculationWithAdjustments(baseAttackCalculation, attackBonus, attackOverride)
      : undefined
    const saveCalculation = baseSaveCalculation
      ? copyCalculationWithAdjustments(baseSaveCalculation, dcBonus, dcOverride)
      : undefined
    const damageCalculation = resolveNumericCalculation(
      0,
      damageBonus ? [manualContribution(damageBonus)] : []
    )

    return {
      source: { ...source },
      ...(attackCalculation ? { attackBonus: attackCalculation.effective } : {}),
      ...(saveCalculation ? { saveDC: saveCalculation.effective } : {}),
      damageBonus: damageCalculation.effective,
      calculations: {
        ...(attackCalculation ? { attackBonus: attackCalculation } : {}),
        ...(saveCalculation ? { saveDC: saveCalculation } : {}),
        damageBonus: damageCalculation
      }
    }
  })
}

function resolveItemMechanics(snapshot: CharacterBuildSnapshot): EngineItemMechanics[] {
  const adjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'ITEM'
  )

  return snapshot.equipmentItems.map((item) => {
    const targetAdjustments = adjustments.filter(
      (adjustment) => adjustment.itemInstanceId === item.instanceId
    )
    const numericAdjustments = targetAdjustments.filter(
      (adjustment): adjustment is NumericItemAdjustment => typeof adjustment.value === 'number'
    )
    const attackBonus = numericAdjustments.find((adjustment) => adjustment.field === 'ATTACK_BONUS')
    const attackOverride = numericAdjustments.find(
      (adjustment) => adjustment.field === 'ATTACK_OVERRIDE'
    )
    const costOverride = numericAdjustments.find(
      (adjustment) => adjustment.field === 'COST_OVERRIDE'
    )
    const damageBonus = numericAdjustments.find((adjustment) => adjustment.field === 'DAMAGE_BONUS')
    const weightOverride = numericAdjustments.find(
      (adjustment) => adjustment.field === 'WEIGHT_OVERRIDE'
    )
    const attackCalculation = resolveNumericCalculation(
      0,
      attackBonus ? [manualContribution(attackBonus)] : [],
      numericOverride(attackOverride)
    )
    const damageCalculation = resolveNumericCalculation(
      0,
      damageBonus ? [manualContribution(damageBonus)] : []
    )
    const costCalculation =
      item.compiledItem.cost || costOverride
        ? resolveNumericCalculation(
            item.compiledItem.cost?.amount ?? 0,
            [],
            numericOverride(costOverride)
          )
        : undefined
    const weightCalculation =
      item.compiledItem.weight || weightOverride
        ? resolveNumericCalculation(
            item.compiledItem.weight?.amount ?? 0,
            [],
            numericOverride(weightOverride)
          )
        : undefined

    return {
      itemInstanceId: item.instanceId,
      attackBonus: attackCalculation.effective,
      ...(costCalculation ? { cost: costCalculation.effective } : {}),
      damageBonus: damageCalculation.effective,
      displayAsAttack: targetAdjustments.some(
        (adjustment) => adjustment.field === 'DISPLAY_AS_ATTACK'
      ),
      properties: {
        adamantine: targetAdjustments.some((adjustment) => adjustment.field === 'ADAMANTINE'),
        dualWield: targetAdjustments.some((adjustment) => adjustment.field === 'DUAL_WIELD'),
        silvered: targetAdjustments.some((adjustment) => adjustment.field === 'SILVERED')
      },
      ...(weightCalculation
        ? {
            weight: {
              amount: weightCalculation.effective,
              unit: item.compiledItem.weight?.unit ?? 'POUNDS'
            }
          }
        : {}),
      calculations: {
        attackBonus: attackCalculation,
        ...(costCalculation ? { cost: costCalculation } : {}),
        damageBonus: damageCalculation,
        ...(weightCalculation ? { weight: weightCalculation } : {})
      }
    }
  })
}

function resolveCompanions(snapshot: CharacterBuildSnapshot): EngineCompanionStats[] {
  const adjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'COMPANION'
  )

  return (snapshot.companions ?? []).map((companion) => {
    const targetAdjustments = adjustments.filter(
      (adjustment) => adjustment.companionInstanceId === companion.companionInstanceId
    )
    const numericAdjustments = targetAdjustments.filter(
      (adjustment): adjustment is NumericCompanionAdjustment => typeof adjustment.value === 'number'
    )
    const stringAdjustments = targetAdjustments.filter(
      (adjustment): adjustment is StringCompanionAdjustment => typeof adjustment.value === 'string'
    )
    const armorOverride = numericAdjustments.find(
      (adjustment) => adjustment.field === 'ARMOR_CLASS_OVERRIDE'
    )
    const hitPointOverride = numericAdjustments.find(
      (adjustment) => adjustment.field === 'MAXIMUM_HIT_POINTS_OVERRIDE'
    )
    const sizeOverride = stringAdjustments.find(
      (adjustment) => adjustment.field === 'SIZE_OVERRIDE'
    )
    const alignmentOverride = stringAdjustments.find(
      (adjustment) => adjustment.field === 'ALIGNMENT_OVERRIDE'
    )
    const creatureTypeOverride = stringAdjustments.find(
      (adjustment) => adjustment.field === 'CREATURE_TYPE_OVERRIDE'
    )
    const armorClass = resolveNumericCalculation(
      companion.armorClass,
      [],
      numericOverride(armorOverride)
    )
    const maxHitPoints = resolveNumericCalculation(
      companion.maxHitPoints,
      [],
      numericOverride(hitPointOverride)
    )
    const size =
      companion.size || sizeOverride
        ? resolveSelectionCalculation(
            companion.size ?? sizeOverride!.value,
            [],
            selectionOverride(sizeOverride)
          )
        : undefined
    const alignmentId =
      companion.alignmentId || alignmentOverride
        ? resolveSelectionCalculation(
            companion.alignmentId ?? alignmentOverride!.value,
            [],
            selectionOverride(alignmentOverride)
          )
        : undefined
    const creatureTypeId =
      companion.creatureTypeId || creatureTypeOverride
        ? resolveSelectionCalculation(
            companion.creatureTypeId ?? creatureTypeOverride!.value,
            [],
            selectionOverride(creatureTypeOverride)
          )
        : undefined

    return {
      companionInstanceId: companion.companionInstanceId,
      creatureId: companion.creatureId,
      abilityScores: { ...companion.abilityScores },
      armorClass: armorClass.effective,
      maxHitPoints: maxHitPoints.effective,
      ...(size ? { size: size.effective } : {}),
      ...(alignmentId ? { alignmentId: alignmentId.effective } : {}),
      ...(creatureTypeId ? { creatureTypeId: creatureTypeId.effective } : {}),
      calculations: {
        armorClass,
        maxHitPoints,
        ...(size ? { size } : {}),
        ...(alignmentId ? { alignmentId } : {}),
        ...(creatureTypeId ? { creatureTypeId } : {})
      }
    }
  })
}

export function resolveSheetSubjectMechanics(
  snapshot: CharacterBuildSnapshot,
  calculations: EngineCalculationBreakdowns,
  spellAccess: readonly EngineSpellAccess[],
  modifierState: ResolvedModifierState
): {
  spellMechanics: EngineSpellMechanics[]
  itemMechanics: EngineItemMechanics[]
  companions: EngineCompanionStats[]
} {
  return {
    spellMechanics: resolveSpellMechanics(snapshot, calculations, spellAccess, modifierState),
    itemMechanics: resolveItemMechanics(snapshot),
    companions: resolveCompanions(snapshot)
  }
}
