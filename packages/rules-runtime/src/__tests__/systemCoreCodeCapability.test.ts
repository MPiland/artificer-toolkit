import { describe, expect, it } from 'vitest'

import {
  eventVocabularyCapabilityRegistry,
  rollModeCapabilityRegistry
} from '../platformPolicyModules.js'
import { createSystemCoreCodeRegistry } from '../systemCoreCodeCapability.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { systemCoreCodeRegistry } from '../platformSystemCoreCodes.js'
import { dnd5eCoreCodeAdapter } from '../systems/dnd5e/coreCodes.js'

const UNKNOWN_SYSTEM_ID = '00000000-0000-4000-8000-0000000000ff'

describe('System vocabulary registry', () => {
  it('returns the code and label the installed System defines', () => {
    expect(systemCoreCodeRegistry.requireCode(DND5E_SYSTEM_ID, 'rollMode', 'ADVANTAGE')).toEqual({
      code: 'ADVANTAGE',
      label: 'Advantage',
      description: 'Roll two d20s and use the higher.'
    })
    expect(
      systemCoreCodeRegistry.entries(DND5E_SYSTEM_ID, 'rollInfluence').map(({ code }) => code)
    ).toEqual(['ADVANTAGE', 'DISADVANTAGE'])
  })

  it('refuses a code outside the list it is checked against', () => {
    expect(() =>
      systemCoreCodeRegistry.requireCode(DND5E_SYSTEM_ID, 'rollInfluence', 'NORMAL')
    ).toThrow('The Game System does not define the roll-mode influence "NORMAL".')
    expect(() => systemCoreCodeRegistry.requireCode(DND5E_SYSTEM_ID, 'rollMode', 'BOON')).toThrow(
      'The Game System does not define the roll mode "BOON".'
    )
    expect(() =>
      systemCoreCodeRegistry.requireCode(DND5E_SYSTEM_ID, 'rollMode', 'AUTO_HIT')
    ).toThrow('The Game System does not define the roll mode "AUTO_HIT".')
  })

  it('fails closed on a System with no vocabulary', () => {
    expect(() => systemCoreCodeRegistry.entries(UNKNOWN_SYSTEM_ID, 'rollMode')).toThrow(
      'The Game System does not provide vocabulary policy.'
    )
  })

  it('refuses a list with a duplicate code', () => {
    const advantage = { code: 'ADVANTAGE', label: 'Advantage' }
    expect(() =>
      createSystemCoreCodeRegistry([
        {
          ...dnd5eCoreCodeAdapter,
          lists: {
            ...dnd5eCoreCodeAdapter.lists,
            rollInfluence: [advantage, advantage]
          }
        }
      ])
    ).toThrow('Duplicate roll-mode influence code.')
  })
})

describe('roll-mode keep and passive score', () => {
  it('derives the kept face from the System roll mode and refuses a mismatched keep', () => {
    expect(
      rollModeCapabilityRegistry.rollModeKeep({ gameSystemId: DND5E_SYSTEM_ID, rollMode: 'NORMAL' })
    ).toBe('FIRST')
    expect(() =>
      rollModeCapabilityRegistry.requireKeep({
        gameSystemId: DND5E_SYSTEM_ID,
        rollMode: 'ADVANTAGE',
        keep: 'LOWER'
      })
    ).toThrow('The roll mode "ADVANTAGE" does not keep the LOWER face.')
    expect(() =>
      rollModeCapabilityRegistry.rollModeKeep({ gameSystemId: DND5E_SYSTEM_ID, rollMode: 'BOON' })
    ).toThrow('The Game System does not define the roll mode "BOON".')
  })

  it('refuses a passive score under a roll mode the System does not define', () => {
    expect(() =>
      rollModeCapabilityRegistry.passiveScore({
        gameSystemId: DND5E_SYSTEM_ID,
        skillModifier: 3,
        rollMode: 'BOON'
      })
    ).toThrow('The Game System does not define the roll mode "BOON".')
  })
})

describe('effect lifecycle and action-trait vocabulary', () => {
  const codes = (kind: Parameters<typeof systemCoreCodeRegistry.entries>[1]) =>
    systemCoreCodeRegistry.entries(DND5E_SYSTEM_ID, kind).map(({ code }) => code)
  const grantable = (kind: 'effectConsumeEvent' | 'effectEndEvent') =>
    systemCoreCodeRegistry
      .entries(DND5E_SYSTEM_ID, kind)
      .filter((entry) => entry.grantable)
      .map(({ code }) => code)

  it('supplies the consume, end and action-trait codes from the event vocabulary table', () => {
    expect(codes('effectConsumeEvent')).toEqual([
      'ON_ATTACK_ROLL',
      'ON_CAST_SPELL',
      'ON_HIT',
      'ON_ATTACKED',
      'ON_ABILITY_CHECK',
      'ON_SAVING_THROW'
    ])
    expect(codes('effectEndEvent')).toContain('ON_TAKE_ACTION')
    expect(codes('actionTrait')).toEqual(['ATTACK_ROLL', 'SPELL_CAST'])
  })

  it('marks which lifecycle events a timed grant may carry', () => {
    expect(grantable('effectConsumeEvent')).not.toContain('ON_CAST_SPELL')
    expect(grantable('effectConsumeEvent')).toContain('ON_ATTACK_ROLL')
    expect(grantable('effectEndEvent')).not.toContain('ON_ATTACK_ROLL')
    expect(grantable('effectEndEvent')).toContain('ON_MOVE')
  })

  it('refuses a code the System does not define', () => {
    expect(() =>
      systemCoreCodeRegistry.requireCode(DND5E_SYSTEM_ID, 'actionTrait', 'SNEEZE')
    ).toThrow('The Game System does not define the action trait "SNEEZE".')
    expect(() =>
      systemCoreCodeRegistry.requireCode(DND5E_SYSTEM_ID, 'effectEndEvent', 'ON_SNEEZE')
    ).toThrow('The Game System does not define the effect end event "ON_SNEEZE".')
  })

  it('subscribes an action-trait end trigger to the fact its trait names, and refuses an unknown trait', () => {
    const adapter = eventVocabularyCapabilityRegistry.require(DND5E_SYSTEM_ID)
    const recurrence = (trait: string) =>
      ({
        consumeOnFirstEvents: [],
        endOnEvents: [],
        endOnConditionIds: [],
        endOnTriggers: [{ event: 'ACTION_TRAIT', trait, against: 'ENEMY' }]
      }) as unknown as Parameters<typeof adapter.effectHooks>[0]
    expect(adapter.effectHooks(recurrence('SPELL_CAST'))).toEqual([
      {
        hook: 'END',
        subscription: { event: 'ACTION', fact: 'spellCast', againstEnemyOnly: true }
      }
    ])
    expect(() => adapter.effectHooks(recurrence('SNEEZE'))).toThrow()
  })
})
