import { describe, expect, it } from 'vitest'

import { damageSaveRolledD20, damageSaveWindowRoll } from '../encounterConcentration.js'
import {
  chosenEncounterD20WindowOption,
  encounterD20WindowOptions,
  encounterD20WindowSelectedIndex,
  encounterD20WindowSelection
} from '../encounterD20Window.js'

const CHECKSUM = 'a'.repeat(64)
const held = (n: number) => ({
  effectId: `00000000-0000-4000-8000-00000000e00${n}`,
  grantId: `00000000-0000-4000-8000-00000000f00${n}`,
  label: `Held ${n}`,
  count: n,
  faces: 4 as const,
  sign: 'ADD' as const
})
const offer = {
  executionChecksum: CHECKSUM,
  options: encounterD20WindowOptions(CHECKSUM, [held(1), held(2)])
}

describe('the d20 window selection', () => {
  it('keeps the roll at index 0 and numbers the offered dice from 1', () => {
    expect(encounterD20WindowSelectedIndex({ offer }, { kind: 'DECLINE' })).toBe(0)
    const second = offer.options[1]!
    expect(
      encounterD20WindowSelectedIndex({ offer }, { kind: 'USE', optionId: second.optionId })
    ).toBe(2)
  })

  it('refuses an option the roll never offered', () => {
    expect(() =>
      chosenEncounterD20WindowOption({ offer }, { kind: 'USE', optionId: 'forged' })
    ).toThrow('was not offered')
  })

  it('ties option ids to the roll they were offered for', () => {
    const other = encounterD20WindowOptions('b'.repeat(64), [held(1)])
    expect(other[0]!.optionId).not.toBe(offer.options[0]!.optionId)
  })

  it('takes only a use or a decline as the window answer', () => {
    expect(() =>
      encounterD20WindowSelection({ kind: 'SYSTEM_ROLL' } as Parameters<
        typeof encounterD20WindowSelection
      >[0])
    ).toThrow('use or a decline')
  })
})

describe('the roll a damage save freezes at its d20 window', () => {
  const roll = {
    rawFaces: [4, 17],
    rollMode: 'ADVANTAGE' as const,
    keep: 'HIGHEST' as const,
    natural: 17,
    addedDice: []
  }
  const save = {
    rollMode: 'ADVANTAGE' as const,
    modifier: 2,
    contributors: [],
    contributorChecksum: CHECKSUM
  }

  it('totals the d20 the roller rolled and resumes to the same roll', () => {
    const frozen = damageSaveRolledD20({ requestId: 'request', save, roll })
    expect(frozen).toMatchObject({ selectedNatural: 17, total: 19, rawFaces: [4, 17] })
    expect(damageSaveWindowRoll(frozen)).toEqual(roll)
  })
})
