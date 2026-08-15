function resolveModifierGroupBonusArray(source: string): string {
  const groups = 'filter($.resolvedModifierGroups as group, group.domainKey == bonus.domainKey)'
  return `flatten(map(${source} as bonus, bonus.kind != "MODIFIER_GROUP" ? [bonus] : len(${groups}) == 0 ? [] : map(${groups}[0].contributions as contribution, merge([{ kind: "RESOLVED", sourceId: contribution.sourceId, source: contribution.source, value: contribution.value, operation: bonus.operation, state: contribution.state, reasonCode: contribution.reasonCode }, contribution.acceptedModifierIndex == null ? {} : { acceptedModifierIndex: contribution.acceptedModifierIndex, grantId: contribution.grantId, domainKey: contribution.domainKey }]))))`
}

function resolveModifierGroupBonuses(source: string): string {
  return `map(${source} as record, merge([record, { bonuses: ${resolveModifierGroupBonusArray('record.bonuses')} }]))`
}

function resolvedBonusValue(proficiencyValue: string): string {
  return `(bonus.kind == "PROFICIENCY" ? ${proficiencyValue} : bonus.value)`
}

function foldedProficiencies(kind: string, subjectIds: string): string {
  return `filter($.resolvedProficiencies as proficiency, proficiency.kind == "${kind}" and (proficiency.matchId == "*" or some(${subjectIds}, # == proficiency.matchId)))`
}

function highestRank(proficiencies: string): string {
  return `some(${proficiencies}, #.scaling == "DOUBLE") ? "DOUBLE" : some(${proficiencies}, #.scaling == "FULL") ? "FULL" : some(${proficiencies}, #.scaling == "HALF") ? "HALF" : "NONE"`
}

function rankMultiplier(rank: string): string {
  return `${rank} == "DOUBLE" ? 2 : ${rank} == "FULL" ? 1 : ${rank} == "HALF" ? 0.5 : 0`
}

function numericContributions(source: string, override: string): string {
  return `map(${source} as contribution, merge([{ sourceId: contribution.sourceId, source: contribution.source, value: contribution.value, state: ${override} == null ? contribution.state : "SUPPRESSED", reasonCode: ${override} == null ? contribution.reasonCode : "SUPPRESSED_BY_OVERRIDE" }, contribution.acceptedModifierIndex == null ? {} : { acceptedModifierIndex: contribution.acceptedModifierIndex, grantId: contribution.grantId, domainKey: contribution.domainKey }]))`
}

function resolvedStandaloneBonuses(source: string): string {
  return `map(${resolveModifierGroupBonusArray(source)} as bonus, merge([{ sourceId: bonus.sourceId, source: bonus.source, value: bonus.kind == "PROFICIENCY" ? floor((max([totalLevel, 1]) - 1) / 4) + 2 : bonus.value, state: bonus.state == null ? "APPLIED" : bonus.state, reasonCode: bonus.reasonCode == null ? "APPLIED" : bonus.reasonCode }, bonus.acceptedModifierIndex == null ? {} : { acceptedModifierIndex: bonus.acceptedModifierIndex, grantId: bonus.grantId, domainKey: bonus.domainKey }]))`
}

function resolvedDerivedBonuses(): string {
  return `map(filter(record.bonuses as bonus, bonus.kind != "PROFICIENCY" or record.proficiencyValue != 0) as bonus, merge([{ sourceId: bonus.kind == "PROFICIENCY" and record.proficiencyOverride != null ? record.proficiencyOverride.sourceId : bonus.sourceId, source: bonus.kind != "PROFICIENCY" ? bonus.source : record.proficiencyOverride != null ? record.proficiencyOverride.source : record.selectedProficiencySource, value: ${resolvedBonusValue('record.proficiencyValue')}, operation: bonus.operation, state: bonus.state == null ? "APPLIED" : bonus.state, reasonCode: bonus.reasonCode == null ? "APPLIED" : bonus.reasonCode }, bonus.kind == "PROFICIENCY" ? { grantId: record.proficiencyOverride != null ? record.proficiencyOverride.sourceId : record.selectedProficiencySourceId } : bonus.acceptedModifierIndex == null ? {} : { acceptedModifierIndex: bonus.acceptedModifierIndex, grantId: bonus.grantId, domainKey: bonus.domainKey }]))`
}

const derivedAbilityFacts = `map(derivedBaseFacts.abilities as record, merge([record, { bonuses: ${resolveModifierGroupBonusArray('record.bonuses')} }]))`
const appliedAbilitySetBonuses =
  'filter(record.bonuses as candidate, candidate.operation == "SET" and candidate.state == "APPLIED" and candidate.acceptedModifierIndex != null)'
const selectedAbilitySetIndex = `(len(${appliedAbilitySetBonuses}) == 0 ? null : max(map(${appliedAbilitySetBonuses}, #.acceptedModifierIndex)))`
const resolvedAbilityBonuses = `map(record.bonuses as bonus, merge([{ sourceId: bonus.sourceId, source: bonus.source, value: bonus.operation == "SET" ? bonus.value - record.baseScore : bonus.value, operation: bonus.operation, state: bonus.operation == "SET" and bonus.acceptedModifierIndex != null and bonus.acceptedModifierIndex != ${selectedAbilitySetIndex} ? "SUPPRESSED" : bonus.state == null ? "APPLIED" : bonus.state, reasonCode: bonus.operation == "SET" and bonus.acceptedModifierIndex != null and bonus.acceptedModifierIndex != ${selectedAbilitySetIndex} ? "SUPPRESSED_BY_STACKING" : bonus.reasonCode == null ? "APPLIED" : bonus.reasonCode }, bonus.acceptedModifierIndex == null ? {} : { acceptedModifierIndex: bonus.acceptedModifierIndex, grantId: bonus.grantId, domainKey: bonus.domainKey }]))`

const savingThrowProficiencies = foldedProficiencies(
  'SAVE_ABILITY',
  '[record.abilityId, record.proficiencySubjectId]'
)
const skillProficiencies = foldedProficiencies('SKILL', 'record.proficiencySubjectIds')
const savingThrowRank =
  'record.proficiencyOverride == null ? ' +
  highestRank(savingThrowProficiencies) +
  ' : record.proficiencyOverride.value'
const skillRank =
  'record.proficiencyOverride == null ? ' +
  highestRank(skillProficiencies) +
  ' : record.proficiencyOverride.value'
const savingThrowSelectedProficiencyIndex = `(record.proficiencyOverride != null or record.proficiencyRank == "NONE" ? null : filter(${savingThrowProficiencies} as proficiency, proficiency.scaling == record.proficiencyRank)[0].acceptedProficiencyIndex)`
const skillSelectedProficiencyIndex = `(record.proficiencyOverride != null or record.proficiencyRank == "NONE" ? null : filter(${skillProficiencies} as proficiency, proficiency.scaling == record.proficiencyRank)[0].acceptedProficiencyIndex)`

const savingThrowProficiencyContributions = `map(${savingThrowProficiencies} as proficiency, { acceptedProficiencyIndex: proficiency.acceptedProficiencyIndex, sourceId: proficiency.grantId, source: proficiency.source, grantId: proficiency.grantId, value: proficiency.scaling, state: record.proficiencyOverride != null or proficiency.acceptedProficiencyIndex != record.selectedProficiencyIndex ? "SUPPRESSED" : "APPLIED", reasonCode: record.proficiencyOverride != null ? "SUPPRESSED_BY_OVERRIDE" : proficiency.acceptedProficiencyIndex == record.selectedProficiencyIndex ? "SELECTED_HIGHEST_RANK" : "SUPPRESSED_BY_HIGHER_RANK" })`
const skillProficiencyContributions = `map(${skillProficiencies} as proficiency, { acceptedProficiencyIndex: proficiency.acceptedProficiencyIndex, sourceId: proficiency.grantId, source: proficiency.source, grantId: proficiency.grantId, value: proficiency.scaling, state: record.proficiencyOverride != null or proficiency.acceptedProficiencyIndex != record.selectedProficiencyIndex ? "SUPPRESSED" : "APPLIED", reasonCode: record.proficiencyOverride != null ? "SUPPRESSED_BY_OVERRIDE" : proficiency.acceptedProficiencyIndex == record.selectedProficiencyIndex ? "SELECTED_HIGHEST_RANK" : "SUPPRESSED_BY_HIGHER_RANK" })`
const savingThrowProficiencyCalculation = `{ base: "NONE", effective: record.proficiencyRank, contributions: record.proficiencyContributions, override: record.proficiencyOverride }`
const skillProficiencyCalculation = `{ base: "NONE", effective: record.proficiencyRank, contributions: record.proficiencyContributions, override: record.proficiencyOverride }`

/** Ordered expressions consumed by the single Character calculations node. */
export const dnd5e2014CharacterDerivedPolicyExpressions = [
  {
    id: 'derived-proficiency-bonus',
    key: 'derivedProficiencyBonusCalculation',
    value:
      '{ base: floor((max([totalLevel, 1]) - 1) / 4) + 2, effective: floor((max([totalLevel, 1]) - 1) / 4) + 2, contributions: [], override: null }'
  },
  {
    id: 'derived-ability-facts',
    key: 'derivedAbilityFacts',
    value: derivedAbilityFacts
  },
  {
    id: 'resolved-ability-records',
    key: 'resolvedAbilityRecords',
    value: `map($.derivedAbilityFacts as record, merge([record, { resolvedBonuses: ${resolvedAbilityBonuses}, effectiveScore: record.scoreOverride == null ? record.baseScore + sum(map(filter(${resolvedAbilityBonuses}, #.state == "APPLIED"), #.value)) : record.scoreOverride.value }]))`
  },
  {
    id: 'resolved-abilities',
    key: 'resolvedDerivedAbilities',
    value: `map($.resolvedAbilityRecords as record, { abilityId: record.abilityId, score: { base: record.baseScore, effective: record.effectiveScore, contributions: ${numericContributions('record.resolvedBonuses', 'record.scoreOverride')}, override: record.scoreOverride }, modifier: { base: floor((record.effectiveScore - 10) / 2), effective: floor((record.effectiveScore - 10) / 2), contributions: [], override: null } })`
  },
  {
    id: 'derived-saving-throw-facts',
    key: 'derivedSavingThrowFacts',
    value: resolveModifierGroupBonuses('derivedBaseFacts.savingThrows')
  },
  {
    id: 'linked-saving-throws',
    key: 'linkedSavingThrowRecords',
    value: `map($.derivedSavingThrowFacts as record, merge([record, { abilityModifier: record.abilityIndex == null or record.abilityIndex >= len($.resolvedDerivedAbilities) ? 0 : $.resolvedDerivedAbilities[record.abilityIndex].modifier.effective, proficiencyRank: ${savingThrowRank} }]))`
  },
  {
    id: 'valued-saving-throws',
    key: 'valuedSavingThrowRecords',
    value: `map($.linkedSavingThrowRecords as record, merge([record, { selectedProficiencyIndex: ${savingThrowSelectedProficiencyIndex}, selectedProficiencySourceId: record.proficiencyOverride != null or record.proficiencyRank == "NONE" ? null : filter(${savingThrowProficiencies} as proficiency, proficiency.acceptedProficiencyIndex == ${savingThrowSelectedProficiencyIndex})[0].grantId, selectedProficiencySource: record.proficiencyOverride != null or record.proficiencyRank == "NONE" ? null : filter(${savingThrowProficiencies} as proficiency, proficiency.acceptedProficiencyIndex == ${savingThrowSelectedProficiencyIndex})[0].source, proficiencyValue: floor($.derivedProficiencyBonusCalculation.effective * (${rankMultiplier('record.proficiencyRank')})) }]))`
  },
  {
    id: 'saving-throw-proficiency-evidence',
    key: 'savingThrowProficiencyRecords',
    value: `map($.valuedSavingThrowRecords as record, merge([record, { proficiencyContributions: ${savingThrowProficiencyContributions} }]))`
  },
  {
    id: 'resolved-saving-throw-bonuses',
    key: 'resolvedSavingThrowRecords',
    value: `map($.savingThrowProficiencyRecords as record, merge([record, { resolvedBonuses: ${resolvedDerivedBonuses()} }]))`
  },
  {
    id: 'saving-throw-total-values',
    key: 'savingThrowTotalValueRecords',
    value:
      'map($.resolvedSavingThrowRecords as record, merge([record, { totalEffective: record.totalOverride == null ? record.abilityModifier + sum(map(filter(record.resolvedBonuses, #.state == "APPLIED"), #.value)) : record.totalOverride.value }]))'
  },
  {
    id: 'saving-throw-total-contributions',
    key: 'savingThrowTotalContributionRecords',
    value: `map($.savingThrowTotalValueRecords as record, merge([record, { totalContributions: ${numericContributions('filter(record.resolvedBonuses, #.value != null)', 'record.totalOverride')} }]))`
  },
  {
    id: 'saving-throw-proficiency-calculations',
    key: 'savingThrowCalculationRecords',
    value: `map($.savingThrowTotalContributionRecords as record, merge([record, { proficiency: ${savingThrowProficiencyCalculation} }]))`
  },
  {
    id: 'saving-throw-total-calculations',
    key: 'savingThrowTotalRecords',
    value:
      'map($.savingThrowCalculationRecords as record, merge([record, { total: { base: record.abilityModifier, effective: record.totalEffective, contributions: record.totalContributions, override: record.totalOverride } }]))'
  },
  {
    id: 'resolved-saving-throws',
    key: 'resolvedDerivedSavingThrows',
    value:
      'map($.savingThrowTotalRecords as record, { abilityId: record.abilityId, proficiency: record.proficiency, total: record.total })'
  },
  {
    id: 'derived-skill-facts',
    key: 'derivedSkillFacts',
    value: resolveModifierGroupBonuses('derivedBaseFacts.skills')
  },
  {
    id: 'linked-skills',
    key: 'linkedSkillRecords',
    value: `map($.derivedSkillFacts as record, merge([record, { effectiveGoverningAbilityId: record.governingAbilityOverride == null ? record.governingAbilityId : record.governingAbilityOverride.value, effectiveGoverningAbilityIndex: record.governingAbilityOverride == null ? record.governingAbilityIndex : record.governingAbilityOverride.abilityIndex, abilityModifier: (record.governingAbilityOverride == null ? record.governingAbilityIndex : record.governingAbilityOverride.abilityIndex) == null or (record.governingAbilityOverride == null ? record.governingAbilityIndex : record.governingAbilityOverride.abilityIndex) >= len($.resolvedDerivedAbilities) ? 0 : $.resolvedDerivedAbilities[record.governingAbilityOverride == null ? record.governingAbilityIndex : record.governingAbilityOverride.abilityIndex].modifier.effective, proficiencyRank: ${skillRank} }]))`
  },
  {
    id: 'valued-skills',
    key: 'valuedSkillRecords',
    value: `map($.linkedSkillRecords as record, merge([record, { selectedProficiencyIndex: ${skillSelectedProficiencyIndex}, selectedProficiencySourceId: record.proficiencyOverride != null or record.proficiencyRank == "NONE" ? null : filter(${skillProficiencies} as proficiency, proficiency.acceptedProficiencyIndex == ${skillSelectedProficiencyIndex})[0].grantId, selectedProficiencySource: record.proficiencyOverride != null or record.proficiencyRank == "NONE" ? null : filter(${skillProficiencies} as proficiency, proficiency.acceptedProficiencyIndex == ${skillSelectedProficiencyIndex})[0].source, proficiencyValue: floor($.derivedProficiencyBonusCalculation.effective * (${rankMultiplier('record.proficiencyRank')})) }]))`
  },
  {
    id: 'skill-proficiency-evidence',
    key: 'skillProficiencyRecords',
    value: `map($.valuedSkillRecords as record, merge([record, { proficiencyContributions: ${skillProficiencyContributions} }]))`
  },
  {
    id: 'resolved-skill-bonuses',
    key: 'resolvedSkillRecords',
    value: `map($.skillProficiencyRecords as record, merge([record, { resolvedBonuses: ${resolvedDerivedBonuses()} }]))`
  },
  {
    id: 'skill-total-values',
    key: 'skillTotalValueRecords',
    value:
      'map($.resolvedSkillRecords as record, merge([record, { totalEffective: record.totalOverride == null ? record.abilityModifier + sum(map(filter(record.resolvedBonuses, #.state == "APPLIED"), #.value)) : record.totalOverride.value }]))'
  },
  {
    id: 'skill-total-contributions',
    key: 'skillTotalContributionRecords',
    value: `map($.skillTotalValueRecords as record, merge([record, { totalContributions: ${numericContributions('filter(record.resolvedBonuses, #.value != null)', 'record.totalOverride')} }]))`
  },
  {
    id: 'skill-identity-calculations',
    key: 'skillIdentityRecords',
    value: `map($.skillTotalContributionRecords as record, merge([record, { governingAbility: { base: record.governingAbilityId, effective: record.effectiveGoverningAbilityId, override: record.governingAbilityOverride == null ? null : { sourceId: record.governingAbilityOverride.sourceId, value: record.governingAbilityOverride.value } }, proficiency: ${skillProficiencyCalculation} }]))`
  },
  {
    id: 'skill-total-calculations',
    key: 'skillTotalRecords',
    value:
      'map($.skillIdentityRecords as record, merge([record, { total: { base: record.abilityModifier, effective: record.totalEffective, contributions: record.totalContributions, override: record.totalOverride } }]))'
  },
  {
    id: 'skill-passive-calculations',
    key: 'skillPassiveRecords',
    value:
      'map($.skillTotalRecords as record, merge([record, { passive: { base: 10 + record.total.effective, effective: record.passiveOverride == null ? 10 + record.total.effective : record.passiveOverride.value, contributions: [], override: record.passiveOverride } }]))'
  },
  {
    id: 'resolved-skills',
    key: 'resolvedDerivedSkills',
    value:
      'map($.skillPassiveRecords as record, { skillId: record.skillId, governingAbility: record.governingAbility, proficiency: record.proficiency, total: record.total, passive: record.passive })'
  },
  {
    id: 'resolved-initiative-bonuses',
    key: 'resolvedInitiativeBonuses',
    value: resolvedStandaloneBonuses('derivedBaseFacts.initiative.bonuses')
  },
  {
    id: 'initiative-ability-modifier',
    key: 'initiativeAbilityModifier',
    value:
      'derivedBaseFacts.initiative.abilityIndex == null or derivedBaseFacts.initiative.abilityIndex >= len($.resolvedDerivedAbilities) ? 0 : $.resolvedDerivedAbilities[derivedBaseFacts.initiative.abilityIndex].modifier.effective'
  },
  {
    id: 'initiative-bonus-total',
    key: 'initiativeBonusTotal',
    value: 'sum(map(filter($.resolvedInitiativeBonuses, #.state == "APPLIED"), #.value))'
  },
  {
    id: 'initiative-contributions',
    key: 'initiativeContributions',
    value: numericContributions('$.resolvedInitiativeBonuses', 'null')
  },
  {
    id: 'derived-initiative',
    key: 'derivedInitiative',
    value:
      '{ base: $.initiativeAbilityModifier, effective: $.initiativeAbilityModifier + $.initiativeBonusTotal, contributions: $.initiativeContributions, override: null }'
  },
  {
    id: 'resolved-spell-save-dc-bonuses',
    key: 'resolvedSpellSaveDcBonuses',
    value: resolvedStandaloneBonuses(
      'derivedBaseFacts.spellcasting == null ? [] : derivedBaseFacts.spellcasting.saveDcBonuses'
    )
  },
  {
    id: 'resolved-spell-attack-bonuses',
    key: 'resolvedSpellAttackBonuses',
    value: resolvedStandaloneBonuses(
      'derivedBaseFacts.spellcasting == null ? [] : derivedBaseFacts.spellcasting.attackBonuses'
    )
  },
  {
    id: 'spellcasting-ability-modifier',
    key: 'spellcastingAbilityModifier',
    value:
      'derivedBaseFacts.spellcasting == null or derivedBaseFacts.spellcasting.abilityIndex == null or derivedBaseFacts.spellcasting.abilityIndex >= len($.resolvedDerivedAbilities) ? 0 : $.resolvedDerivedAbilities[derivedBaseFacts.spellcasting.abilityIndex].modifier.effective'
  },
  {
    id: 'spell-save-dc-bonus-total',
    key: 'spellSaveDcBonusTotal',
    value: 'sum(map(filter($.resolvedSpellSaveDcBonuses, #.state == "APPLIED"), #.value))'
  },
  {
    id: 'spell-attack-bonus-total',
    key: 'spellAttackBonusTotal',
    value: 'sum(map(filter($.resolvedSpellAttackBonuses, #.state == "APPLIED"), #.value))'
  },
  {
    id: 'spell-save-dc-contributions',
    key: 'spellSaveDcContributions',
    value: numericContributions('$.resolvedSpellSaveDcBonuses', 'null')
  },
  {
    id: 'spell-attack-contributions',
    key: 'spellAttackContributions',
    value: numericContributions('$.resolvedSpellAttackBonuses', 'null')
  },
  {
    id: 'derived-spellcasting',
    key: 'derivedSpellcasting',
    value:
      'derivedBaseFacts.spellcasting == null ? null : { abilityId: derivedBaseFacts.spellcasting.abilityId, saveDc: { base: 8 + $.derivedProficiencyBonusCalculation.effective + $.spellcastingAbilityModifier, effective: 8 + $.derivedProficiencyBonusCalculation.effective + $.spellcastingAbilityModifier + $.spellSaveDcBonusTotal, contributions: $.spellSaveDcContributions, override: null }, attackBonus: { base: $.derivedProficiencyBonusCalculation.effective + $.spellcastingAbilityModifier, effective: $.derivedProficiencyBonusCalculation.effective + $.spellcastingAbilityModifier + $.spellAttackBonusTotal, contributions: $.spellAttackContributions, override: null } }'
  }
]

export const dnd5e2014CharacterDerivedPolicyOutputExpression = {
  id: 'derived-stats',
  key: 'derivedStats',
  value:
    '{ proficiencyBonus: derivedProficiencyBonusCalculation, abilities: map(resolvedDerivedAbilities as ability, { abilityId: ability.abilityId, score: ability.score, modifier: ability.modifier }), savingThrows: map(resolvedDerivedSavingThrows as save, { abilityId: save.abilityId, proficiency: save.proficiency, total: save.total }), skills: map(resolvedDerivedSkills as skill, { skillId: skill.skillId, governingAbility: skill.governingAbility, proficiency: skill.proficiency, total: skill.total, passive: skill.passive }), initiative: derivedInitiative, armorClass: armorClassCalculation, maxHitPoints: maxHitPointsCalculation, spellcasting: derivedSpellcasting }'
}
