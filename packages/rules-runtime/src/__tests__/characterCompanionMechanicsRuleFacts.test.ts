import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import { describe, expect, it } from 'vitest'
import { buildCharacterCompanionMechanicsRuleFacts } from '../character/characterCompanionMechanicsRuleFacts.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const COMPANION_ID = '00000000-0000-4000-8000-0000000d0001'

function snapshot(
  companion: Partial<NonNullable<CharacterBuildSnapshot['companions']>[number]>,
  adjustments: CharacterBuildSnapshot['adjustments'] = []
): CharacterBuildSnapshot {
  return {
    characterId: '00000000-0000-4000-8000-0000000d0002',
    systemId: DND5E_SYSTEM_ID,
    totalLevel: 1,
    classes: [],
    abilities: {},
    hitpoints: [],
    features: [],
    equipmentItems: [],
    adjustments,
    companions: [
      {
        companionInstanceId: COMPANION_ID,
        creatureId: '00000000-0000-4000-8000-0000000d0003',
        abilityScores: {},
        armorClass: 12,
        maxHitPoints: 9,
        ...companion
      }
    ]
  }
}

describe('companion rule-policy facts', () => {
  it('carries a size the System lists', () => {
    expect(
      buildCharacterCompanionMechanicsRuleFacts(snapshot({ size: 'SMALL' })).companionMechanicsFacts
        .companions[0]?.size
    ).toBe('SMALL')
  })

  it('refuses a companion size the System does not list', () => {
    expect(() => buildCharacterCompanionMechanicsRuleFacts(snapshot({ size: 'ENORMOUS' }))).toThrow(
      'The Game System does not define the size "ENORMOUS".'
    )
  })

  it('refuses a size override the System does not list', () => {
    expect(() =>
      buildCharacterCompanionMechanicsRuleFacts(
        snapshot({ size: 'SMALL' }, [
          {
            id: 'size-override',
            family: 'COMPANION',
            companionInstanceId: COMPANION_ID,
            field: 'SIZE_OVERRIDE',
            value: 'ENORMOUS'
          }
        ])
      )
    ).toThrow('The Game System does not define the size "ENORMOUS".')
  })
})
