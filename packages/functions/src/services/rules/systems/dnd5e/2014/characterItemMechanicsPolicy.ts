const manualContribution = (adjustment: string) =>
  `{ sourceId: ${adjustment}.id, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: ${adjustment}.id }, value: ${adjustment}.value, state: "APPLIED", reasonCode: "APPLIED" }`

const numericCalculation = (base: string, bonus: string | null, override: string | null) => {
  if (bonus === null && override === null) {
    return `{ base: ${base}, effective: ${base}, contributions: [], override: null }`
  }
  if (bonus === null) {
    return `{ base: ${base}, effective: ${override} == null ? ${base} : ${override}.value, contributions: [], override: ${override} == null ? null : { sourceId: ${override}.id, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: ${override}.id }, value: ${override}.value } }`
  }
  if (override === null) {
    return `{ base: ${base}, effective: ${base} + (${bonus} == null ? 0 : ${bonus}.value), contributions: ${bonus} == null ? [] : [${manualContribution(bonus)}], override: null }`
  }
  return `{ base: ${base}, effective: ${override} == null ? ${base} + (${bonus} == null ? 0 : ${bonus}.value) : ${override}.value, contributions: ${bonus} == null ? [] : [merge([${manualContribution(bonus)}, ${override} == null ? {} : { state: "SUPPRESSED", reasonCode: "SUPPRESSED_BY_OVERRIDE" }])], override: ${override} == null ? null : { sourceId: ${override}.id, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: ${override}.id }, value: ${override}.value } }`
}

const firstAdjustment = (field: string) =>
  `len(filter(record.adjustments, #.field == "${field}")) == 0 ? null : filter(record.adjustments, #.field == "${field}")[0]`

export const dnd5e2014CharacterItemMechanicsPolicyExpressions = [
  {
    id: 'item-mechanics-records',
    key: 'itemMechanicRecords',
    value:
      'itemMechanicsFacts == null ? [] : map(itemMechanicsFacts.items as item, { item: item, adjustments: filter(itemMechanicsFacts.adjustments as adjustment, adjustment.itemInstanceId == item.itemInstanceId) })'
  },
  {
    id: 'item-mechanics-adjustments',
    key: 'resolvedItemMechanicRecords',
    value: `map($.itemMechanicRecords as record, merge([record, { attackBonus: ${firstAdjustment('ATTACK_BONUS')}, attackOverride: ${firstAdjustment('ATTACK_OVERRIDE')}, costOverride: ${firstAdjustment('COST_OVERRIDE')}, damageBonusAdjustment: ${firstAdjustment('DAMAGE_BONUS')}, weightOverride: ${firstAdjustment('WEIGHT_OVERRIDE')} }]))`
  },
  {
    id: 'item-mechanics-calculations',
    key: 'resolvedItemMechanicCalculations',
    value: `map($.resolvedItemMechanicRecords as record, merge([record, { attackCalculation: ${numericCalculation('0', 'record.attackBonus', 'record.attackOverride')}, costCalculation: record.item.costAmount == null and record.costOverride == null ? null : ${numericCalculation('record.item.costAmount == null ? 0 : record.item.costAmount', null, 'record.costOverride')}, damageCalculation: ${numericCalculation('0', 'record.damageBonusAdjustment', null)}, weightCalculation: record.item.weight == null and record.weightOverride == null ? null : ${numericCalculation('record.item.weight == null ? 0 : record.item.weight.amount', null, 'record.weightOverride')} }]))`
  }
]

export const dnd5e2014CharacterItemMechanicsPolicyOutputExpression = {
  id: 'item-mechanics',
  key: 'itemMechanics',
  value:
    'map(resolvedItemMechanicCalculations as record, merge([{ itemInstanceId: record.item.itemInstanceId, attackBonus: record.attackCalculation.effective, damageBonus: record.damageCalculation.effective, displayAsAttack: some(record.adjustments, #.field == "DISPLAY_AS_ATTACK"), properties: { adamantine: some(record.adjustments, #.field == "ADAMANTINE"), dualWield: some(record.adjustments, #.field == "DUAL_WIELD"), silvered: some(record.adjustments, #.field == "SILVERED") }, calculations: merge([{ attackBonus: record.attackCalculation, damageBonus: record.damageCalculation }, record.costCalculation == null ? {} : { cost: record.costCalculation }, record.weightCalculation == null ? {} : { weight: record.weightCalculation }]) }, record.costCalculation == null ? {} : { cost: record.costCalculation.effective }, record.weightCalculation == null ? {} : { weight: { amount: record.weightCalculation.effective, unit: record.item.weight == null ? "POUNDS" : record.item.weight.unit } }]))'
}
