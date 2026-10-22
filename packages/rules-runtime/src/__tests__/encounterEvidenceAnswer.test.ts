import { describe, expect, it } from 'vitest'

import { EncounterValidationError } from '../encounterErrors.js'
import { rollModeCapabilityRegistry } from '../platformPolicyModules.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import {
  resolveEncounterD20Answer,
  resolveEncounterIntegerAnswer,
  withEncounterAppRoll,
  type EncounterAppRollAnswer
} from '../encounterEvidenceAnswer.js'

const ROLL_ID = '00000000-0000-4000-8000-0000000000a1'
const OTHER_ROLL_ID = '00000000-0000-4000-8000-0000000000a2'

const keepOf = (rollMode: string) =>
  rollModeCapabilityRegistry.rollModeKeep({ gameSystemId: DND5E_SYSTEM_ID, rollMode })
const derivedOf = (rollMode: string) => ({ rollMode, keep: keepOf(rollMode) })
const noRandom = () => {
  throw new Error('An answered request must not roll.')
}

function appRoll(
  faces: number[],
  rollMode: EncounterAppRollAnswer['rollMode']
): EncounterAppRollAnswer {
  return {
    kind: 'SYSTEM_ROLL',
    requestId: 'd20',
    rollId: ROLL_ID,
    faces,
    rollMode,
    keep: rollMode === null ? null : keepOf(rollMode)
  }
}

describe('withEncounterAppRoll', () => {
  it('binds a SYSTEM_ROLL answer to the recorded faces and mode of its exact roll', () => {
    expect(
      withEncounterAppRoll(
        { kind: 'SYSTEM_ROLL', requestId: 'd20', rollId: ROLL_ID.toUpperCase() },
        { rollId: ROLL_ID, faces: [4, 17], rollMode: 'ADVANTAGE', keep: 'HIGHER' }
      )
    ).toEqual({
      kind: 'SYSTEM_ROLL',
      requestId: 'd20',
      rollId: ROLL_ID.toUpperCase(),
      faces: [4, 17],
      rollMode: 'ADVANTAGE',
      keep: 'HIGHER' as const
    })
  })

  it('rejects a SYSTEM_ROLL answer without its matching roll', () => {
    const answer = { kind: 'SYSTEM_ROLL' as const, requestId: 'd20', rollId: ROLL_ID }
    expect(() =>
      withEncounterAppRoll(answer, {
        rollId: OTHER_ROLL_ID,
        faces: [12],
        rollMode: 'NORMAL',
        keep: 'FIRST'
      })
    ).toThrow(EncounterValidationError)
    expect(() => withEncounterAppRoll(answer, null)).toThrow(EncounterValidationError)
  })

  it('passes other answers through and rejects an app roll attached to them', () => {
    const entered = {
      kind: 'ENTER_DICE' as const,
      requestId: 'd20',
      rawFaces: [9],
      rollMode: 'NORMAL' as const
    }
    expect(withEncounterAppRoll(entered, null)).toBe(entered)
    expect(() =>
      withEncounterAppRoll(entered, {
        rollId: ROLL_ID,
        faces: [9],
        rollMode: 'NORMAL',
        keep: 'FIRST'
      })
    ).toThrow(EncounterValidationError)
  })
})

describe('resolveEncounterD20Answer', () => {
  it('auto-rolls with the rules-derived mode', () => {
    const faces = [6, 15]
    const rollD20 = () => faces.shift()!
    expect(
      resolveEncounterD20Answer({
        gameSystemId: DND5E_SYSTEM_ID,
        derived: derivedOf('ADVANTAGE'),
        answer: { kind: 'AUTO_ROLL', requestId: 'd20' },
        rollD20
      })
    ).toEqual({ faces: [6, 15], rollMode: 'ADVANTAGE', keep: 'HIGHER', natural: 15 })
    expect(
      resolveEncounterD20Answer({
        gameSystemId: DND5E_SYSTEM_ID,
        derived: derivedOf('NORMAL'),
        answer: { kind: 'AUTO_ROLL', requestId: 'd20' },
        rollD20: () => 8
      })
    ).toEqual({ faces: [8], rollMode: 'NORMAL', keep: 'FIRST', natural: 8 })
  })

  it('keeps the mode the roller chose for entered dice and app rolls', () => {
    expect(
      resolveEncounterD20Answer({
        gameSystemId: DND5E_SYSTEM_ID,
        derived: derivedOf('ADVANTAGE'),
        answer: {
          kind: 'ENTER_DICE',
          requestId: 'd20',
          rawFaces: [11],
          rollMode: 'NORMAL'
        },
        rollD20: noRandom
      })
    ).toEqual({ faces: [11], rollMode: 'NORMAL', keep: 'FIRST', natural: 11 })
    expect(
      resolveEncounterD20Answer({
        gameSystemId: DND5E_SYSTEM_ID,
        derived: derivedOf('NORMAL'),
        answer: appRoll([4, 17], 'DISADVANTAGE'),
        rollD20: noRandom
      })
    ).toEqual({ faces: [4, 17], rollMode: 'DISADVANTAGE', keep: 'LOWER', natural: 4 })
  })

  it('keeps the higher face with advantage and the lower with disadvantage', () => {
    for (const [rollMode, natural] of [
      ['ADVANTAGE', 18],
      ['DISADVANTAGE', 3]
    ] as const)
      expect(
        resolveEncounterD20Answer({
          gameSystemId: DND5E_SYSTEM_ID,
          derived: derivedOf('NORMAL'),
          answer: {
            kind: 'ENTER_DICE',
            requestId: 'd20',
            rawFaces: [18, 3],
            rollMode
          },
          rollD20: noRandom
        }).natural
      ).toBe(natural)
  })

  it.each([
    [
      { rawFaces: [5], rollMode: 'GRAZING' },
      'The roll mode "GRAZING" is not offered for this request.'
    ],
    [
      { rawFaces: [5, 6], rollMode: 'NORMAL' },
      'The face count must match the faces the roll mode keeps.'
    ],
    [
      { rawFaces: [5], rollMode: 'DISADVANTAGE' },
      'The face count must match the faces the roll mode keeps.'
    ]
  ])('refuses entered dice %j with a named message', (dice, message) => {
    expect(() =>
      resolveEncounterD20Answer({
        gameSystemId: DND5E_SYSTEM_ID,
        derived: derivedOf('NORMAL'),
        answer: { kind: 'ENTER_DICE', requestId: 'd20', ...dice },
        rollD20: noRandom
      })
    ).toThrow(message)
  })

  it('rejects a face count that does not match the mode, invalid faces, and non-d20 answers', () => {
    for (const answer of [
      {
        kind: 'ENTER_DICE' as const,
        requestId: 'd20',
        rawFaces: [5, 6],
        rollMode: 'NORMAL' as const
      },
      {
        kind: 'ENTER_DICE' as const,
        requestId: 'd20',
        rawFaces: [5],
        rollMode: 'ADVANTAGE' as const
      },
      {
        kind: 'ENTER_DICE' as const,
        requestId: 'd20',
        rawFaces: [21],
        rollMode: 'NORMAL' as const
      },
      appRoll([5], 'DISADVANTAGE'),
      appRoll([5], null),
      { kind: 'ENTER_INTEGER' as const, requestId: 'd20', value: 12 }
    ])
      expect(() =>
        resolveEncounterD20Answer({
          gameSystemId: DND5E_SYSTEM_ID,
          derived: derivedOf('NORMAL'),
          answer,
          rollD20: noRandom
        })
      ).toThrow(EncounterValidationError)
  })
})

describe('resolveEncounterIntegerAnswer', () => {
  it('settles entered integers, integer app rolls and auto-rolls within the range', () => {
    expect(
      resolveEncounterIntegerAnswer({
        min: 1,
        max: 8,
        answer: { kind: 'ENTER_INTEGER', requestId: 'damage', value: 6 },
        random: noRandom
      })
    ).toBe(6)
    expect(
      resolveEncounterIntegerAnswer({
        min: 1,
        max: 8,
        answer: appRoll([7], null),
        random: noRandom
      })
    ).toBe(7)
    const maxExclusive: number[] = []
    expect(
      resolveEncounterIntegerAnswer({
        min: 2,
        max: 12,
        answer: { kind: 'AUTO_ROLL', requestId: 'damage' },
        random: (bound) => {
          maxExclusive.push(bound)
          return bound - 1
        }
      })
    ).toBe(12)
    expect(maxExclusive).toEqual([11])
  })

  it('rejects out-of-range values, d20 app rolls and dice answers', () => {
    for (const answer of [
      { kind: 'ENTER_INTEGER' as const, requestId: 'damage', value: 9 },
      appRoll([9], null),
      appRoll([4], 'NORMAL'),
      {
        kind: 'ENTER_DICE' as const,
        requestId: 'damage',
        rawFaces: [4],
        rollMode: 'NORMAL' as const
      }
    ])
      expect(() =>
        resolveEncounterIntegerAnswer({ min: 1, max: 8, answer, random: noRandom })
      ).toThrow(EncounterValidationError)
  })
})
