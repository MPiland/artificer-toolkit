import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldSense
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

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
}

export function listActiveEffectGrants(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): ActiveEffectGrant[] {
  return effects.flatMap(({ id, definition }) =>
    definition.schemaVersion === 2
      ? definition.stateContributions.flatMap((contribution) =>
          contribution.kind === 'MODIFIER_GRANT'
            ? [{ effectId: id, modifiers: contribution.modifiers, senses: contribution.senses }]
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

/** The global active bonuses and penalties to one value domain whose domain `applies` accepts. */
function* activeBonusGrants(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  valueDomainCode: string,
  applies: (domain: Record<string, unknown> | null) => boolean
) {
  for (const { modifiers } of listActiveEffectGrants(effects)) {
    for (const modifier of modifiers) {
      const grant = record(modifier.grant)
      if (
        modifier.valueDomainCode === valueDomainCode &&
        (modifier.modifierKind === 'BONUS' || modifier.modifierKind === 'PENALTY') &&
        grant?.scope === 'GLOBAL' &&
        applies(record(modifier.domain))
      )
        yield { sign: modifier.modifierKind === 'PENALTY' ? -1 : 1, payload: record(grant.payload) }
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
  applies: (domain: Record<string, unknown> | null) => boolean = () => true
): number {
  let total = 0
  for (const { sign, payload } of activeBonusGrants(effects, valueDomainCode, applies)) {
    if (payload?.valueKind !== 'FIXED' || typeof payload.amount !== 'number')
      throw new Error(`An active ${valueDomainCode} grant must be a fixed amount.`)
    // A penalty is authored as a positive amount and subtracted once, here.
    total += sign * payload.amount
  }
  return total
}

/**
 * The net feet of a holder's active speed bonuses and penalties, for the grants whose domain
 * `applies` accepts. Each payload is a typed length, converted through the shared unit conversion;
 * one that is not is an invariant failure.
 */
export function activeSpeedGrantFeet(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  applies: (domain: Record<string, unknown> | null) => boolean
): number {
  let feet = 0
  for (const { sign, payload } of activeBonusGrants(effects, 'SPEED', applies))
    feet += sign * modifierLengthFeet(payload)
  return feet
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
