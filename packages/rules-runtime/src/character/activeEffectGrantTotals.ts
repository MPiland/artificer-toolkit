import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldSense
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'

import { modifierLengthFeet } from '../modifierLength.js'
import {
  listHitPointMaximumReductions,
  reduceHitPointMaximum
} from './hitPointMaximumReductions.js'

// Grant reads the Sheet and the Encounter share. This module must stay free of `encounter*` imports:
// the browser bundles it through the Sheet projection (ADR 0036 S6, rulesRuntimeBoundary.test.ts).

/** A grant a holder carries from an Active Effect, in the Character grant fold's modifier shape. */
type ActiveEffectGrant = {
  effectId: string
  modifiers: readonly CharacterGrantFoldModifier[]
  senses: readonly CharacterGrantFoldSense[]
  sourceLabel: string
  sourceHidden: boolean
}

export function listActiveEffectGrants(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): ActiveEffectGrant[] {
  return effects.flatMap(({ id, definition }) =>
    definition.schemaVersion === 2
      ? definition.stateContributions.flatMap((contribution) =>
          contribution.kind === 'MODIFIER_GRANT'
            ? [
                {
                  effectId: id,
                  modifiers: contribution.modifiers,
                  senses: contribution.senses,
                  sourceLabel: contribution.sourceLabel,
                  sourceHidden: contribution.sourceHidden
                }
              ]
            : []
        )
      : []
  )
}

export function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

type DomainFilter = (domain: CharacterGrantFoldModifier['domain']) => boolean

/** The global active bonuses and penalties to one value domain whose domain `applies` accepts. */
function* activeBonusGrants(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  valueDomainCode: string,
  applies: DomainFilter
) {
  for (const { modifiers } of listActiveEffectGrants(effects)) {
    for (const modifier of modifiers) {
      if (
        modifier.valueDomainCode === valueDomainCode &&
        (modifier.modifierKind === 'BONUS' || modifier.modifierKind === 'PENALTY') &&
        modifier.scope === 'GLOBAL' &&
        applies(modifier.domain)
      )
        yield { sign: modifier.modifierKind === 'PENALTY' ? -1 : 1, payload: modifier.payload }
    }
  }
}

/**
 * The net of a holder's active fixed bonuses and penalties to one value domain, for the grants
 * whose domain `applies` accepts.
 */
export function activeFixedGrantTotal(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  valueDomainCode: string,
  applies: DomainFilter = () => true
): number {
  let total = 0
  for (const { sign, payload } of activeBonusGrants(effects, valueDomainCode, applies)) {
    if (payload === undefined || !('valueKind' in payload) || payload.valueKind !== 'FIXED')
      throw new Error(`An active ${valueDomainCode} grant must be a fixed amount.`)
    // A penalty is authored as a positive amount and subtracted once, here.
    total += sign * payload.amount
  }
  return total
}

/**
 * The dice a holder's active global rolled-die grants add to, or subtract from, one d20 test of a
 * value domain (D156), for the grants whose domain `applies` accepts. Dice from different sources
 * stack; one authored grant gives one die however many of its effects the holder carries (two
 * casters' Bless). A hidden source reads as "Unseen source". Sorted by label, then grant, so every
 * roll site and replay sees one order.
 */
function activeRolledDice(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  valueDomainCode: 'ATTACK_ROLL' | 'SAVING_THROW_MODIFIER',
  applies: DomainFilter
): D20AddedDieDto[] {
  const dice = new Map<string, D20AddedDieDto>()
  for (const { modifiers, sourceLabel, sourceHidden } of listActiveEffectGrants(effects)) {
    for (const modifier of modifiers) {
      const { payload } = modifier
      if (
        modifier.valueDomainCode !== valueDomainCode ||
        modifier.modifierKind !== 'ADD_BONUS_DIE' ||
        modifier.scope !== 'GLOBAL' ||
        dice.has(modifier.grantId) ||
        !applies(modifier.domain)
      )
        continue
      if (payload === undefined || !('count' in payload))
        throw new Error('An active rolled-die grant must carry its dice.')
      dice.set(modifier.grantId, {
        label: sourceHidden ? 'Unseen source' : sourceLabel,
        count: payload.count,
        faces: payload.faces,
        sign: payload.sign
      })
    }
  }
  return [...dice]
    .sort(([leftGrant, left], [rightGrant, right]) =>
      left.label === right.label
        ? leftGrant.localeCompare(rightGrant)
        : left.label.localeCompare(right.label)
    )
    .map(([, die]) => die)
}

/**
 * The dice a holder's active grants add to its attack rolls of one attack domain. A grant naming an
 * ability covers only attacks made with it (`attackAbility`).
 */
export function activeAttackRollDice(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  attackDomain: string,
  attackAbility: string | null
): D20AddedDieDto[] {
  return activeRolledDice(
    effects,
    'ATTACK_ROLL',
    (domain) =>
      domain.attackDomain === attackDomain &&
      (domain.ability === undefined || domain.ability === attackAbility)
  )
}

/**
 * The dice a holder's active grants add to its saving throws with one ability ("WISDOM"), or to an
 * ability-less save (a death save) when `abilityCode` is null. A grant naming no ability covers
 * every save; one naming an ability covers only that ability's saves.
 */
export function activeSavingThrowDice(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  abilityCode: string | null
): D20AddedDieDto[] {
  return activeRolledDice(
    effects,
    'SAVING_THROW_MODIFIER',
    (domain) => domain.ability === undefined || domain.ability === abilityCode
  )
}

/**
 * The net feet of a holder's active speed bonuses and penalties, for the grants whose domain
 * `applies` accepts. Each payload is a typed length, converted through the shared unit conversion;
 * one that is not is an invariant failure.
 */
export function activeSpeedGrantFeet(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  applies: DomainFilter
): number {
  let feet = 0
  for (const { sign, payload } of activeBonusGrants(effects, 'SPEED', applies))
    feet += sign * modifierLengthFeet(payload)
  return feet
}

/** The amounts a holder's active global grants of one modifier kind carry for one value domain. */
function activeGlobalAmounts(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  valueDomainCode: string,
  modifierKind: 'SET_VALUE' | 'CAP_VALUE'
): number[] {
  const amounts: number[] = []
  for (const { modifiers } of listActiveEffectGrants(effects)) {
    for (const modifier of modifiers) {
      const { payload } = modifier
      if (
        modifier.valueDomainCode === valueDomainCode &&
        modifier.modifierKind === modifierKind &&
        modifier.scope === 'GLOBAL' &&
        payload !== undefined &&
        'amount' in payload
      )
        amounts.push(payload.amount)
    }
  }
  return amounts
}

/**
 * The highest amount a holder's active global `SET_VALUE` grants set one value domain to, or null
 * when none do. Several grants setting the same value do not add (a second Action Surge on one turn
 * adds no third Action).
 */
export function activeSetValueGrantMaximum(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  valueDomainCode: string
): number | null {
  const amounts = activeGlobalAmounts(effects, valueDomainCode, 'SET_VALUE')
  return amounts.length === 0 ? null : Math.max(...amounts)
}

/**
 * The lowest amount a holder's active global `CAP_VALUE` grants limit one value domain to, or null
 * when none do. Several caps do not add: the tightest applies.
 */
export function activeCapValueGrantMinimum(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  valueDomainCode: string
): number | null {
  const amounts = activeGlobalAmounts(effects, valueDomainCode, 'CAP_VALUE')
  return amounts.length === 0 ? null : Math.min(...amounts)
}

/**
 * The effective maximum hit points the Sheet and the Encounter read, for any holder: a maximum
 * raised or lowered by its active fixed `HIT_POINTS_MAX` grants (Aid), less every active reduction,
 * never below 0. A Character passes its grant-free policy maximum, so its grants count once.
 */
export function effectiveHitPointMaximum(
  maximum: number,
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'createdOrdinal' | 'definition'>[]
): number {
  return reduceHitPointMaximum(
    Math.max(0, maximum + activeFixedGrantTotal(effects, 'HIT_POINTS_MAX')),
    listHitPointMaximumReductions(effects)
  )
}
