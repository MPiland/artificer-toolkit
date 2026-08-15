const sameSource = (left: string, right: string) =>
  `${left}.spellId == ${right}.spellId and ${left}.sourceKind == ${right}.sourceKind and ${left}.sourceInstanceId == ${right}.sourceInstanceId`

const sourceRecord =
  '{ spellId: source.spellId, sourceKind: source.sourceKind, sourceInstanceId: source.sourceInstanceId, sequence: source.sequence }'

const numericCalculation = (base: string, contributions: string, override: string) =>
  `{ base: ${base}, effective: ${override} == null ? ${base} + sum(map(filter(${contributions}, #.state == "APPLIED"), #.value)) : ${override}.value, contributions: map(${contributions} as contribution, { sourceId: contribution.sourceId, source: contribution.source, value: contribution.value, state: ${override} == null ? contribution.state : "SUPPRESSED", reasonCode: ${override} == null ? contribution.reasonCode : "SUPPRESSED_BY_OVERRIDE" }), override: ${override} }`

const sourceBase = (kind: 'attack' | 'save') => {
  const global =
    kind === 'attack' ? 'derivedSpellcasting.attackBonus' : 'derivedSpellcasting.saveDc'
  const bonus = kind === 'attack' ? 'spellAttackContributions' : 'spellSaveDcContributions'
  const offset = kind === 'attack' ? '0' : '8'
  return `record.access != null and record.access.castingAbility != null and some(resolvedDerivedAbilities as ability, ability.abilityId == record.access.castingAbility) ? { base: derivedProficiencyBonusCalculation.effective + filter(resolvedDerivedAbilities as ability, ability.abilityId == record.access.castingAbility)[0].modifier.effective + ${offset}, contributions: ${bonus} } : derivedSpellcasting == null ? null : { base: ${global}.base, contributions: ${global}.contributions }`
}

export const dnd5e2014CharacterSpellMechanicsPolicyExpressions = [
  {
    id: 'spell-mechanics-snapshot-sources',
    key: 'spellMechanicSnapshotSources',
    value:
      'spellMechanicsFacts == null ? [] : map(spellMechanicsFacts.snapshotSources as source, source)'
  },
  {
    id: 'spell-mechanics-access-sources',
    key: 'spellMechanicAccessSources',
    value:
      'map(spellAccess as access, { spellId: access.spellId, sourceKind: "FEATURE", sourceInstanceId: access.sourceInstanceId, sequence: 1000 + access.sequence })'
  },
  {
    id: 'spell-mechanics-adjustment-sources',
    key: 'spellMechanicAdjustmentSources',
    value:
      'spellMechanicsFacts == null ? [] : map(spellMechanicsFacts.adjustments as adjustment, { spellId: adjustment.source.spellId, sourceKind: adjustment.source.sourceKind, sourceInstanceId: adjustment.source.sourceInstanceId, sequence: 2000 + adjustment.sequence })'
  },
  {
    id: 'spell-mechanics-sources',
    key: 'spellMechanicSourceCandidates',
    value:
      'merge([$.spellMechanicSnapshotSources, $.spellMechanicAccessSources, $.spellMechanicAdjustmentSources])'
  },
  {
    id: 'spell-mechanics-dedupe',
    key: 'resolvedSpellMechanicSources',
    value: `map(filter($.spellMechanicSourceCandidates as source, !some($.spellMechanicSourceCandidates as earlier, ${sameSource('earlier', 'source')} and earlier.sequence < source.sequence)) as source, ${sourceRecord})`
  },
  {
    id: 'spell-mechanics-records',
    key: 'spellMechanicRecords',
    value: `map($.resolvedSpellMechanicSources as source, { source: { spellId: source.spellId, sourceKind: source.sourceKind, sourceInstanceId: source.sourceInstanceId }, access: len(filter(spellAccess as access, access.spellId == source.spellId and source.sourceKind == "FEATURE" and access.sourceInstanceId == source.sourceInstanceId)) == 0 ? null : filter(spellAccess as access, access.spellId == source.spellId and source.sourceKind == "FEATURE" and access.sourceInstanceId == source.sourceInstanceId)[0], adjustments: spellMechanicsFacts == null ? [] : filter(spellMechanicsFacts.adjustments as adjustment, ${sameSource('adjustment.source', 'source')}) })`
  },
  {
    id: 'spell-mechanics-calculations',
    key: 'resolvedSpellMechanicRecords',
    value: `map($.spellMechanicRecords as record, merge([record, { attackBase: ${sourceBase('attack')}, saveBase: ${sourceBase('save')}, attackBonusAdjustment: len(filter(record.adjustments, #.field == "ATTACK_BONUS")) == 0 ? null : filter(record.adjustments, #.field == "ATTACK_BONUS")[0], attackOverride: len(filter(record.adjustments, #.field == "ATTACK_OVERRIDE")) == 0 ? null : { sourceId: filter(record.adjustments, #.field == "ATTACK_OVERRIDE")[0].id, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: filter(record.adjustments, #.field == "ATTACK_OVERRIDE")[0].id }, value: filter(record.adjustments, #.field == "ATTACK_OVERRIDE")[0].value }, saveBonusAdjustment: len(filter(record.adjustments, #.field == "DC_BONUS")) == 0 ? null : filter(record.adjustments, #.field == "DC_BONUS")[0], saveOverride: len(filter(record.adjustments, #.field == "DC_OVERRIDE")) == 0 ? null : { sourceId: filter(record.adjustments, #.field == "DC_OVERRIDE")[0].id, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: filter(record.adjustments, #.field == "DC_OVERRIDE")[0].id }, value: filter(record.adjustments, #.field == "DC_OVERRIDE")[0].value }, damageAdjustment: len(filter(record.adjustments, #.field == "DAMAGE_BONUS")) == 0 ? null : filter(record.adjustments, #.field == "DAMAGE_BONUS")[0] }]))`
  },
  {
    id: 'spell-mechanics-output',
    key: 'spellMechanics',
    value: `map($.resolvedSpellMechanicRecords as record, { source: record.source, attackBonus: record.attackBase == null ? null : ${numericCalculation('record.attackBase.base', 'merge([record.attackBase.contributions, record.attackBonusAdjustment == null ? [] : [{ sourceId: record.attackBonusAdjustment.id, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: record.attackBonusAdjustment.id }, value: record.attackBonusAdjustment.value, state: "APPLIED", reasonCode: "APPLIED" }]])', 'record.attackOverride')}, saveDC: record.saveBase == null ? null : ${numericCalculation('record.saveBase.base', 'merge([record.saveBase.contributions, record.saveBonusAdjustment == null ? [] : [{ sourceId: record.saveBonusAdjustment.id, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: record.saveBonusAdjustment.id }, value: record.saveBonusAdjustment.value, state: "APPLIED", reasonCode: "APPLIED" }]])', 'record.saveOverride')}, damageBonus: { base: 0, effective: record.damageAdjustment == null ? 0 : record.damageAdjustment.value, contributions: record.damageAdjustment == null ? [] : [{ sourceId: record.damageAdjustment.id, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: record.damageAdjustment.id }, value: record.damageAdjustment.value, state: "APPLIED", reasonCode: "APPLIED" }], override: null } })`
  }
]

export const dnd5e2014CharacterSpellMechanicsPolicyOutputExpression = {
  id: 'spell-mechanics',
  key: 'spellMechanics',
  value:
    'map(spellMechanics as mechanics, merge([{ source: mechanics.source, damageBonus: mechanics.damageBonus.effective, calculations: merge([{ damageBonus: mechanics.damageBonus }, mechanics.attackBonus == null ? {} : { attackBonus: mechanics.attackBonus }, mechanics.saveDC == null ? {} : { saveDC: mechanics.saveDC }]) }, mechanics.attackBonus == null ? {} : { attackBonus: mechanics.attackBonus.effective }, mechanics.saveDC == null ? {} : { saveDC: mechanics.saveDC.effective }]))'
}
