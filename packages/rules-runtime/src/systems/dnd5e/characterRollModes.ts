import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import { modifierRollInfluence, type AttackDomainCode } from '@artificer-toolkit/shared/core'
import {
  compareCanonicalD20Contributors,
  rollModeContributorSourceOfMechanicSource
} from '@artificer-toolkit/shared/rules'

import type { CharacterResolvedModifierGroup } from './characterModifiers.js'
import { resolveDnd5eRollMode } from './rollModePolicy.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eAcceptedModifierApplicability,
  dnd5eAttackRequiresEffectSource,
  dnd5eModifierApplies,
  dnd5eSaveRequiresSourceSight,
  type Dnd5eModifierTarget
} from './modifierApplicability.js'

function keyedRecord<Key extends string, Value>(
  keys: readonly Key[],
  value: (key: Key) => Value
): Record<Key, Value> {
  return Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<Key, Value>
}

type RollContributor = CharacterRulePolicyOutput['rollContributorEvidence']['initiative'][number]

/**
 * Advantage and disadvantage contributors of one modifier domain that apply to a target. Suppressed
 * duplicate grants still supply evidence for qualified roll resolution.
 */
function dnd5eRollContributors(
  policy: {
    readonly grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'>
    readonly modifierGroups: readonly Pick<
      CharacterRulePolicyOutput['modifierGroups'][number],
      'contributions'
    >[]
  },
  target: Dnd5eModifierTarget
) {
  return policy.modifierGroups.flatMap((group) =>
    group.contributions.flatMap((contribution) => {
      const modifier =
        contribution.acceptedModifierIndex === undefined
          ? undefined
          : policy.grantFold.modifiers[contribution.acceptedModifierIndex]
      if (modifier === undefined) throw new Error('Character roll modifier provenance is missing.')
      const influence = modifierRollInfluence(modifier)
      if (
        influence === null ||
        dnd5eSaveRequiresSourceSight(modifier) ||
        dnd5eAttackRequiresEffectSource(modifier) ||
        !dnd5eModifierApplies(dnd5eAcceptedModifierApplicability(modifier), target)
      )
        return []
      if (!contribution.source || !contribution.grantId || !contribution.domainKey)
        throw new Error('Character roll contributors require provenance.')
      const { domain } = modifier
      return [
        {
          valueDomainCode: modifier.valueDomainCode,
          ability: domain.ability ?? null,
          conditionTypeId: domain.conditionTypeId,
          ruleDefinitionId: domain.ruleDefinitionId,
          skillId: domain.skillId,
          attackDomain: domain.attackDomain,
          evidence: {
            sourceId: contribution.sourceId,
            source: rollModeContributorSourceOfMechanicSource(contribution.source),
            grantId: contribution.grantId,
            domainKey: contribution.domainKey,
            influence
          } satisfies RollContributor
        }
      ]
    })
  )
}

/**
 * The attack-roll contributors for one attack kind that apply to a target: Character-wide ones,
 * plus the attacking source's own and item-faceted ones when an attack is evaluated. The Sheet
 * action and the Encounter attack both read this, in canonical order.
 */
export function dnd5eAttackRollContributors(
  policy: Parameters<typeof dnd5eRollContributors>[0],
  attackKind: AttackDomainCode,
  target: Dnd5eModifierTarget
): RollContributor[] {
  return dnd5eRollContributors(policy, target)
    .filter(
      (entry) =>
        entry.valueDomainCode === 'ATTACK_ROLL' &&
        entry.attackDomain === attackKind &&
        // A grant naming an ability covers only attacks made with it.
        (entry.ability === null || entry.ability === target.attackAbility)
    )
    .map((entry) => entry.evidence)
    .sort(compareCanonicalD20Contributors)
}

export function evaluateDnd5eCharacterRollModes(
  input: CharacterRulePolicyInput,
  fold: CharacterGrantFoldOutput,
  groups: CharacterResolvedModifierGroup[]
): Pick<CharacterRulePolicyOutput, 'rollModes' | 'rollContributorEvidence'> {
  const policy = { grantFold: fold, modifierGroups: groups }
  const contributors = dnd5eRollContributors(policy, DND5E_CHARACTER_WIDE_TARGET)
  type Contributor = (typeof contributors)[number]
  const matching = (predicate: (entry: Contributor) => boolean) =>
    contributors.filter(predicate).map((entry) => entry.evidence)
  const abilityCheck = (entry: Contributor, ability: string | null) =>
    entry.valueDomainCode === 'ABILITY_CHECK' &&
    (entry.ability === null || entry.ability === ability)
  const abilities = input.derivedBaseFacts.abilities.map(({ abilityId }) => abilityId)
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
    abilityChecks: keyedRecord(abilities, (ability) =>
      matching((entry) => abilityCheck(entry, ability))
    ),
    savingThrows: keyedRecord(abilities, (ability) =>
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
          abilityCheck(entry, skill?.governingAbilityId ?? null) ||
          (entry.valueDomainCode === 'SKILL_MODIFIER' &&
            skill?.proficiencySubjectIds.some((alias) => alias === entry.skillId) === true)
      )
    }),
    attacks: keyedRecord(attacks, (attack) =>
      dnd5eAttackRollContributors(policy, attack, DND5E_CHARACTER_WIDE_TARGET)
    )
  }
  return {
    rollContributorEvidence,
    rollModes: {
      initiative: resolveDnd5eRollMode(rollContributorEvidence.initiative).rollMode,
      abilityChecks: keyedRecord(
        abilities,
        (key) => resolveDnd5eRollMode(rollContributorEvidence.abilityChecks[key]).rollMode
      ),
      savingThrows: keyedRecord(
        abilities,
        (key) => resolveDnd5eRollMode(rollContributorEvidence.savingThrows[key]).rollMode
      ),
      skillChecks: keyedRecord(
        skills,
        (key) => resolveDnd5eRollMode(rollContributorEvidence.skillChecks[key]).rollMode
      ),
      attacks: keyedRecord(
        attacks,
        (key) => resolveDnd5eRollMode(rollContributorEvidence.attacks[key]).rollMode
      )
    }
  }
}
