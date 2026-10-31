import { describe, expect, it } from 'vitest'

import { chooseReplacedMaintainedState } from '../encounterActionMaintenance.js'
import { MaintainedReplacementRequiredError } from '../encounterErrors.js'

const held = (...ids: string[]) => ids.map((id) => ({ id }))

describe('chooseReplacedMaintainedState', () => {
  it('adds a new state while the holder has room', () => {
    expect(
      chooseReplacedMaintainedState({ definitionId: 'def', held: held('a'), capacity: 2 })
    ).toBeNull()
    expect(chooseReplacedMaintainedState({ definitionId: 'def', held: [], capacity: 1 })).toBeNull()
  })

  it('replaces the only state at capacity one without asking', () => {
    expect(
      chooseReplacedMaintainedState({ definitionId: 'def', held: held('a'), capacity: 1 })?.id
    ).toBe('a')
  })

  it('asks the caster which state ends when several are held at capacity', () => {
    expect(() =>
      chooseReplacedMaintainedState({ definitionId: 'def', held: held('a', 'b'), capacity: 2 })
    ).toThrow(MaintainedReplacementRequiredError)
  })

  it('replaces the state the caster chose', () => {
    expect(
      chooseReplacedMaintainedState({
        definitionId: 'def',
        held: held('a', 'b'),
        capacity: 2,
        chosenStateId: 'b'
      })?.id
    ).toBe('b')
  })

  it('rejects a choice that is not a held state', () => {
    expect(() =>
      chooseReplacedMaintainedState({
        definitionId: 'def',
        held: held('a', 'b'),
        capacity: 2,
        chosenStateId: 'z'
      })
    ).toThrow('not one of the maintained effects')
  })

  it('names the held states in the prompt error', () => {
    try {
      chooseReplacedMaintainedState({ definitionId: 'def', held: held('a', 'b'), capacity: 2 })
      expect.unreachable()
    } catch (error) {
      expect((error as MaintainedReplacementRequiredError).heldStateIds).toEqual(['a', 'b'])
    }
  })
})
