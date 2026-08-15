const hitPointModifierGroups =
  'filter($.resolvedModifierGroups as group, group.valueDomainCode == "HIT_POINTS_MAX" and group.modifierKind != "SET_VALUE")'
const hitPointContributions = 'flatten(map($.hitPointModifierGroups as group, group.contributions))'

export const dnd5e2014CharacterHitPointPolicyExpressions = [
  {
    id: 'hit-point-progression-candidates',
    key: 'hitPointProgressionCandidates',
    value:
      'hitPointFacts == null or hitPointFacts.progression == null ? [] : map(hitPointFacts.progression.rows as row, { row: row, abilityModifier: row.abilityIndex == null or row.abilityIndex >= len($.resolvedDerivedAbilities) ? 0 : $.resolvedDerivedAbilities[row.abilityIndex].modifier.effective })'
  },
  {
    id: 'hit-point-progression',
    key: 'resolvedHitPointProgression',
    value:
      'map($.hitPointProgressionCandidates as candidate, { sequence: candidate.row.sequence, level: candidate.row.level, classId: candidate.row.classId, classLevel: candidate.row.classLevel, value: candidate.row.die == null ? candidate.row.fallbackValue : hitPointFacts.progression.method == "FIXED" or candidate.row.level == 1 ? max([candidate.row.level == 1 ? candidate.row.die + candidate.abilityModifier : floor(candidate.row.die / 2) + 1 + candidate.abilityModifier, 1]) : candidate.row.rollValue != null ? max([candidate.row.rollValue + candidate.abilityModifier, 1]) : candidate.row.legacyOverrideValue != null ? max([candidate.row.legacyOverrideValue, 1]) : max([candidate.abilityModifier + 1, 1]) })'
  },
  {
    id: 'hit-point-row-base',
    key: 'hitPointRowBase',
    value:
      'hitPointFacts == null ? 0 : hitPointFacts.progression == null ? sum(map(hitPointFacts.rows, #.value)) : sum(map($.resolvedHitPointProgression, #.value))'
  },
  {
    id: 'hit-point-effective-constitution',
    key: 'hitPointEffectiveConstitutionModifier',
    value:
      'hitPointFacts == null or hitPointFacts.constitutionAbilityIndex == null or hitPointFacts.constitutionAbilityIndex >= len($.resolvedDerivedAbilities) ? 0 : $.resolvedDerivedAbilities[hitPointFacts.constitutionAbilityIndex].modifier.effective'
  },
  {
    id: 'hit-point-authored-constitution',
    key: 'hitPointAuthoredConstitutionModifier',
    value:
      'hitPointFacts == null or hitPointFacts.constitutionAbilityIndex == null or hitPointFacts.constitutionAbilityIndex >= len($.resolvedAbilityRecords) ? 0 : floor((derivedBaseFacts.abilities[hitPointFacts.constitutionAbilityIndex].baseScore + sum(map(filter($.resolvedAbilityRecords[hitPointFacts.constitutionAbilityIndex].resolvedBonuses as bonus, bonus.source.kind != "MANUAL_ADJUSTMENT" and bonus.state == "APPLIED"), #.value)) - 10) / 2)'
  },
  {
    id: 'hit-point-constitution-delta',
    key: 'hitPointConstitutionDelta',
    value:
      'hitPointFacts == null or hitPointFacts.progression != null ? 0 : ($.hitPointEffectiveConstitutionModifier - $.hitPointAuthoredConstitutionModifier) * len(hitPointFacts.rows)'
  },
  {
    id: 'hit-point-modifier-groups',
    key: 'hitPointModifierGroups',
    value: hitPointModifierGroups
  },
  {
    id: 'hit-point-contributions',
    key: 'hitPointCalculationContributions',
    value: `merge([$.hitPointConstitutionDelta == 0 ? [] : [{ sourceId: "hit-points:constitution-modifier-delta", source: { kind: "SYSTEM", systemId: grantFoldFacts.base.systemId }, value: $.hitPointConstitutionDelta, state: "APPLIED", reasonCode: "APPLIED" }], ${hitPointContributions}, hitPointFacts == null or hitPointFacts.manualMaximumModifier == null ? [] : [{ sourceId: hitPointFacts.manualMaximumModifier.sourceId, source: hitPointFacts.manualMaximumModifier.source, value: hitPointFacts.manualMaximumModifier.value, state: "APPLIED", reasonCode: "APPLIED" }]])`
  },
  {
    id: 'hit-point-calculation',
    key: 'maxHitPointsCalculation',
    value:
      '{ base: $.hitPointRowBase, effective: hitPointFacts != null and hitPointFacts.manualMaximumOverride != null ? hitPointFacts.manualMaximumOverride.value : $.hitPointRowBase + sum(map(filter($.hitPointCalculationContributions, #.state == "APPLIED"), #.value)), contributions: map($.hitPointCalculationContributions as contribution, { sourceId: contribution.sourceId, source: contribution.source, value: contribution.value, state: hitPointFacts != null and hitPointFacts.manualMaximumOverride != null ? "SUPPRESSED" : contribution.state, reasonCode: hitPointFacts != null and hitPointFacts.manualMaximumOverride != null ? "SUPPRESSED_BY_OVERRIDE" : contribution.reasonCode }), override: hitPointFacts == null ? null : hitPointFacts.manualMaximumOverride }'
  }
]

export const dnd5e2014CharacterHitPointPolicyOutputExpression = {
  id: 'max-hit-points',
  key: 'maxHitPoints',
  value: 'maxHitPointsCalculation'
}

export const dnd5e2014CharacterHitPointProgressionOutputExpression = {
  id: 'hit-point-progression',
  key: 'hitPointProgression',
  value: 'resolvedHitPointProgression'
}
