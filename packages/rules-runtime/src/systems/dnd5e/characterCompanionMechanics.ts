import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

type Companions = CharacterRulePolicyOutput['companions']
type NumericCalculation = Companions[number]['calculations']['armorClass']
type CompanionAdjustment =
  CharacterRulePolicyInput['companionMechanicsFacts']['adjustments'][number]
type NumericAdjustment = Extract<CompanionAdjustment, { readonly value: number }>
type ManualSelection<Value extends string> = {
  readonly id: string
  readonly value: Value
}
type SelectionCalculation<Value extends string> = {
  readonly base: Value
  readonly effective: Value
  readonly contributions: []
  readonly override: {
    readonly sourceId: string
    readonly source: { readonly kind: 'MANUAL_ADJUSTMENT'; readonly adjustmentId: string }
    readonly value: Value
  } | null
}

function firstAdjustment<T extends CompanionAdjustment['field']>(
  adjustments: readonly CompanionAdjustment[],
  field: T
): Extract<CompanionAdjustment, { readonly field: T }> | undefined {
  return adjustments.find(
    (adjustment): adjustment is Extract<CompanionAdjustment, { readonly field: T }> =>
      adjustment.field === field
  )
}

function numericCalculation(
  base: number,
  override: NumericAdjustment | undefined
): NumericCalculation {
  return {
    base,
    effective: override?.value ?? base,
    contributions: [],
    override:
      override === undefined
        ? null
        : {
            sourceId: override.id,
            source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: override.id },
            value: override.value
          }
  }
}

function selectionCalculation<Value extends string>(
  base: Value | null,
  override: ManualSelection<Value> | undefined
): SelectionCalculation<Value> | null {
  if (base === null && override === undefined) return null
  const value = override?.value ?? base
  if (value === null) throw new Error('Companion selection calculation is missing a value.')
  return {
    base: base ?? override!.value,
    effective: value,
    contributions: [],
    override:
      override === undefined
        ? null
        : {
            sourceId: override.id,
            source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: override.id },
            value: override.value
          }
  }
}

export function evaluateDnd5eCharacterCompanionMechanics(
  input: CharacterRulePolicyInput
): Companions {
  return input.companionMechanicsFacts.companions.map((companion) => {
    const adjustments = input.companionMechanicsFacts.adjustments.filter(
      (adjustment) => adjustment.companionInstanceId === companion.companionInstanceId
    )
    const armorClassOverride = firstAdjustment(adjustments, 'ARMOR_CLASS_OVERRIDE')
    const maxHitPointsOverride = firstAdjustment(adjustments, 'MAXIMUM_HIT_POINTS_OVERRIDE')
    const sizeOverride = firstAdjustment(adjustments, 'SIZE_OVERRIDE')
    const alignmentOverride = firstAdjustment(adjustments, 'ALIGNMENT_OVERRIDE')
    const creatureTypeOverride = firstAdjustment(adjustments, 'CREATURE_TYPE_OVERRIDE')
    const armorClass = numericCalculation(companion.armorClass, armorClassOverride)
    const maxHitPoints = numericCalculation(companion.maxHitPoints, maxHitPointsOverride)
    const size = selectionCalculation(companion.size, sizeOverride)
    const alignmentId = selectionCalculation(companion.alignmentId, alignmentOverride)
    const creatureTypeId = selectionCalculation(companion.creatureTypeId, creatureTypeOverride)
    return {
      companionInstanceId: companion.companionInstanceId,
      creatureId: companion.creatureId,
      abilityScores: companion.abilityScores,
      armorClass: armorClass.effective,
      maxHitPoints: maxHitPoints.effective,
      ...(size === null ? {} : { size: size.effective }),
      ...(alignmentId === null ? {} : { alignmentId: alignmentId.effective }),
      ...(creatureTypeId === null ? {} : { creatureTypeId: creatureTypeId.effective }),
      calculations: {
        armorClass,
        maxHitPoints,
        ...(size === null ? {} : { size }),
        ...(alignmentId === null ? {} : { alignmentId }),
        ...(creatureTypeId === null ? {} : { creatureTypeId })
      }
    }
  })
}
