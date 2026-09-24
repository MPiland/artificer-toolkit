import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

type ItemMechanics = CharacterRulePolicyOutput['itemMechanics']
type NumericCalculation = ItemMechanics[number]['calculations']['attackBonus']
type NumericContribution = NumericCalculation['contributions'][number]
type ItemAdjustment = CharacterRulePolicyInput['itemMechanicsFacts']['adjustments'][number]
type NumericItemAdjustment = Extract<ItemAdjustment, { readonly value: number }>

function firstNumericAdjustment(
  adjustments: readonly ItemAdjustment[],
  field: NumericItemAdjustment['field']
): NumericItemAdjustment | undefined {
  return adjustments.find(
    (adjustment): adjustment is NumericItemAdjustment => adjustment.field === field
  )
}

function calculation(
  base: number,
  bonus: NumericItemAdjustment | undefined,
  override: NumericItemAdjustment | undefined
): NumericCalculation {
  const resolvedOverride =
    override === undefined
      ? null
      : {
          sourceId: override.id,
          source: { kind: 'MANUAL_ADJUSTMENT' as const, adjustmentId: override.id },
          value: override.value
        }
  const contributions: NumericContribution[] =
    bonus === undefined
      ? []
      : [
          {
            sourceId: bonus.id,
            source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: bonus.id },
            value: bonus.value,
            state: override === undefined ? 'APPLIED' : 'SUPPRESSED',
            reasonCode: override === undefined ? 'APPLIED' : 'SUPPRESSED_BY_OVERRIDE'
          }
        ]
  return {
    base,
    effective: override === undefined ? base + (bonus?.value ?? 0) : override.value,
    contributions,
    override: resolvedOverride
  }
}

export function evaluateDnd5eCharacterItemMechanics(
  input: CharacterRulePolicyInput
): ItemMechanics {
  return input.itemMechanicsFacts.items.map((item) => {
    const adjustments = input.itemMechanicsFacts.adjustments.filter(
      (adjustment) => adjustment.itemInstanceId === item.itemInstanceId
    )
    const attackBonus = firstNumericAdjustment(adjustments, 'ATTACK_BONUS')
    const attackOverride = firstNumericAdjustment(adjustments, 'ATTACK_OVERRIDE')
    const costOverride = firstNumericAdjustment(adjustments, 'COST_OVERRIDE')
    const damageBonus = firstNumericAdjustment(adjustments, 'DAMAGE_BONUS')
    const weightOverride = firstNumericAdjustment(adjustments, 'WEIGHT_OVERRIDE')
    const attackCalculation = calculation(0, attackBonus, attackOverride)
    const damageCalculation = calculation(0, damageBonus, undefined)
    const costCalculation =
      item.costAmount === null && costOverride === undefined
        ? null
        : calculation(item.costAmount ?? 0, undefined, costOverride)
    const weightCalculation =
      item.weight === null && weightOverride === undefined
        ? null
        : calculation(item.weight?.amount ?? 0, undefined, weightOverride)
    return {
      itemInstanceId: item.itemInstanceId,
      attackBonus: attackCalculation.effective,
      ...(costCalculation === null ? {} : { cost: costCalculation.effective }),
      damageBonus: damageCalculation.effective,
      displayAsAttack: adjustments.some((adjustment) => adjustment.field === 'DISPLAY_AS_ATTACK'),
      properties: {
        adamantine: adjustments.some((adjustment) => adjustment.field === 'ADAMANTINE'),
        dualWield: adjustments.some((adjustment) => adjustment.field === 'DUAL_WIELD'),
        silvered: adjustments.some((adjustment) => adjustment.field === 'SILVERED')
      },
      ...(weightCalculation === null
        ? {}
        : {
            weight: {
              amount: weightCalculation.effective,
              unit: item.weight?.unit ?? 'POUNDS'
            }
          }),
      calculations: {
        attackBonus: attackCalculation,
        ...(costCalculation === null ? {} : { cost: costCalculation }),
        damageBonus: damageCalculation,
        ...(weightCalculation === null ? {} : { weight: weightCalculation })
      }
    }
  })
}
