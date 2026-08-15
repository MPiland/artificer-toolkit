const senseModifier =
  '(group.valueDomainCode == "SENSE_RANGE" and (group.modifierKind == "BONUS" or group.modifierKind == "PENALTY") and (grantFold.modifiers[group.contributions[0].acceptedModifierIndex].grant.domain.senseCode == sense.senseCode or grantFold.modifiers[group.contributions[0].acceptedModifierIndex].grant.domain.senseId == sense.senseCode))'
const distanceCandidates =
  'filter($.allSenseRecords as candidate, candidate.senseCode == sense.senseCode and candidate.range != null)'
const maximumDistance = `max(map(${distanceCandidates}, #.range.amount))`
const selectedDistance = `filter(${distanceCandidates} as candidate, candidate.range.amount == ${maximumDistance})[0]`
const overrides =
  'filter($.senseOverrideRecords as override, override.senseCode == sense.senseCode)'

export const dnd5e2014CharacterSensePolicyExpressions = [
  {
    id: 'authored-sense-records',
    key: 'authoredSenseRecords',
    value:
      'map(grantFold.senses as sense, { senseCode: sense.senseCode, range: sense.range == null or sense.range.rangeKind != "DISTANCE" ? null : { id: sense.range.id, amount: sense.range.amount, unit: sense.range.unit } })'
  },
  {
    id: 'all-sense-records',
    key: 'allSenseRecords',
    value:
      'map(keys($.authoredSenseRecords) as sequence, merge([$.authoredSenseRecords[sequence], { sequence: sequence }]))'
  },
  {
    id: 'sense-override-records',
    key: 'senseOverrideRecords',
    value:
      'senseFacts == null ? [] : map(keys(senseFacts.overrides) as sequence, merge([senseFacts.overrides[sequence], { sequence: sequence }]))'
  },
  {
    id: 'sense-identities',
    key: 'senseIdentities',
    value:
      'merge([filter($.allSenseRecords as sense, !some($.allSenseRecords as earlier, earlier.senseCode == sense.senseCode and earlier.sequence < sense.sequence)), filter($.senseOverrideRecords as override, !some($.allSenseRecords, #.senseCode == override.senseCode) and !some($.senseOverrideRecords as earlier, earlier.senseCode == override.senseCode and earlier.sequence < override.sequence))])'
  },
  {
    id: 'senses',
    key: 'senses',
    value: `map($.senseIdentities as sense, { senseCode: sense.senseCode, range: len(${overrides}) == 0 and len(${distanceCandidates}) == 0 ? null : { id: len(${overrides}) == 0 ? ${selectedDistance}.range.id : ${overrides}[0].sourceId, amount: len(${overrides}) == 0 ? ${maximumDistance} + sum(map(filter($.resolvedModifierGroups as group, ${senseModifier}), #.effective)) : ${overrides}[0].value, unit: len(${distanceCandidates}) == 0 ? "FEET" : ${selectedDistance}.range.unit, calculation: { base: len(${distanceCandidates}) == 0 ? 0 : ${maximumDistance}, effective: len(${overrides}) == 0 ? ${maximumDistance} + sum(map(filter($.resolvedModifierGroups as group, ${senseModifier}), #.effective)) : ${overrides}[0].value, contributions: flatten(map(filter($.resolvedModifierGroups as group, ${senseModifier}) as group, map(group.contributions as contribution, { sourceId: contribution.sourceId, source: contribution.source, value: contribution.value, state: len(${overrides}) == 0 ? contribution.state : "SUPPRESSED", reasonCode: len(${overrides}) == 0 ? contribution.reasonCode : "SUPPRESSED_BY_OVERRIDE" }))), override: len(${overrides}) == 0 ? null : { sourceId: ${overrides}[0].sourceId, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: ${overrides}[0].sourceId }, value: ${overrides}[0].value } } } })`
  }
]

export const dnd5e2014CharacterSensePolicyOutputExpression = {
  id: 'senses',
  key: 'senses',
  value: 'senses'
}
