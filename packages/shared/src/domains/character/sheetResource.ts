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

export type CharacterResourceRecoveryAmount =
  | { kind: 'ALL' }
  | { kind: 'FIXED'; amount: number }
  | { kind: 'DICE'; dice: CharacterDiceRollSpec }

export interface CharacterResourceRecovery {
  trigger: CharacterResourceRecoveryTrigger
  amount: CharacterResourceRecoveryAmount
}

export const CHARACTER_DEFINITION_SOURCE_KIND = {
  BACKGROUND: 'BACKGROUND',
  CLASS: 'CLASS',
  FEAT: 'FEAT',
  FEATURE: 'FEATURE',
  ITEM: 'ITEM',
  OPTION: 'OPTION',
  RACE: 'RACE',
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
