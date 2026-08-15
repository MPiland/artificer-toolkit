const manualOverride = (adjustment: string) =>
  `${adjustment} == null ? null : { sourceId: ${adjustment}.id, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: ${adjustment}.id }, value: ${adjustment}.value }`

const numericCalculation = (base: string, override: string) =>
  `{ base: ${base}, effective: ${override} == null ? ${base} : ${override}.value, contributions: [], override: ${manualOverride(override)} }`

const selectionCalculation = (base: string, override: string) =>
  `${base} == null and ${override} == null ? null : { base: ${base} == null ? ${override}.value : ${base}, effective: ${override} == null ? ${base} : ${override}.value, contributions: [], override: ${manualOverride(override)} }`

const firstAdjustment = (field: string) =>
  `len(filter(record.adjustments, #.field == "${field}")) == 0 ? null : filter(record.adjustments, #.field == "${field}")[0]`

export const dnd5e2014CharacterCompanionMechanicsPolicyExpressions = [
  {
    id: 'companion-mechanics-records',
    key: 'companionMechanicRecords',
    value:
      'companionMechanicsFacts == null ? [] : map(companionMechanicsFacts.companions as companion, { companion: companion, adjustments: filter(companionMechanicsFacts.adjustments as adjustment, adjustment.companionInstanceId == companion.companionInstanceId) })'
  },
  {
    id: 'companion-mechanics-adjustments',
    key: 'resolvedCompanionMechanicRecords',
    value: `map($.companionMechanicRecords as record, merge([record, { armorClassOverride: ${firstAdjustment('ARMOR_CLASS_OVERRIDE')}, maxHitPointsOverride: ${firstAdjustment('MAXIMUM_HIT_POINTS_OVERRIDE')}, sizeOverride: ${firstAdjustment('SIZE_OVERRIDE')}, alignmentOverride: ${firstAdjustment('ALIGNMENT_OVERRIDE')}, creatureTypeOverride: ${firstAdjustment('CREATURE_TYPE_OVERRIDE')} }]))`
  },
  {
    id: 'companion-mechanics-calculations',
    key: 'resolvedCompanionMechanicCalculations',
    value: `map($.resolvedCompanionMechanicRecords as record, merge([record, { armorClassCalculation: ${numericCalculation('record.companion.armorClass', 'record.armorClassOverride')}, maxHitPointsCalculation: ${numericCalculation('record.companion.maxHitPoints', 'record.maxHitPointsOverride')}, sizeCalculation: ${selectionCalculation('record.companion.size', 'record.sizeOverride')}, alignmentCalculation: ${selectionCalculation('record.companion.alignmentId', 'record.alignmentOverride')}, creatureTypeCalculation: ${selectionCalculation('record.companion.creatureTypeId', 'record.creatureTypeOverride')} }]))`
  }
]

export const dnd5e2014CharacterCompanionMechanicsPolicyOutputExpression = {
  id: 'companions',
  key: 'companions',
  value:
    'map(resolvedCompanionMechanicCalculations as record, merge([{ companionInstanceId: record.companion.companionInstanceId, creatureId: record.companion.creatureId, abilityScores: record.companion.abilityScores, armorClass: record.armorClassCalculation.effective, maxHitPoints: record.maxHitPointsCalculation.effective, calculations: merge([{ armorClass: record.armorClassCalculation, maxHitPoints: record.maxHitPointsCalculation }, record.sizeCalculation == null ? {} : { size: record.sizeCalculation }, record.alignmentCalculation == null ? {} : { alignmentId: record.alignmentCalculation }, record.creatureTypeCalculation == null ? {} : { creatureTypeId: record.creatureTypeCalculation }]) }, record.sizeCalculation == null ? {} : { size: record.sizeCalculation.effective }, record.alignmentCalculation == null ? {} : { alignmentId: record.alignmentCalculation.effective }, record.creatureTypeCalculation == null ? {} : { creatureTypeId: record.creatureTypeCalculation.effective }]))'
}
