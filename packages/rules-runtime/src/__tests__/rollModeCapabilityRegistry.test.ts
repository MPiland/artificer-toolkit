import { describe, expect, it } from 'vitest'

import { rollModeCapabilityRegistry } from '../platformPolicyModules.js'
import { createRollModeCapabilityRegistry } from '../rollModeCapabilityRegistry.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { systemVocabularyRegistry } from '../platformSystemVocabulary.js'
import {
  dnd5eRollModeCapabilityAdapter,
  resolveDnd5eRollMode
} from '../systems/dnd5e/rollModePolicy.js'

const UNKNOWN_SYSTEM_ID = '00000000-0000-4000-8000-0000000000ff'

describe('D&D roll-mode policy', () => {
  it('aggregates qualified d20 contributors without mutating their ordered evidence', () => {
    const contributors = [
      { id: 'first', influence: 'ADVANTAGE' as const },
      { id: 'second', influence: 'ADVANTAGE' as const }
    ]

    expect(resolveDnd5eRollMode([]).rollMode).toBe('NORMAL')
    expect(resolveDnd5eRollMode(contributors).rollMode).toBe('ADVANTAGE')
    expect(
      resolveDnd5eRollMode([
        { id: 'first', influence: 'DISADVANTAGE' as const },
        { id: 'second', influence: 'DISADVANTAGE' as const }
      ]).rollMode
    ).toBe('DISADVANTAGE')
    expect(
      resolveDnd5eRollMode([...contributors, { id: 'third', influence: 'DISADVANTAGE' as const }])
    ).toEqual({ rollMode: 'NORMAL', keep: 'FIRST' })
    expect(contributors).toEqual([
      { id: 'first', influence: 'ADVANTAGE' },
      { id: 'second', influence: 'ADVANTAGE' }
    ])
  })

  it('refuses NORMAL as a contributor influence, which the System does not define', () => {
    expect(() =>
      rollModeCapabilityRegistry.resolveRollMode({
        gameSystemId: DND5E_SYSTEM_ID,
        contributors: [{ influence: 'NORMAL' }]
      })
    ).toThrow('The Game System does not define the roll-mode influence "NORMAL".')
  })

  it('keeps the higher face on advantage and the lower on disadvantage', () => {
    expect(resolveDnd5eRollMode([{ influence: 'ADVANTAGE' }]).keep).toBe('HIGHER')
    expect(resolveDnd5eRollMode([{ influence: 'DISADVANTAGE' }]).keep).toBe('LOWER')
  })

  it('refuses an influence code D&D does not define', () => {
    expect(() => resolveDnd5eRollMode([{ influence: 'BOON' }])).toThrow(
      'D&D does not define the roll-mode influence "BOON".'
    )
  })
})

describe('roll-mode capability registry', () => {
  it('resolves through the installed System by gameSystemId', () => {
    expect(
      rollModeCapabilityRegistry.resolveRollMode({
        gameSystemId: DND5E_SYSTEM_ID,
        contributors: [{ influence: 'DISADVANTAGE' }]
      })
    ).toEqual({ rollMode: 'DISADVANTAGE', keep: 'LOWER' })
  })

  it('offers each roll mode the System defines with its label and the face it keeps', () => {
    const offered = rollModeCapabilityRegistry.offeredRollModes(DND5E_SYSTEM_ID)
    expect(offered.map(({ code, keep }) => [code, keep])).toEqual([
      ['NORMAL', 'FIRST'],
      ['ADVANTAGE', 'HIGHER'],
      ['DISADVANTAGE', 'LOWER']
    ])
    expect(offered.every(({ label }) => label.length > 0)).toBe(true)
  })

  it('fails closed on a System with no roll-mode policy', () => {
    expect(() =>
      rollModeCapabilityRegistry.resolveRollMode({
        gameSystemId: UNKNOWN_SYSTEM_ID,
        contributors: []
      })
    ).toThrow('The Game System does not provide roll-mode policy.')
  })

  it('refuses an influence the System does not define', () => {
    expect(() =>
      rollModeCapabilityRegistry.resolveRollMode({
        gameSystemId: DND5E_SYSTEM_ID,
        contributors: [{ influence: 'ADVANTAGE' }, { influence: 'BOON' }]
      })
    ).toThrow('The Game System does not define the roll-mode influence "BOON".')
  })

  it('refuses a duplicate System adapter', () => {
    expect(() =>
      createRollModeCapabilityRegistry(
        [dnd5eRollModeCapabilityAdapter, dnd5eRollModeCapabilityAdapter],
        systemVocabularyRegistry
      )
    ).toThrow(`Duplicate roll-mode System adapter: ${DND5E_SYSTEM_ID}.`)
  })

  it('refuses a System identity that is not a UUID', () => {
    expect(() =>
      createRollModeCapabilityRegistry(
        [{ ...dnd5eRollModeCapabilityAdapter, gameSystemId: 'dnd5e' }],
        systemVocabularyRegistry
      )
    ).toThrow('Roll-mode System identity must be a PostgreSQL UUID.')
  })
})
