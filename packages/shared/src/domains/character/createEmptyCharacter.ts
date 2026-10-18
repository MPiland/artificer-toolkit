import {
  ADVANCEMENT_METHOD_CODE,
  AUTHORED_RECORD_STATUS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '#core'
import type { CharacterAuthored } from '#authored'

export function createEmptyCharacterAuthored(params: {
  id: string
  primaryRulesCatalogueId?: string
  systemId: string
  userId: string
}): CharacterAuthored {
  return {
    id: params.id,
    label: '',
    description: undefined,
    status: AUTHORED_RECORD_STATUS.DRAFT,
    profile: {},
    intent: {
      advancement: { method: ADVANCEMENT_METHOD_CODE.MILESTONE },
      race: { raceId: '' },
      background: { backgroundId: '' },
      classes: [],
      abilities: {
        method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
        assignments: []
      },
      hitpoints: {
        method: HITPOINT_CALCULATION_METHOD_CODE.FIXED,
        levels: []
      },
      featureAcquisitions: []
    },
    state: {
      equipment: {
        inventory: [],
        equipped: [],
        attuned: []
      },
      currency: [],
      hitpoints: {
        current: 1,
        temp: 0,
        hitDice: [],
        deathSaves: { successes: 0, failures: 0, stable: false }
      }
    },
    systemId: params.systemId,
    ...(params.primaryRulesCatalogueId
      ? { primaryRulesCatalogueId: params.primaryRulesCatalogueId }
      : {}),
    userId: params.userId
  }
}
