import { describe, expect, it } from 'vitest'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { characterProjectionState } from '../characterStates.js'

const POISONED = { id: '00000000-0000-4000-8000-0000000000d1', code: 'POISONED', label: 'Poisoned' }
const hitpoints = { current: 10, hitDice: [], deathSaves: NO_DEATH_SAVES }

describe('a dangling Encounter reference fails loudly', () => {
  it('labels a Character condition from the System', () => {
    expect(
      characterProjectionState(
        { hitpoints, conditions: [{ conditionTypeId: POISONED.id, notes: 'Bitten' }] },
        10,
        [POISONED]
      ).conditions
    ).toEqual([{ conditionTypeId: POISONED.id, label: 'Poisoned', notes: 'Bitten' }])
  })

  it('refuses a Character condition whose type the System does not define', () => {
    const missingId = '00000000-0000-4000-8000-0000000000d2'
    expect(() =>
      characterProjectionState({ hitpoints, conditions: [{ conditionTypeId: missingId }] }, 10, [
        POISONED
      ])
    ).toThrow(missingId)
  })
})
