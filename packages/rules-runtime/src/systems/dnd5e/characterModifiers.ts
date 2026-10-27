import type { CharacterActionModelInput } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import { SPELLCASTING_ABILITY_REFERENCE } from '@artificer-toolkit/shared/core'

import {
  isLengthModifierDomain,
  isSpeedEqualsPayload,
  modifierLengthFeet
} from '../../modifierLength.js'
import { abilityModifier, resolveAbilityModifierBonus } from './abilityModifier.js'
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

type DerivedBaseFacts = CharacterRulePolicyInput['derivedBaseFacts']

/**
 * Resolves folded modifiers into valued groups from the holder facts they read; a Creature supplies
 * its own (ATTACK-6.3).
 */
export function evaluateDnd5eCharacterModifiers(
  input: Pick<CharacterRulePolicyInput, 'totalLevel'> & {
    grantFoldFacts: { base: Pick<CharacterRulePolicyInput['grantFoldFacts']['base'], 'classes'> }
    derivedBaseFacts: {
      abilities: readonly Pick<DerivedBaseFacts['abilities'][number], 'abilityId' | 'baseScore'>[]
      spellcasting: Pick<NonNullable<DerivedBaseFacts['spellcasting']>, 'abilityId'> | null
    }
  },
  grantFold: CharacterGrantFoldOutput
): CharacterResolvedModifierGroup[] {
  type Group = CharacterGrantFoldOutput['modifierGroups'][number]
  /** `ability` is the ability an ability-modifier contribution adds (a finesse choice is the best). */
  type Contribution = Group['contributions'][number] & {
    resolvedValue: number
    ability?: string | null
  }
  type Payload = CharacterGrantFoldOutput['modifiers'][number]['payload']
  const payloadOf = (contribution: Group['contributions'][number]): Payload =>
    grantFold.modifiers[contribution.acceptedModifierIndex]?.payload
  const amountOf = (payload: Payload): number =>
    payload !== undefined && 'amount' in payload ? payload.amount : 0
  const additiveAmount = (payload: Payload): number => {
    if (payload === undefined || !('valueKind' in payload)) return amountOf(payload)
    switch (payload.valueKind) {
      case 'FIXED':
        return payload.amount
      case 'PROFICIENCY_BONUS':
        return proficiencyBonus(input.totalLevel) * (payload.multiplier ?? 1)
      case 'CHARACTER_LEVEL':
        return input.totalLevel * (payload.multiplier ?? 1)
      case 'CLASS_LEVEL':
        return (
          (input.grantFoldFacts.base.classes.find((entry) => entry.classId === payload.classId)
            ?.level ?? 0) * (payload.multiplier ?? 1)
        )
      // Read from the effective ability scores, which these groups feed; resolved below.
      case 'ABILITY_MODIFIER':
      case 'SKILL_BONUS':
      case 'SPELL_SLOT_LEVEL':
        return 0
    }
  }
  const scalarValue = (
    group: Group,
    contribution: Group['contributions'][number]
  ): number | null => {
    const payload = payloadOf(contribution)
    // A speed or sense range is a typed length; its contribution is the feet it converts to.
    if (
      isLengthModifierDomain(group.valueDomainCode) &&
      ['BONUS', 'PENALTY', 'SET_VALUE'].includes(group.modifierKind)
    ) {
      // "Equal to another speed" is a replacement the movement policy resolves from the holder's speeds.
      if (isSpeedEqualsPayload(payload)) return 0
      const feet = modifierLengthFeet(payload)
      return group.modifierKind === 'PENALTY' ? -feet : feet
    }
    // A penalty is authored as a positive amount and is negated here, once, for every consumer.
    if (group.modifierKind === 'PENALTY') return -additiveAmount(payload)
    if (group.modifierKind === 'BONUS') return additiveAmount(payload)
    if (group.modifierKind === 'SET_VALUE' || group.modifierKind === 'MODIFY_CHARGE_LIMIT') {
      return amountOf(payload)
    }
    if (
      [
        'ROLL_INFLUENCE',
        'SUPPRESS_ROLL_INFLUENCE',
        'ADD_OPTION',
        'REMOVE_OPTION',
        'ADD_BONUS_DIE',
        'MINIMUM_ROLL',
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
        group.domainKey.slice(prefix.length) === ability.abilityId
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
  // A modifier naming the spellcasting ability (Shillelagh's) reads the Character's own; with none it
  // adds nothing.
  const spellcastingAbilityId = input.derivedBaseFacts.spellcasting?.abilityId ?? null
  const concreteAbility = (ability: string): string | null =>
    ability === SPELLCASTING_ABILITY_REFERENCE ? spellcastingAbilityId : ability
  const abilityModifierOf = (ability: string) => {
    const score = abilityScores.find((entry) => entry.abilityId === ability)?.effective ?? 10
    return abilityModifier(score)
  }
  return grantFold.modifierGroups.map((group): CharacterResolvedModifierGroup => {
    const contributions = isAbilityModifier(group.modifierKind)
      ? group.contributions.map((contribution): Contribution => {
          const payload = payloadOf(contribution)
          if (payload !== undefined && 'ability' in payload) {
            return {
              ...contribution,
              ability: payload.ability,
              resolvedValue: resolveAbilityModifierBonus(
                abilityModifierOf(payload.ability),
                payload
              )
            }
          }
          if (payload === undefined || !('abilities' in payload) || 'amount' in payload)
            return { ...contribution, ability: null, resolvedValue: 0 }
          const best = payload.abilities
            .flatMap((reference) => concreteAbility(reference) ?? [])
            .reduce<string | undefined>(
              (chosen, candidate) =>
                chosen === undefined || abilityModifierOf(candidate) > abilityModifierOf(chosen)
                  ? candidate
                  : chosen,
              undefined
            )
          return {
            ...contribution,
            ability: best ?? null,
            resolvedValue:
              best === undefined ? 0 : resolveAbilityModifierBonus(abilityModifierOf(best), payload)
          }
        })
      : (
          scalarGroups.find((candidate) => candidate.domainKey === group.domainKey)
            ?.contributions ?? []
        ).map((contribution): Contribution => {
          // An armor class formula ("10 + DEX + CON") adds each listed ability modifier.
          const payload = payloadOf(contribution)
          if (
            (group.modifierKind === 'BONUS' || group.modifierKind === 'PENALTY') &&
            payload !== undefined &&
            'valueKind' in payload &&
            payload.valueKind === 'ABILITY_MODIFIER'
          ) {
            const amount = resolveAbilityModifierBonus(abilityModifierOf(payload.ability), payload)
            return {
              ...contribution,
              resolvedValue: group.modifierKind === 'PENALTY' ? -amount : amount
            }
          }
          return group.modifierKind === 'SET_VALUE' &&
            payload !== undefined &&
            'abilities' in payload
            ? {
                ...contribution,
                resolvedValue: payload.abilities.reduce<number>(
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
      : ['ROLL_INFLUENCE', 'SUPPRESS_ROLL_INFLUENCE'].includes(group.modifierKind)
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

/**
 * Resolved groups as an action reads them: each contribution with the applicability of the folded
 * modifier it came from. Character and Creature attacks read the same groups (ATTACK-6.3).
 */
export function dnd5eActionModifierGroups(
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'>,
  modifierGroups: readonly CharacterResolvedModifierGroup[]
): CharacterActionModelInput['modifierGroups'] {
  return modifierGroups.map((group) => ({
    domainKey: group.domainKey,
    contributions: group.contributions.map((contribution) => ({
      ...dnd5eFoldedModifierApplicability(grantFold, contribution),
      value: contribution.value,
      ability: contribution.ability ?? null,
      state: contribution.state
    }))
  }))
}
