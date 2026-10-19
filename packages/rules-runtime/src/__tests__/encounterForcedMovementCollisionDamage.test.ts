import { describe, expect, it } from 'vitest'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_DAMAGE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  collisionDamageCapability,
  collisionDamageDiceConfig,
  collisionStruckCapability
} from '../encounterForcedMovementCollision.js'
import { SRD_SYSTEM_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'

describe('a forced movement’s collision damage to its mover (SPELLS-33.T6k2b3, D159)', () => {
  it('multiplies the authored dice by the full 10 feet travelled', () => {
    expect(collisionDamageDiceConfig('1d6', 10)).toBe('1d6')
    expect(collisionDamageDiceConfig('1d6', 29)).toBe('2d6')
    expect(collisionDamageDiceConfig('2d8', 30)).toBe('6d8')
  })

  it('deals nothing for under 10 feet', () => {
    expect(collisionDamageDiceConfig('1d6', 9)).toBeNull()
    expect(collisionDamageDiceConfig('1d6', 0)).toBeNull()
  })

  it('refuses dice that are not one term', () => {
    expect(() => collisionDamageDiceConfig('1d6+2', 20)).toThrow(
      'A forced-movement collision damages with a single dice term.'
    )
  })

  it('builds an unsaved, untested damage action of the pusher that the System can run', () => {
    const actorId = testUuid(0xc01)
    const sourceId = testUuid(0xc02)
    const damageTypeId = SRD_DAMAGE_TYPES.find(({ code }) => code === 'BLUDGEONING')!.id
    const capability = collisionDamageCapability({
      actorId,
      gameSystemId: SRD_SYSTEM_ID,
      sourceId,
      damageTypeId,
      diceConfig: '2d6'
    })

    expect(capability).toMatchObject({
      kind: 'BASIC_ACTION',
      encounterActorId: actorId,
      sourceId,
      effectId: sourceId,
      restrictions: null,
      actionCost: 'FREE',
      savingThrowAbilityDefinitionId: null
    })
  })

  it.each([
    ['damage and the condition', '2d6'],
    ['the condition alone when the mover travelled under 10 feet', null]
  ])(
    'builds the struck creature’s authored save with %s on a failure',
    (_label, damageDiceConfig) => {
      const struck = {
        damageTypeId: SRD_DAMAGE_TYPES.find(({ code }) => code === 'BLUDGEONING')!.id,
        abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
        dc: 13,
        conditionId: srdSystemRecord.conditionTypes.find(({ code }) => code === 'PRONE')!.id,
        diceConfig: '1d6',
        damageDiceConfig
      }
      const capability = collisionStruckCapability({
        actorId: testUuid(0xc01),
        gameSystemId: SRD_SYSTEM_ID,
        sourceId: testUuid(0xc03),
        struck
      })

      expect(capability).toMatchObject({
        kind: 'BASIC_ACTION',
        savingThrowAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
        conditionDefinitionIds: [struck.conditionId]
      })
      expect(capability.compiledEffect.invocation).toMatchObject({
        triggerCode: 'SAVING_THROW',
        savingThrow: { abilityDefinitionId: struck.abilityDefinitionId }
      })
    }
  )
})
