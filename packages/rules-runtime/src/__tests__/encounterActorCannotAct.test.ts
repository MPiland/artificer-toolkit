import { describe, expect, it } from 'vitest'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { encounterActorCannotAct } from '../encounterBasicActions.js'
import { currentConditionDefinition } from './srdConditionDefinitions.js'

const definitions = {
  requireCurrent: async (id: string) => {
    const seed = SRD_RULE_STATE_DEFINITIONS.find((entry) => entry.id === id)
    if (!seed) throw new Error(`Unexpected definition ${id}.`)
    return currentConditionDefinition(seed)
  }
}

const conditionId = (code: string) => {
  const condition = SRD_CONDITION_TYPES.find((entry) => entry.code === code)
  if (!condition) throw new Error(`Unknown condition ${code}.`)
  return condition.id
}

const cannotAct = (codes: readonly string[]) =>
  encounterActorCannotAct({
    conditionIds: codes.map(conditionId),
    activeEffects: [],
    gameSystemId: SRD_SYSTEM_ID,
    definitions
  })

describe('encounterActorCannotAct (D95)', () => {
  it.each(['INCAPACITATED', 'PARALYZED', 'PETRIFIED', 'STUNNED', 'UNCONSCIOUS'])(
    'is true while %s suppresses the actor-action capability',
    async (code) => {
      expect(await cannotAct([code])).toBe(true)
    }
  )

  it.each([[[]], [['GRAPPLED']], [['RESTRAINED']], [['POISONED']], [['GRAPPLED', 'RESTRAINED']]])(
    'is false for %j, which leave the actor able to act even at speed 0',
    async (codes) => {
      expect(await cannotAct(codes)).toBe(false)
    }
  )

  it('is true when any one of several conditions suppresses the capability', async () => {
    expect(await cannotAct(['GRAPPLED', 'STUNNED'])).toBe(true)
  })
})
