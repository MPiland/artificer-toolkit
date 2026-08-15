function abilityAlias(ability: string): string {
  return `(${ability} == "STR" ? "STRENGTH" : ${ability} == "STRENGTH" ? "STR" : ${ability} == "DEX" ? "DEXTERITY" : ${ability} == "DEXTERITY" ? "DEX" : ${ability} == "CON" ? "CONSTITUTION" : ${ability} == "CONSTITUTION" ? "CON" : ${ability} == "INT" ? "INTELLIGENCE" : ${ability} == "INTELLIGENCE" ? "INT" : ${ability} == "WIS" ? "WISDOM" : ${ability} == "WISDOM" ? "WIS" : ${ability} == "CHA" ? "CHARISMA" : ${ability} == "CHARISMA" ? "CHA" : ${ability})`
}

function abilityScoreGroupValue(ability: string, modifierKind: string): string {
  const prefix = `"ABILITY_SCORE:${modifierKind}|ability="`
  const aliases = [
    ['STR', 'STRENGTH'],
    ['DEX', 'DEXTERITY'],
    ['CON', 'CONSTITUTION'],
    ['INT', 'INTELLIGENCE'],
    ['WIS', 'WISDOM'],
    ['CHA', 'CHARISMA']
  ]
  const domainMatches = [
    `(group.domainKey == (${prefix} + ${ability}))`,
    ...aliases.flatMap(([short, long]) => [
      `((${ability} == "${short}") and (group.domainKey == (${prefix} + "${long}")))`,
      `((${ability} == "${long}") and (group.domainKey == (${prefix} + "${short}")))`
    ])
  ].join(' or ')
  const groups = `filter($.abilityScoreModifierGroups as group, (${domainMatches}) and group.modifierKind == "${modifierKind}")`
  if (modifierKind === 'SET_VALUE') {
    const latest = `filter(${groups}, #.lastAcceptedModifierIndex == max(map(${groups}, #.lastAcceptedModifierIndex)))`
    return `(len(${groups}) == 0 ? 0 : ${latest}[0].effective)`
  }
  return `(len(${groups}) == 0 ? 0 : sum(map(${groups}, #.effective)))`
}

function abilityScoreSetPresent(ability: string): string {
  const alias = abilityAlias(ability)
  const groups = `filter($.abilityScoreModifierGroups as group, group.modifierKind == "SET_VALUE" and (group.domainKey == ("ABILITY_SCORE:SET_VALUE|ability=" + ${ability}) or group.domainKey == ("ABILITY_SCORE:SET_VALUE|ability=" + ${alias})))`
  return `len(${groups}) != 0`
}

function effectiveAbilityScore(ability: string, base: string): string {
  const set = abilityScoreGroupValue(ability, 'SET_VALUE')
  const setPresent = abilityScoreSetPresent(ability)
  const bonuses = ['BONUS', 'PENALTY']
    .map((kind) => abilityScoreGroupValue(ability, kind))
    .join(' + ')
  return `(${setPresent} ? ${set} : ${base}) + ${bonuses}`
}

function resolvedAbilityScore(ability: string): string {
  const alias = abilityAlias(ability)
  const scores = `filter($.resolvedAbilityScores as score, score.abilityId == ${ability} or score.abilityId == ${alias})`
  return `(len(${scores}) == 0 ? 10 : ${scores}[0].effective)`
}

const scalarModifierValue = `
  group.modifierKind == "BONUS" or group.modifierKind == "PENALTY" ?
    (contribution.grant.payload.valueKind == null ? (contribution.grant.payload.value == null ? (contribution.grant.payload.amount == null ? 0 : contribution.grant.payload.amount) : contribution.grant.payload.value) :
      contribution.grant.payload.valueKind == "SKILL_BONUS" or contribution.grant.payload.valueKind == "SPELL_SLOT_LEVEL" ? 0 :
      contribution.grant.payload.valueKind == "PROFICIENCY_BONUS" ? (floor((max([totalLevel, 1]) - 1) / 4) + 2) * (contribution.grant.payload.multiplier == null ? 1 : contribution.grant.payload.multiplier) :
      contribution.grant.payload.valueKind == "CHARACTER_LEVEL" ? totalLevel * (contribution.grant.payload.multiplier == null ? 1 : contribution.grant.payload.multiplier) :
      contribution.grant.payload.valueKind == "CLASS_LEVEL" ?
        (len(filter(grantFoldFacts.base.classes as klass, klass.classId == contribution.grant.payload.classId)) == 0 ? 0 : filter(grantFoldFacts.base.classes as klass, klass.classId == contribution.grant.payload.classId)[0].level) * (contribution.grant.payload.multiplier == null ? 1 : contribution.grant.payload.multiplier) :
      contribution.grant.payload.valueKind == "FIXED" ? (contribution.grant.payload.amount == null ? (contribution.grant.payload.value == null ? 0 : contribution.grant.payload.value) : contribution.grant.payload.amount) :
      (contribution.grant.payload.value == null ? (contribution.grant.payload.amount == null ? 0 : contribution.grant.payload.amount) : contribution.grant.payload.value)) :
  group.modifierKind == "SET_VALUE" or group.modifierKind == "MODIFY_CHARGE_LIMIT" ?
    (contribution.grant.payload.value == null ? (contribution.grant.payload.amount == null ? 0 : contribution.grant.payload.amount) : contribution.grant.payload.value) :
  group.modifierKind == "ABILITY_MODIFIER_BONUS" or group.modifierKind == "OPTIONAL_ABILITY_MODIFIER_BONUS" ? null :
  group.modifierKind == "ADVANTAGE" or group.modifierKind == "DISADVANTAGE" or group.modifierKind == "ADD_OPTION" or group.modifierKind == "REMOVE_OPTION" or group.modifierKind == "ADD_BONUS_DIE" ? 1 :
  group.modifierKind == "REPLACE_DAMAGE_TYPE" ? 0 :
  group.valueDomainCode == "ABILITY_SCORE" ? 0 : null
`.replace(/\s+/g, ' ')

const abilityModifierValue = `
  group.modifierKind == "ABILITY_MODIFIER_BONUS" ?
    max([contribution.grant.payload.min == null ? -999 : contribution.grant.payload.min, min([contribution.grant.payload.max == null ? 999 : contribution.grant.payload.max, floor((${resolvedAbilityScore('contribution.grant.payload.ability')} - 10) / 2) * (contribution.grant.payload.multiplier == null ? 1 : contribution.grant.payload.multiplier)])]) :
  group.modifierKind == "OPTIONAL_ABILITY_MODIFIER_BONUS" ? (len(contribution.grant.payload.abilities) == 0 ? 0 : max(map(contribution.grant.payload.abilities as ability, floor((${resolvedAbilityScore('ability')} - 10) / 2)))) :
  null
`.replace(/\s+/g, ' ')

const stackingRule =
  '(modifierKind == "SET_VALUE" or modifierKind == "REPLACE_DAMAGE_TYPE" or modifierKind == "REPLACE_RANGE_KIND" or modifierKind == "REPLACE_DURATION_KIND" or modifierKind == "REPLACE_SHAPE_KIND" or modifierKind == "REPLACE_CHARGE_RESET_KIND") ? "last" : (modifierKind == "ADVANTAGE" or modifierKind == "DISADVANTAGE") ? "boolean" : "additive"'

const resolvedContributions = (numericValue: string) =>
  `filter(map(group.contributions as contribution, merge([contribution, { resolvedValue: ${numericValue} }])), #.resolvedValue != null)`

const groupStacking = (group = 'group') =>
  `(${stackingRule.replaceAll('modifierKind', `${group}.modifierKind`)})`
const selectedAcceptedModifierIndex = (contributions: string, group = 'group') => {
  const stacking = groupStacking(group)
  return `(${stacking} == "additive" or len(${contributions}) == 0 ? null : ${stacking} == "last" ? ${contributions}[len(${contributions}) - 1].acceptedModifierIndex : ${stacking} == "boolean" ? (some(${contributions}, #.resolvedValue != 0) ? filter(${contributions}, #.resolvedValue != 0)[0].acceptedModifierIndex : null) : null)`
}
const resolvedEffective = (contributions: string, group = 'group') => {
  const stacking = groupStacking(group)
  return `${stacking} == "additive" ? sum(map(${contributions}, #.resolvedValue)) : ${stacking} == "last" ? (len(${contributions}) == 0 ? 0 : ${contributions}[len(${contributions}) - 1].resolvedValue) : ${stacking} == "boolean" ? (some(${contributions}, #.resolvedValue != 0) ? filter(${contributions}, #.resolvedValue != 0)[0].resolvedValue : 0) : 0`
}

const rawResolvedContributions = 'resolvedModifierContributions'
const resolvedGroupStates = 'resolvedModifierGroupStates'
const resolvedAbilityScores = 'resolvedAbilityScores'
const abilityScoreModifierGroups = 'abilityScoreModifierGroups'
const scalarResolvedContributions = 'scalarResolvedContributions'
const abilityResolvedContributions = 'abilityResolvedContributions'
const abilityScoreResolvedContributions = `filter($.${scalarResolvedContributions} as resolved, resolved.domainKey == group.domainKey)[0].contributions`

/** Ordered expressions consumed by the single Character calculations node. */
export const dnd5e2014CharacterModifierPolicyExpressions = [
  {
    id: 'scalar-resolved-contributions',
    key: scalarResolvedContributions,
    value: `map(filter(grantFold.modifierGroups as group, group.modifierKind != "ABILITY_MODIFIER_BONUS" and group.modifierKind != "OPTIONAL_ABILITY_MODIFIER_BONUS") as group, { domainKey: group.domainKey, contributions: ${resolvedContributions(scalarModifierValue)} })`
  },
  {
    id: 'ability-score-modifier-groups',
    key: abilityScoreModifierGroups,
    value: `map(filter(grantFold.modifierGroups as group, group.valueDomainCode == "ABILITY_SCORE" and group.modifierKind != "ABILITY_MODIFIER_BONUS" and group.modifierKind != "OPTIONAL_ABILITY_MODIFIER_BONUS") as group, { domainKey: group.domainKey, modifierKind: group.modifierKind, lastAcceptedModifierIndex: len(${abilityScoreResolvedContributions}) == 0 ? -1 : ${abilityScoreResolvedContributions}[len(${abilityScoreResolvedContributions}) - 1].acceptedModifierIndex, effective: group.modifierKind == "SET_VALUE" ? (len(${abilityScoreResolvedContributions}) == 0 ? 0 : ${abilityScoreResolvedContributions}[len(${abilityScoreResolvedContributions}) - 1].resolvedValue) : sum(map(${abilityScoreResolvedContributions}, #.resolvedValue)) })`
  },
  {
    id: 'resolved-ability-scores',
    key: resolvedAbilityScores,
    value: `map(derivedBaseFacts.abilities as ability, { abilityId: ability.abilityId, effective: ${effectiveAbilityScore('ability.abilityId', 'ability.baseScore')} })`
  },
  {
    id: 'ability-resolved-contributions',
    key: abilityResolvedContributions,
    value: `map(filter(grantFold.modifierGroups as group, group.modifierKind == "ABILITY_MODIFIER_BONUS" or group.modifierKind == "OPTIONAL_ABILITY_MODIFIER_BONUS") as group, { domainKey: group.domainKey, contributions: ${resolvedContributions(abilityModifierValue)} })`
  },
  {
    id: 'resolved-modifier-contributions',
    key: rawResolvedContributions,
    value: `map(grantFold.modifierGroups as group, { domainKey: group.domainKey, valueDomainCode: group.valueDomainCode, modifierKind: group.modifierKind, contributions: (group.modifierKind == "ABILITY_MODIFIER_BONUS" or group.modifierKind == "OPTIONAL_ABILITY_MODIFIER_BONUS") ? filter($.${abilityResolvedContributions} as resolved, resolved.domainKey == group.domainKey)[0].contributions : filter($.${scalarResolvedContributions} as resolved, resolved.domainKey == group.domainKey)[0].contributions })`
  },
  {
    id: 'resolved-modifier-group-states',
    key: resolvedGroupStates,
    value: `map($.${rawResolvedContributions} as group, { domainKey: group.domainKey, valueDomainCode: group.valueDomainCode, modifierKind: group.modifierKind, effective: ${resolvedEffective('group.contributions')}, contributions: map(group.contributions as contribution, { acceptedModifierIndex: contribution.acceptedModifierIndex, sourceId: contribution.sourceId, grantId: contribution.grantId, domainKey: group.domainKey, value: contribution.resolvedValue, state: ${groupStacking()} == "additive" or contribution.acceptedModifierIndex == ${selectedAcceptedModifierIndex('group.contributions')} ? "APPLIED" : "SUPPRESSED", reasonCode: ${groupStacking()} == "additive" or contribution.acceptedModifierIndex == ${selectedAcceptedModifierIndex('group.contributions')} ? "STACKED" : "SUPPRESSED_BY_STACKING" }) })`
  },
  {
    id: 'resolved-modifier-groups',
    key: 'resolvedModifierGroups',
    value: `map($.${resolvedGroupStates} as group, { domainKey: group.domainKey, valueDomainCode: group.valueDomainCode, modifierKind: group.modifierKind, effective: group.effective, contributions: map(group.contributions as contribution, { acceptedModifierIndex: contribution.acceptedModifierIndex, sourceId: contribution.sourceId, grantId: contribution.grantId, source: grantFold.modifiers[contribution.acceptedModifierIndex].source, domainKey: contribution.domainKey, value: contribution.value, state: contribution.state, reasonCode: contribution.reasonCode }) })`
  }
]
