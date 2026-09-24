import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import { abilityCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { resolveD20Contributors } from '@artificer-toolkit/shared/rolls'

import type { CharacterResolvedModifierGroup } from './characterModifiers.js'
import { canonicalCharacterAbility, characterPolicyRecord } from './characterPolicyValues.js'

function keyedRecord<Key extends string, Value>(
  keys: readonly Key[],
  value: (key: Key) => Value
): Record<Key, Value> {
  return Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<Key, Value>
}

export function evaluateDnd5eCharacterRollModes(
  input: CharacterRulePolicyInput,
  fold: CharacterGrantFoldOutput,
  groups: CharacterResolvedModifierGroup[]
): Pick<CharacterRulePolicyOutput, 'rollModes' | 'rollContributorEvidence'> {
  const contributors = groups.flatMap((group) => {
    if (
      group.effective !== 1 ||
      (group.modifierKind !== 'ADVANTAGE' && group.modifierKind !== 'DISADVANTAGE')
    )
      return []
    const influence = group.modifierKind
    // Suppressed duplicate grants still supply private evidence for later qualified roll resolution.
    return group.contributions.map((contribution) => {
      const domain = characterPolicyRecord(
        characterPolicyRecord(fold.modifiers[contribution.acceptedModifierIndex]?.grant).domain
      )
      return {
        valueDomainCode: group.valueDomainCode,
        ability: canonicalCharacterAbility(domain.ability),
        conditionTypeId: domain.conditionTypeId,
        ruleDefinitionId: domain.ruleDefinitionId,
        skillId: domain.skillId,
        attackDomain: domain.attackDomain,
        evidence: {
          sourceId: contribution.sourceId,
          source: contribution.source,
          grantId: contribution.grantId,
          domainKey: contribution.domainKey,
          influence
        } satisfies CharacterRulePolicyOutput['rollContributorEvidence']['initiative'][number]
      }
    })
  })
  type Contributor = (typeof contributors)[number]
  const matching = (predicate: (entry: Contributor) => boolean) =>
    contributors.filter(predicate).map((entry) => entry.evidence)
  const abilityCheck = (entry: Contributor, ability: string | null) =>
    entry.valueDomainCode === 'ABILITY_CHECK' &&
    (entry.ability === null || entry.ability === ability)
  const attacks = ['MELEE', 'RANGED', 'SPELL', 'UNARMED'] as const
  const skills = [
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
  const rollContributorEvidence = {
    initiative: matching((entry) => entry.valueDomainCode === 'INITIATIVE'),
    abilityChecks: keyedRecord(abilityCodeSchema.options, (ability) =>
      matching((entry) => abilityCheck(entry, ability))
    ),
    savingThrows: keyedRecord(abilityCodeSchema.options, (ability) =>
      matching(
        (entry) =>
          entry.valueDomainCode === 'SAVING_THROW_MODIFIER' &&
          entry.ability === ability &&
          entry.conditionTypeId == null &&
          entry.ruleDefinitionId == null
      )
    ),
    skillChecks: keyedRecord(skills, (skillId) => {
      const skill = input.derivedBaseFacts.skills.find((entry) => entry.skillId === skillId)
      return matching(
        (entry) =>
          abilityCheck(entry, canonicalCharacterAbility(skill?.governingAbilityId)) ||
          (entry.valueDomainCode === 'SKILL_MODIFIER' &&
            skill?.proficiencySubjectIds.some((alias) => alias === entry.skillId) === true)
      )
    }),
    attacks: keyedRecord(attacks, (attack) =>
      matching((entry) => entry.valueDomainCode === 'ATTACK_ROLL' && entry.attackDomain === attack)
    )
  }
  return {
    rollContributorEvidence,
    rollModes: {
      initiative: resolveD20Contributors(rollContributorEvidence.initiative).rollMode,
      abilityChecks: keyedRecord(
        abilityCodeSchema.options,
        (key) => resolveD20Contributors(rollContributorEvidence.abilityChecks[key]).rollMode
      ),
      savingThrows: keyedRecord(
        abilityCodeSchema.options,
        (key) => resolveD20Contributors(rollContributorEvidence.savingThrows[key]).rollMode
      ),
      skillChecks: keyedRecord(
        skills,
        (key) => resolveD20Contributors(rollContributorEvidence.skillChecks[key]).rollMode
      ),
      attacks: keyedRecord(
        attacks,
        (key) => resolveD20Contributors(rollContributorEvidence.attacks[key]).rollMode
      )
    }
  }
}
