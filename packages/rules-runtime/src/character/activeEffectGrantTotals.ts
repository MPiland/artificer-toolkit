import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldOutput,
  CharacterGrantFoldSense,
  EquipmentInstanceMechanicSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  attackCriticalRules,
  type AttackCriticalRulesDto
} from '@artificer-toolkit/schema/shared/attackCriticalRules'
import type {
  D20AddedDieDto,
  DamageAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { D20MinimumRollDto } from '@artificer-toolkit/schema/shared/d20MinimumRoll'

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
  /** The holder's item the grant is bound to; absent for an unbound grant. */
  boundItem?: EquipmentInstanceMechanicSource
}

export function listActiveEffectGrants(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): ActiveEffectGrant[] {
  return effects.flatMap(({ id, definition }) =>
    definition.stateContributions.flatMap((contribution) =>
      contribution.kind === 'MODIFIER_GRANT'
        ? [
            {
              effectId: id,
              modifiers: contribution.modifiers,
              senses: contribution.senses,
              sourceLabel: contribution.sourceLabel,
              sourceHidden: contribution.sourceHidden,
              ...(contribution.boundItem && { boundItem: contribution.boundItem })
            }
          ]
        : []
    )
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

type RolledDieGrant = {
  effectId: string
  grantId: string
  label: string
  payload: Extract<NonNullable<CharacterGrantFoldModifier['payload']>, { count: number }>
}

/**
 * A holder's active global rolled-die grants to one value domain (D156), for the grants whose
 * domain `applies` accepts. Dice from different sources stack; one authored grant gives one die
 * however many of its effects the holder carries (two casters' Bless). A hidden source reads as
 * "Unseen source". Sorted by label, then grant, so every roll site and replay sees one order.
 * `timing` picks the dice that roll with the d20 or the after-roll dice a roller may add once the
 * d20 is seen.
 */
function activeRolledDieGrants(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  valueDomainCode: 'ATTACK_ROLL' | 'SAVING_THROW_MODIFIER' | 'ABILITY_CHECK' | 'DAMAGE',
  applies: DomainFilter,
  timing: 'WITH_ROLL' | 'AFTER_ROLL' = 'WITH_ROLL'
): RolledDieGrant[] {
  const dice = new Map<string, RolledDieGrant>()
  for (const { effectId, modifiers, sourceLabel, sourceHidden } of listActiveEffectGrants(
    effects
  )) {
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
      if (('timing' in payload && payload.timing === 'AFTER_ROLL') !== (timing === 'AFTER_ROLL'))
        continue
      dice.set(modifier.grantId, {
        effectId,
        grantId: modifier.grantId,
        label: sourceHidden ? 'Unseen source' : sourceLabel,
        payload
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

/** The dice a holder's active grants add to, or subtract from, one d20 test of a value domain. */
function activeRolledDice(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  valueDomainCode: 'ATTACK_ROLL' | 'SAVING_THROW_MODIFIER' | 'ABILITY_CHECK',
  applies: DomainFilter
): D20AddedDieDto[] {
  return activeRolledDieGrants(effects, valueDomainCode, applies).map(
    ({ label, payload: { count, faces, sign } }) => ({ label, count, faces, sign })
  )
}

/**
 * The dice active grants add to, or take from, one creature's damage to another (D156): the
 * dealer's own `HOLDER_DEALS` dice, then the `SOURCE_DEALS_TO_HOLDER` dice the damaged creature
 * holds from effects the dealer is the Encounter source of (the Hunter's Mark it placed). A grant
 * naming an attack domain covers only attacks of that domain; `attackDomain` is null for damage no
 * attack roll delivers. A die naming no damage type takes the damage it joins.
 */
export function activeDamageDice(input: {
  dealerActorId: string
  dealerEffects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
  targetEffects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
  attackDomain: string | null
}): DamageAddedDieDto[] {
  const dice = (
    effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
    recipient: 'HOLDER_DEALS' | 'SOURCE_DEALS_TO_HOLDER'
  ) =>
    activeRolledDieGrants(
      effects,
      'DAMAGE',
      (domain) => domain.attackDomain === undefined || domain.attackDomain === input.attackDomain
    ).flatMap(({ label, payload }) =>
      'recipient' in payload && payload.recipient === recipient
        ? [
            {
              label,
              count: payload.count,
              faces: payload.faces,
              sign: payload.sign,
              damageTypeId: 'damageTypeId' in payload ? payload.damageTypeId : null
            }
          ]
        : []
    )
  const placedByDealer = input.targetEffects.filter(
    ({ definition }) =>
      definition.origin.kind === 'ENCOUNTER' &&
      definition.origin.sourceActorId === input.dealerActorId
  )
  return [
    ...dice(input.dealerEffects, 'HOLDER_DEALS'),
    ...dice(placedByDealer, 'SOURCE_DEALS_TO_HOLDER')
  ]
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
 * The dice a holder's active grants add to its saving throws with one ability (its code), or to an
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
 * The dice a holder's active grants add to its ability checks with one ability (its code), or to
 * an ability-less check when `abilityCode` is null. A grant naming no ability covers every check.
 */
export function activeAbilityCheckDice(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  abilityCode: string | null
): D20AddedDieDto[] {
  return activeRolledDice(
    effects,
    'ABILITY_CHECK',
    (domain) => domain.ability === undefined || domain.ability === abilityCode
  )
}

/**
 * The after-roll dice a holder's active effects hold for an ability check with one ability (or an
 * ability-less check when `abilityCode` is null): each is offered once the d20 is seen, and the
 * holder spends it by ending its effect.
 */
export function activeAfterRollAbilityCheckDice(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  abilityCode: string | null
) {
  return activeRolledDieGrants(
    effects,
    'ABILITY_CHECK',
    (domain) => domain.ability === undefined || domain.ability === abilityCode,
    'AFTER_ROLL'
  ).map(({ effectId, grantId, label, payload: { count, faces, sign } }) => ({
    effectId,
    grantId,
    label,
    count,
    faces,
    sign
  }))
}

/** The label a Character grant source reads by: its authored record's or its item's. */
function characterGrantSourceLabel(
  registry: Pick<
    CharacterAssemblyRegistry,
    'features' | 'classes' | 'feats' | 'races' | 'backgrounds' | 'equipment'
  >,
  source: CharacterGrantFoldOutput['modifiers'][number]['source']
): string {
  const label =
    source.kind === 'AUTHORED'
      ? (registry.features[source.definitionId]?.label ??
        registry.feats[source.definitionId]?.label ??
        registry.classes[source.definitionId]?.label ??
        registry.races[source.definitionId]?.label ??
        registry.backgrounds?.[source.definitionId]?.label ??
        Object.values(registry.features)
          .flatMap((feature) => feature?.options ?? [])
          .find((option) => option.id === source.definitionId)?.label)
      : source.kind === 'EQUIPMENT_INSTANCE'
        ? registry.equipment[source.equipmentId]?.label
        : undefined
  return label ?? 'Character feature'
}

/**
 * The floor a holder's grants put on the d20 of one ability check: its active effects' and, for a
 * Character, its own unconditional feature grants' (Reliable Talent). The check is made with
 * `abilityCode`, or is ability-less when it is null; a grant naming no ability covers every check.
 * A `proficientOnly` grant holds only when the check adds the holder's full proficiency bonus or
 * more (`proficient`); half proficiency does not count. Floors reduce to the highest, the lowest
 * source id breaking a tie, so every roll site and replay reads one source; null when none holds.
 */
export function abilityCheckMinimumRoll(input: {
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
  /** A Character's grant fold and the registry that labels its sources; null for a Creature. */
  character: {
    grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'>
    registry: Parameters<typeof characterGrantSourceLabel>[0]
  } | null
  abilityCode: string | null
  proficient: boolean
}): D20MinimumRollDto | null {
  const { character, abilityCode, proficient } = input
  const candidates = [
    ...listActiveEffectGrants(input.effects).flatMap(
      ({ effectId, modifiers, sourceLabel, sourceHidden }) =>
        modifiers.map((modifier) => ({
          modifier,
          sourceId: effectId,
          label: () => (sourceHidden ? 'Unseen source' : sourceLabel)
        }))
    ),
    // The fold also carries the active effects' grants; those are read from the effects above.
    ...(character?.grantFold.modifiers ?? []).flatMap((modifier) =>
      modifier.source.kind === 'ACTIVE_EFFECT' || modifier.deferredRequirements.length > 0
        ? []
        : [
            {
              modifier,
              sourceId: modifier.sourceId,
              label: () => characterGrantSourceLabel(character!.registry, modifier.source)
            }
          ]
    )
  ]
  let floor: D20MinimumRollDto | null = null
  for (const { modifier, sourceId, label } of candidates) {
    const { valueDomainCode, modifierKind, scope, domain, payload } = modifier
    if (
      valueDomainCode !== 'ABILITY_CHECK' ||
      modifierKind !== 'MINIMUM_ROLL' ||
      scope !== 'GLOBAL' ||
      (domain.ability !== undefined && domain.ability !== abilityCode) ||
      (domain.proficientOnly === true && !proficient)
    )
      continue
    if (payload === undefined || !('amount' in payload))
      throw new Error('A minimum-roll grant must carry its amount.')
    if (
      floor === null ||
      payload.amount > floor.amount ||
      (payload.amount === floor.amount && sourceId < floor.sourceId)
    )
      floor = { amount: payload.amount, label: label(), sourceId }
  }
  return floor
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
 * The critical-hit rules a Creature holder's active grants give its attacks of one attack domain:
 * the lowest threshold and the sum of the extra damage dice. A Character folds the same grants
 * through its policy instead.
 */
export function activeAttackCriticalRules(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  attackDomain: string
): AttackCriticalRulesDto {
  const applying = listActiveEffectGrants(effects)
    .flatMap(({ modifiers }) => modifiers)
    .filter(
      (modifier) => modifier.scope === 'GLOBAL' && modifier.domain.attackDomain === attackDomain
    )
  return attackCriticalRules(applying)
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
