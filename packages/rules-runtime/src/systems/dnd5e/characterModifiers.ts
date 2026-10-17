import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { isLengthModifierDomain, modifierLengthFeet } from '../../modifierLength.js'
import { abilityModifier, resolveAbilityModifierBonus } from './abilityModifier.js'
import {
  canonicalCharacterAbility,
  characterPolicyNumber,
  characterPolicyRecord
} from './characterPolicyValues.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eFoldedModifierApplicability,
  dnd5eModifierApplies
} from './modifierApplicability.js'
import { proficiencyBonus } from './proficiencyBonus.js'

type Contribution = CharacterRulePolicyOutput['modifierGroups'][number]['contributions'][number]
export type CharacterResolvedModifierGroup = Omit<
  CharacterRulePolicyOutput['modifierGroups'][number],
  'contributions'
> &
  Pick<CharacterGrantFoldOutput['modifierGroups'][number], 'valueDomainCode' | 'modifierKind'> & {
    contributions: (Contribution &
      Required<Pick<Contribution, 'source' | 'acceptedModifierIndex' | 'grantId' | 'domainKey'>>)[]
  }

export function evaluateDnd5eCharacterModifiers(
  input: CharacterRulePolicyInput,
  grantFold: CharacterGrantFoldOutput
): CharacterResolvedModifierGroup[] {
  type Group = CharacterGrantFoldOutput['modifierGroups'][number]
  /** `ability` is the ability an ability-modifier contribution adds (a finesse choice is the best). */
  type Contribution = Group['contributions'][number] & {
    resolvedValue: number
    ability?: string | null
  }
  const additiveAmount = (payload: Record<string, unknown>): number => {
    if (payload.valueKind == null)
      return characterPolicyNumber(payload.value ?? payload.amount ?? 0)
    if (payload.valueKind === 'SKILL_BONUS' || payload.valueKind === 'SPELL_SLOT_LEVEL') return 0
    if (payload.valueKind === 'PROFICIENCY_BONUS')
      return proficiencyBonus(input.totalLevel) * characterPolicyNumber(payload.multiplier ?? 1)
    if (payload.valueKind === 'CHARACTER_LEVEL')
      return input.totalLevel * characterPolicyNumber(payload.multiplier ?? 1)
    if (payload.valueKind === 'CLASS_LEVEL') {
      return (
        (input.grantFoldFacts.base.classes.find((entry) => entry.classId === payload.classId)
          ?.level ?? 0) * characterPolicyNumber(payload.multiplier ?? 1)
      )
    }
    if (payload.valueKind === 'FIXED')
      return characterPolicyNumber(payload.amount ?? payload.value ?? 0)
    return characterPolicyNumber(payload.value ?? payload.amount ?? 0)
  }
  const scalarValue = (
    group: Group,
    contribution: Group['contributions'][number]
  ): number | null => {
    const payload = characterPolicyRecord(characterPolicyRecord(contribution.grant).payload)
    // A speed or sense range is a typed length; its contribution is the feet it converts to.
    if (
      isLengthModifierDomain(group.valueDomainCode) &&
      ['BONUS', 'PENALTY', 'SET_VALUE'].includes(group.modifierKind)
    ) {
      const feet = modifierLengthFeet(payload)
      return group.modifierKind === 'PENALTY' ? -feet : feet
    }
    // A penalty is authored as a positive amount and is negated here, once, for every consumer.
    if (group.modifierKind === 'PENALTY') return -additiveAmount(payload)
    if (group.modifierKind === 'BONUS') return additiveAmount(payload)
    if (group.modifierKind === 'SET_VALUE' || group.modifierKind === 'MODIFY_CHARGE_LIMIT') {
      return characterPolicyNumber(payload.value ?? payload.amount ?? 0)
    }
    if (
      [
        'ADVANTAGE',
        'DISADVANTAGE',
        'ADD_OPTION',
        'REMOVE_OPTION',
        'ADD_BONUS_DIE',
        'ENABLE',
        // A fraction is read from its payload by the domain that owns it (a speed).
        'MULTIPLY'
      ].includes(group.modifierKind)
    )
      return 1
    if (group.modifierKind === 'REPLACE_DAMAGE_TYPE' || group.valueDomainCode === 'ABILITY_SCORE')
      return 0
    return null
  }
  const isAbilityModifier = (kind: string) =>
    kind === 'ABILITY_MODIFIER_BONUS' || kind === 'OPTIONAL_ABILITY_MODIFIER_BONUS'
  const scalarGroups = grantFold.modifierGroups
    .filter((group) => !isAbilityModifier(group.modifierKind))
    .map((group) => ({
      ...group,
      contributions: group.contributions.flatMap((contribution): Contribution[] => {
        const resolvedValue = scalarValue(group, contribution)
        return resolvedValue === null ? [] : [{ ...contribution, resolvedValue }]
      })
    }))
  const abilityGroups = scalarGroups
    .filter((group) => group.valueDomainCode === 'ABILITY_SCORE')
    .map((group) => {
      const contributions = group.contributions.filter((contribution) =>
        dnd5eModifierApplies(
          dnd5eFoldedModifierApplicability(grantFold, contribution),
          DND5E_CHARACTER_WIDE_TARGET
        )
      )
      return {
        ...group,
        lastAcceptedModifierIndex: contributions.at(-1)?.acceptedModifierIndex ?? -1,
        effective:
          group.modifierKind === 'SET_VALUE'
            ? (contributions.at(-1)?.resolvedValue ?? 0)
            : contributions.reduce((sum, contribution) => sum + contribution.resolvedValue, 0)
      }
    })
    .filter((group) => group.lastAcceptedModifierIndex >= 0)
  const abilityScores = input.derivedBaseFacts.abilities.map((ability) => {
    const groups = abilityGroups.filter((group) => {
      const prefix = `ABILITY_SCORE:${group.modifierKind}|ability=`
      return (
        group.domainKey.startsWith(prefix) &&
        canonicalCharacterAbility(group.domainKey.slice(prefix.length)) ===
          canonicalCharacterAbility(ability.abilityId)
      )
    })
    const sets = groups.filter((group) => group.modifierKind === 'SET_VALUE')
    const selected = sets.reduce<(typeof sets)[number] | undefined>(
      (latest, group) =>
        latest === undefined || group.lastAcceptedModifierIndex > latest.lastAcceptedModifierIndex
          ? group
          : latest,
      undefined
    )
    return {
      abilityId: ability.abilityId,
      effective:
        (selected?.effective ?? ability.baseScore) +
        groups
          .filter((group) => group.modifierKind === 'BONUS' || group.modifierKind === 'PENALTY')
          .reduce((sum, group) => sum + group.effective, 0)
    }
  })
  const abilityModifierOf = (ability: unknown) => {
    const score =
      abilityScores.find(
        (entry) => canonicalCharacterAbility(entry.abilityId) === canonicalCharacterAbility(ability)
      )?.effective ?? 10
    return abilityModifier(score)
  }
  return grantFold.modifierGroups.map((group): CharacterResolvedModifierGroup => {
    const contributions = isAbilityModifier(group.modifierKind)
      ? group.contributions.map((contribution): Contribution => {
          const payload = characterPolicyRecord(characterPolicyRecord(contribution.grant).payload)
          if (group.modifierKind === 'ABILITY_MODIFIER_BONUS') {
            return {
              ...contribution,
              ability: canonicalCharacterAbility(payload.ability),
              resolvedValue: resolveAbilityModifierBonus(
                abilityModifierOf(payload.ability),
                payload
              )
            }
          }
          const best = Array.isArray(payload.abilities)
            ? payload.abilities.reduce<unknown>(
                (chosen, candidate) =>
                  chosen === undefined || abilityModifierOf(candidate) > abilityModifierOf(chosen)
                    ? candidate
                    : chosen,
                undefined
              )
            : undefined
          return {
            ...contribution,
            ability: canonicalCharacterAbility(best),
            resolvedValue:
              best === undefined ? 0 : resolveAbilityModifierBonus(abilityModifierOf(best), payload)
          }
        })
      : (
          scalarGroups.find((candidate) => candidate.domainKey === group.domainKey)
            ?.contributions ?? []
        ).map((contribution): Contribution => {
          // An armor class formula ("10 + DEX + CON") adds each listed ability modifier.
          const abilities = characterPolicyRecord(
            characterPolicyRecord(contribution.grant).payload
          ).abilities
          return group.modifierKind === 'SET_VALUE' && Array.isArray(abilities)
            ? {
                ...contribution,
                resolvedValue: abilities.reduce<number>(
                  (sum, ability) => sum + abilityModifierOf(ability),
                  contribution.resolvedValue
                )
              }
            : contribution
        })
    const stacking = [
      'SET_VALUE',
      'REPLACE_DAMAGE_TYPE',
      'REPLACE_RANGE_KIND',
      'REPLACE_DURATION_KIND',
      'REPLACE_SHAPE_KIND',
      'REPLACE_CHARGE_RESET_KIND'
    ].includes(group.modifierKind)
      ? // Extra Attack sources do not add or override each other: the best one applies.
        group.valueDomainCode === 'ATTACKS_PER_ATTACK_ACTION'
        ? 'highest'
        : 'last'
      : ['ADVANTAGE', 'DISADVANTAGE'].includes(group.modifierKind)
        ? 'boolean'
        : 'additive'
    const selected =
      stacking === 'last'
        ? contributions.at(-1)
        : stacking === 'highest'
          ? contributions.reduce<(typeof contributions)[number] | undefined>(
              (best, entry) =>
                best === undefined || entry.resolvedValue > best.resolvedValue ? entry : best,
              undefined
            )
          : stacking === 'boolean'
            ? contributions.find((entry) => entry.resolvedValue !== 0)
            : undefined
    return {
      domainKey: group.domainKey,
      valueDomainCode: group.valueDomainCode,
      modifierKind: group.modifierKind,
      effective:
        stacking === 'additive'
          ? contributions.reduce((sum, entry) => sum + entry.resolvedValue, 0)
          : (selected?.resolvedValue ?? 0),
      contributions: contributions.map((contribution) => {
        const applied =
          stacking === 'additive' ||
          contribution.acceptedModifierIndex === selected?.acceptedModifierIndex
        const source = grantFold.modifiers[contribution.acceptedModifierIndex]?.source
        if (source === undefined) throw new Error('Character modifier provenance is missing.')
        return {
          acceptedModifierIndex: contribution.acceptedModifierIndex,
          sourceId: contribution.sourceId,
          grantId: contribution.grantId,
          source,
          domainKey: group.domainKey,
          value: contribution.resolvedValue,
          ...(contribution.ability == null ? {} : { ability: contribution.ability }),
          state: applied ? 'APPLIED' : 'SUPPRESSED',
          reasonCode: applied ? 'STACKED' : 'SUPPRESSED_BY_STACKING'
        }
      })
    }
  })
}
