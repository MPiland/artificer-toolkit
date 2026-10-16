import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { describe, expect, it } from 'vitest'

import { nearestAbleEnemyProximity } from '../encounterEnemyProximity.js'

/** 100px cells of 5 feet; a Medium token fills one cell and is anchored at its center. */
const FEET_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}

const ATTACKER = 'attacker'
const TARGET = 'target'

/** A one-cell token whose square is (column, row). */
const placed = (actorId: string, column: number, row = 0) => ({
  actorId,
  position: { x: column * 100 + 50, y: row * 100 + 50 },
  width: 100,
  height: 100,
  rotationDegrees: 0
})

/** The attacker (a friendly) fights the target (a hostile); the others are as named. */
const ACTORS = [
  { id: ATTACKER, disposition: 'FRIENDLY' },
  { id: TARGET, disposition: 'HOSTILE' },
  { id: 'friend', disposition: 'FRIENDLY' },
  { id: 'friend2', disposition: 'FRIENDLY' },
  { id: 'brute', disposition: 'HOSTILE' },
  { id: 'bystander', disposition: 'NEUTRAL' }
] as const

function proximity(input: {
  tokens: ReturnType<typeof placed>[]
  grid?: SceneGrid
  incapacitated?: readonly string[]
}) {
  const asked: string[] = []
  return nearestAbleEnemyProximity({
    grid: input.grid ?? FEET_GRID,
    actors: ACTORS,
    attackerActorId: ATTACKER,
    targetActorId: TARGET,
    tokens: input.tokens,
    canAct: async (actorId) => {
      asked.push(actorId)
      return !input.incapacitated?.includes(actorId)
    }
  }).then((result) => ({ result, asked }))
}

describe('the nearest able enemy of an attack’s target', () => {
  const attackerAndTarget = [placed(ATTACKER, 0), placed(TARGET, 1)]

  it('measures an enemy of the target (the attacker’s own ally) from the target’s token', async () => {
    // The target stands in column 1; its enemy (a friendly) is two squares further.
    const { result } = await proximity({ tokens: [...attackerAndTarget, placed('friend', 3)] })
    expect(result).toEqual({ nearestFeet: 10 })
  })

  it('never counts the attacker or the target itself', async () => {
    const { result, asked } = await proximity({ tokens: attackerAndTarget })
    expect(result).toEqual({ nearestFeet: null })
    expect(asked).toEqual([])
  })

  it('does not count the target’s allies or a neutral creature', async () => {
    const { result } = await proximity({
      tokens: [...attackerAndTarget, placed('brute', 2), placed('bystander', 2, 1)]
    })
    expect(result).toEqual({ nearestFeet: null })
  })

  it('counts an enemy adjacent to the target as 5 feet away', async () => {
    const { result } = await proximity({ tokens: [...attackerAndTarget, placed('friend', 2)] })
    expect(result).toEqual({ nearestFeet: 5 })
  })

  it('skips an incapacitated enemy for the next nearest able one, asking nearest first', async () => {
    const { result, asked } = await proximity({
      tokens: [...attackerAndTarget, placed('friend', 2), placed('friend2', 5)],
      incapacitated: ['friend']
    })
    expect(result).toEqual({ nearestFeet: 20 })
    expect(asked).toEqual(['friend', 'friend2'])
  })

  it('has no nearby enemy when every one is incapacitated', async () => {
    const { result } = await proximity({
      tokens: [...attackerAndTarget, placed('friend', 2)],
      incapacitated: ['friend']
    })
    expect(result).toEqual({ nearestFeet: null })
  })

  it('stops asking at the first able enemy', async () => {
    const { asked } = await proximity({
      tokens: [...attackerAndTarget, placed('friend', 2), placed('friend2', 5)]
    })
    expect(asked).toEqual(['friend'])
  })

  it('converts the Scene’s unit into feet', async () => {
    const grid: SceneGrid = { ...FEET_GRID, distancePerCell: 1, unit: 'SQUARES' }
    const { result } = await proximity({
      grid,
      tokens: [...attackerAndTarget, placed('friend', 2)]
    })
    expect(result).toEqual({ nearestFeet: 5 })
  })

  it('refuses a Scene that holds no token for the target', async () => {
    await expect(proximity({ tokens: [placed(ATTACKER, 0)] })).rejects.toThrow(
      'Encounter action facts are stale.'
    )
  })
})
