import { InterleavedBuffer, InterleavedBufferAttribute } from 'three'
import type { RollRecordDto, RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import { formatRollEvidence } from './dice.utils'
import {
  getScaledColliderVertices,
  getTargetQuaternion,
  getVisualDice,
  getVisualDiceStages,
  isDieNearlyStill
} from './dice3d.utils'

describe('dice presentation utilities', () => {
  it('builds scaled collider vertices from interleaved model positions', () => {
    const data = new InterleavedBuffer(new Float32Array([1, 2, 3, 9, -1, -2, -3, 9]), 4)
    const position = new InterleavedBufferAttribute(data, 3, 0)

    expect(Array.from(getScaledColliderVertices(position, 2))).toEqual([2, 4, 6, -2, -4, -6])
  })

  it('detects when a simulated die has reached low motion', () => {
    expect(isDieNearlyStill({ x: 0.2, y: 0.1, z: 0.1 }, { x: 0.3, y: 0.2, z: 0.1 })).toBe(true)
    expect(isDieNearlyStill({ x: 0.7, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(false)
    expect(isDieNearlyStill({ x: 0, y: 0, z: 0 }, { x: 1.1, y: 0, z: 0 })).toBe(false)
  })

  it('renders a d100 result as percentile and ones dice with valid target faces', () => {
    const roll = {
      id: 'roll-100',
      characterId: 'character-1',
      characterLabel: 'Aria',
      source: { kind: 'MANUAL', label: 'Manual roll' },
      ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
      normalizedExpression: '1d100',
      evidence: {
        terms: [{ count: 1, die: 100, rolls: [47], subtotal: 47 }],
        modifier: 0,
        mode: 'NORMAL',
        subtotal: 47,
        transform: { kind: 'NONE' },
        total: 47
      },
      createdAt: '2026-07-30T18:00:00.000Z'
    } satisfies RollRecordDto

    expect(getVisualDice(roll)).toEqual([
      { die: 100, faceValue: 40, id: 'roll-100:0:0:percentile', kept: true },
      { die: 10, faceValue: 7, id: 'roll-100:0:0:ones', kept: true }
    ])
    expect(() => getTargetQuaternion(100, 40)).not.toThrow()
    expect(() => getTargetQuaternion(10, 7)).not.toThrow()
  })

  it('identifies kept and dropped d20 results', () => {
    expect(
      formatRollEvidence({
        terms: [{ count: 2, die: 20, rolls: [7, 16], subtotal: 16, keptRollIndex: 1 }],
        modifier: 3,
        mode: 'ADVANTAGE',
        subtotal: 19,
        transform: { kind: 'NONE' },
        total: 19
      })
    ).toContain('7 dropped, 16 kept')
  })

  it('stages rerolled dice before revealing the dropped result', () => {
    const roll = {
      id: 'ability-roll',
      normalizedExpression: '4d6dl1r1',
      evidence: {
        terms: [
          {
            count: 4,
            die: 6,
            rolls: [4, 5, 2, 6],
            rollSequences: [[1, 4], [5], [2], [6]],
            subtotal: 15,
            keptRollIndexes: [0, 1, 3]
          }
        ],
        modifier: 0,
        mode: 'NORMAL',
        subtotal: 15,
        transform: { kind: 'NONE' },
        total: 15
      }
    } satisfies RollResultDto

    const stages = getVisualDiceStages(roll)
    expect(stages).toHaveLength(3)
    expect(stages[0].map((die) => [die.faceValue, die.kept])).toEqual([
      [1, true],
      [5, true],
      [2, true],
      [6, true]
    ])
    expect(stages[1].map((die) => [die.faceValue, die.kept])).toEqual([
      [4, true],
      [5, true],
      [2, true],
      [6, true]
    ])
    expect(stages[2].map((die) => [die.faceValue, die.kept])).toEqual([
      [4, true],
      [5, true],
      [2, false],
      [6, true]
    ])
  })

  it('formats modifiers with their dice groups', () => {
    expect(
      formatRollEvidence({
        terms: [
          { count: 2, die: 6, modifier: 3, rolls: [4, 5], subtotal: 9 },
          { count: 1, die: 4, modifier: 1, rolls: [2], subtotal: 2 }
        ],
        modifier: 4,
        mode: 'NORMAL',
        subtotal: 15,
        transform: { kind: 'NONE' },
        total: 15
      })
    ).toBe('d6 [4, 5] + 3 + d4 [2] + 1')
  })

  it('has a normalized target orientation for every supported model face', () => {
    const faces = [
      [4, [1, 2, 3, 4]],
      [6, [1, 2, 3, 4, 5, 6]],
      [8, [1, 2, 3, 4, 5, 6, 7, 8]],
      [10, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
      [12, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
      [20, Array.from({ length: 20 }, (_, index) => index + 1)],
      [100, [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]]
    ] as const

    for (const [die, values] of faces) {
      for (const value of values) expect(getTargetQuaternion(die, value).length()).toBeCloseTo(1)
    }
  })
})
