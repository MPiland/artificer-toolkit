const abilityCodes = [
  'STRENGTH',
  'DEXTERITY',
  'CONSTITUTION',
  'INTELLIGENCE',
  'WISDOM',
  'CHARISMA'
] as const

const skillIds = [
  'acrobatics',
  'animal-handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight-of-hand',
  'stealth',
  'survival'
] as const

function abilityAlias(value: string): string {
  return `(${value} == "STR" ? "STRENGTH" : ${value} == "DEX" ? "DEXTERITY" : ${value} == "CON" ? "CONSTITUTION" : ${value} == "INT" ? "INTELLIGENCE" : ${value} == "WIS" ? "WISDOM" : ${value} == "CHA" ? "CHARISMA" : ${value})`
}

function rollMode(match: string): string {
  const has = (influence: 'ADVANTAGE' | 'DISADVANTAGE') =>
    `some($.rollModeContributors as contributor, contributor.influence == "${influence}" and (${match.replaceAll('modifier', 'contributor')}))`
  return `(${has('ADVANTAGE')} ? (${has('DISADVANTAGE')} ? "NORMAL" : "ADVANTAGE") : (${has('DISADVANTAGE')} ? "DISADVANTAGE" : "NORMAL"))`
}

function contributors(match: string): string {
  return `map(filter($.rollModeContributors as contributor, ${match.replaceAll('modifier', 'contributor')}) as contributor, { sourceId: contributor.sourceId, source: contributor.source, grantId: contributor.grantId, domainKey: contributor.domainKey, influence: contributor.influence })`
}

function abilityCheckMatch(ability: string): string {
  return `modifier.valueDomainCode == "ABILITY_CHECK" and (modifier.ability == null or modifier.ability == ${ability})`
}

function savingThrowMatch(ability: string): string {
  return `modifier.valueDomainCode == "SAVING_THROW_MODIFIER" and modifier.ability == "${ability}" and modifier.conditionTypeId == null`
}

function skillCheckMatch(skillId: string): string {
  const record = `filter(derivedBaseFacts.skills as candidate, candidate.skillId == "${skillId}")[0]`
  return `(${abilityCheckMatch(abilityAlias(`${record}.governingAbilityId`))} or (modifier.valueDomainCode == "SKILL_MODIFIER" and some(${record}.proficiencySubjectIds as alias, alias == modifier.skillId)))`
}

/** Ordered expressions consumed by the single Character calculations node. */
const modeExpressions = [
  {
    id: 'roll-mode-contributors',
    key: 'rollModeContributors',
    value: `flatten(map(filter($.resolvedModifierGroups as group, group.effective == 1 and (group.modifierKind == "ADVANTAGE" or group.modifierKind == "DISADVANTAGE")) as group, map(group.contributions as contribution, { sourceId: contribution.sourceId, source: contribution.source, grantId: contribution.grantId, domainKey: contribution.domainKey, influence: group.modifierKind, valueDomainCode: group.valueDomainCode, ability: ${abilityAlias('grantFold.modifiers[contribution.acceptedModifierIndex].grant.domain.ability')}, conditionTypeId: grantFold.modifiers[contribution.acceptedModifierIndex].grant.domain.conditionTypeId, skillId: grantFold.modifiers[contribution.acceptedModifierIndex].grant.domain.skillId, attackDomain: grantFold.modifiers[contribution.acceptedModifierIndex].grant.domain.attackDomain })))`
  },
  {
    id: 'initiative-roll-mode',
    key: 'rollModeInitiative',
    value: rollMode('modifier.valueDomainCode == "INITIATIVE"')
  }
]

for (const ability of abilityCodes) {
  modeExpressions.push(
    {
      id: `ability-check-roll-mode-${ability}`,
      key: `rollModeAbilityCheck${ability}`,
      value: rollMode(abilityCheckMatch(`"${ability}"`))
    },
    {
      id: `saving-throw-roll-mode-${ability}`,
      key: `rollModeSavingThrow${ability}`,
      value: rollMode(savingThrowMatch(ability))
    }
  )
}

for (const skillId of skillIds) {
  modeExpressions.push({
    id: `skill-roll-mode-${skillId}`,
    key: `rollModeSkill${skillId.replaceAll('-', '_')}`,
    value: rollMode(skillCheckMatch(skillId))
  })
}

for (const attack of ['MELEE', 'RANGED', 'SPELL', 'UNARMED']) {
  modeExpressions.push({
    id: `attack-roll-mode-${attack}`,
    key: `rollModeAttack${attack}`,
    value: rollMode(
      `modifier.valueDomainCode == "ATTACK_ROLL" and modifier.attackDomain == "${attack}"`
    )
  })
}

const objectEntries = (entries: readonly string[], key: (entry: string) => string) =>
  `{ ${entries.map((entry) => `"${entry}": $.${key(entry)}`).join(', ')} }`

const objectValues = (entries: readonly string[], value: (entry: string) => string) =>
  `{ ${entries.map((entry) => `"${entry}": ${value(entry)}`).join(', ')} }`

export const dnd5e2014CharacterRollModePolicyExpressions = [
  ...modeExpressions,
  {
    id: 'resolved-roll-modes',
    key: 'rollModes',
    value: `{ initiative: $.rollModeInitiative, abilityChecks: ${objectEntries(abilityCodes, (ability) => `rollModeAbilityCheck${ability}`)}, savingThrows: ${objectEntries(abilityCodes, (ability) => `rollModeSavingThrow${ability}`)}, skillChecks: ${objectEntries(skillIds, (skillId) => `rollModeSkill${skillId.replaceAll('-', '_')}`)}, attacks: ${objectEntries(['MELEE', 'RANGED', 'SPELL', 'UNARMED'], (attack) => `rollModeAttack${attack}`)} }`
  },
  {
    id: 'resolved-roll-contributor-evidence',
    key: 'rollContributorEvidence',
    value: `{ initiative: ${contributors('modifier.valueDomainCode == "INITIATIVE"')}, abilityChecks: ${objectValues(abilityCodes, (ability) => contributors(abilityCheckMatch(`"${ability}"`)))}, savingThrows: ${objectValues(abilityCodes, (ability) => contributors(savingThrowMatch(ability)))}, skillChecks: ${objectValues(skillIds, (skillId) => contributors(skillCheckMatch(skillId)))}, attacks: ${objectValues(['MELEE', 'RANGED', 'SPELL', 'UNARMED'], (attack) => contributors(`modifier.valueDomainCode == "ATTACK_ROLL" and modifier.attackDomain == "${attack}"`))} }`
  }
]
