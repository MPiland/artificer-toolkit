import type { CharacterMechanicSourceRef } from './sheetCalculation.js'
import type { DiceExpression } from '../core/dice.js'

export const CHARACTER_RESOURCE_RECOVERY_TRIGGER = {
  DAILY: 'DAILY',
  DAWN: 'DAWN',
  DUSK: 'DUSK',
  LONG_REST: 'LONG_REST',
  MANUAL: 'MANUAL',
  SHORT_REST: 'SHORT_REST'
} as const

export type CharacterResourceRecoveryTrigger =
  (typeof CHARACTER_RESOURCE_RECOVERY_TRIGGER)[keyof typeof CHARACTER_RESOURCE_RECOVERY_TRIGGER]

export type CharacterDiceRollSpec = DiceExpression

export interface CharacterDiceRollResult {
  spec: CharacterDiceRollSpec
  rolls: number[]
  total: number
}

export interface CharacterDiceRandomSource {
  /**
   * Returns a uniformly distributed integer in [0, maxExclusive).
   *
   * Production callers must supply a cryptographically secure implementation.
   * Tests may inject a deterministic source.
   */
  nextInt(maxExclusive: number): number
}

export function rollCharacterDice(
  spec: CharacterDiceRollSpec,
  random: CharacterDiceRandomSource
): CharacterDiceRollResult {
  if (!Number.isInteger(spec.count) || spec.count < 0) {
    throw new RangeError('Dice count must be a non-negative integer.')
  }
  if (!Number.isInteger(spec.die) || spec.die < 1) {
    throw new RangeError('Die size must be a positive integer.')
  }
  if (!Number.isInteger(spec.modifier)) {
    throw new RangeError('Dice modifier must be an integer.')
  }

  const rolls = Array.from({ length: spec.count }, () => {
    const value = random.nextInt(spec.die)
    if (!Number.isInteger(value) || value < 0 || value >= spec.die) {
      throw new RangeError('Dice random source returned an out-of-range value.')
    }
    return value + 1
  })

  return {
    spec: { ...spec },
    rolls,
    total: rolls.reduce((sum, value) => sum + value, spec.modifier)
  }
}

export type CharacterResourceRecoveryAmount =
  | { kind: 'ALL' }
  | { kind: 'FIXED'; amount: number }
  | { kind: 'DICE'; dice: CharacterDiceRollSpec }

export interface CharacterResourceRecovery {
  trigger: CharacterResourceRecoveryTrigger
  amount: CharacterResourceRecoveryAmount
}

export const CHARACTER_DEFINITION_SOURCE_KIND = {
  ANCESTRY: 'ANCESTRY',
  BACKGROUND: 'BACKGROUND',
  CLASS: 'CLASS',
  FEAT: 'FEAT',
  FEATURE: 'FEATURE',
  ITEM: 'ITEM',
  OPTION: 'OPTION',
  RACE: 'RACE',
  SUBRACE: 'SUBRACE',
  SUBCLASS: 'SUBCLASS'
} as const

export type CharacterDefinitionSourceKind =
  (typeof CHARACTER_DEFINITION_SOURCE_KIND)[keyof typeof CHARACTER_DEFINITION_SOURCE_KIND]

/**
 * Produces the stable identity used when one definition is acquired from
 * multiple character-owned records. The record ID is persisted Builder intent,
 * not the definition ID itself.
 */
export function createCharacterDefinitionSourceInstanceId(
  sourceKind: CharacterDefinitionSourceKind,
  sourceRecordId: string
): string {
  return `${sourceKind}:${sourceRecordId}`
}

export interface CharacterSpellSourceRef {
  spellId: string
  sourceKind: CharacterDefinitionSourceKind
  sourceInstanceId: string
}

export function createCharacterSpellSourceKey(source: CharacterSpellSourceRef): string {
  return [source.sourceKind, source.sourceInstanceId, source.spellId]
    .map(encodeURIComponent)
    .join(':')
}

export type CharacterResourceOwnerRef =
  | {
      kind: 'AUTHORED_GRANT'
      resourceGrantId: string
      source: CharacterMechanicSourceRef
    }
  | {
      kind: 'SPELL_SOURCE'
      resourceGrantId: string
      source: CharacterSpellSourceRef
    }
  | {
      kind: 'ITEM_INSTANCE'
      chargeId: string
      itemInstanceId: string
    }
  | {
      kind: 'SENSE_GRANT'
      senseGrantId: string
      source: CharacterMechanicSourceRef
    }
  | {
      kind: 'COMPANION_FEATURE'
      chargeId: string
      companionInstanceId: string
      featureId: string
    }

export const CHARACTER_REST_KIND = {
  LONG: 'LONG',
  SHORT: 'SHORT'
} as const

export type CharacterRestKind = (typeof CHARACTER_REST_KIND)[keyof typeof CHARACTER_REST_KIND]
