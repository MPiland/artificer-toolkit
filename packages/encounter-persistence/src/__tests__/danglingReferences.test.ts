import { describe, expect, it } from 'vitest'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { characterProjectionState } from '../characterStates.js'

const POISONED_ID = '00000000-0000-4000-8000-0000000000d1'
const hitpoints = { current: 10, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES }

describe('a Character projection names its conditions by type ID', () => {
  it('projects a Sheet condition as its type ID and notes, never a System label', () => {
    expect(
      characterProjectionState(
        { hitpoints, conditions: [{ conditionTypeId: POISONED_ID, notes: 'Bitten' }] },
        10
      ).conditions
    ).toEqual([{ conditionTypeId: POISONED_ID, notes: 'Bitten' }])
  })
})
