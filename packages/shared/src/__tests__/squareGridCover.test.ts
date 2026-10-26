import { describe, expect, it } from 'vitest'

import { resolveSquareGridCover } from '../domains/vtt/optionalCombatGeometry.js'
import type { CampaignSceneState, SceneBarrier, SceneGrid } from '../domains/vtt/scene.js'

/** SPELLS-14.T1: cover tiers from a Scene's walls and creatures, by the square-grid corner method. */

const grid: SceneGrid = {
  cellSize: 10,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  kind: 'SQUARE',
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}

const rules = {
  tiers: [
    { code: 'HALF', minBlockedLines: 1 },
    { code: 'THREE_QUARTERS', minBlockedLines: 3 },
    { code: 'TOTAL', minBlockedLines: 4 }
  ],
  creatureMaxTierCode: 'HALF'
}

const space = (id: string, x: number, y: number, size = 10) => ({
  height: size,
  id,
  position: { x, y },
  width: size
})

// The attacker stands in cell 0:0 and the target four cells east, in cell 4:0.
const attacker = space('attacker', 5, 5)
const target = space('target', 45, 5)

function wall(id: string, x: number, fromY: number, toY: number): SceneBarrier {
  return {
    a: { x, y: fromY },
    b: { x, y: toY },
    blocksLight: true,
    blocksMovement: true,
    id,
    kind: 'WALL'
  }
}

function cover(input: {
  barriers?: SceneBarrier[]
  creatures?: ReturnType<typeof space>[]
  doorStates?: CampaignSceneState['doorStates']
  origin?: Parameters<typeof resolveSquareGridCover>[0]['origin']
  rules?: Parameters<typeof resolveSquareGridCover>[0]['rules']
  sceneGrid?: SceneGrid
  target?: ReturnType<typeof space>
}) {
  return resolveSquareGridCover({
    creatures: input.creatures ?? [],
    origin: input.origin ?? { kind: 'TOKEN', token: attacker },
    rules: input.rules ?? rules,
    state: {
      barriers: input.barriers ?? [],
      doorStates: input.doorStates ?? {},
      grid: input.sceneGrid ?? grid
    },
    target: input.target ?? target
  })
}

describe('square-grid cover (SPELLS-14.T1)', () => {
  it('gives no cover across open ground', () => {
    expect(cover({})).toMatchObject({ tier: null, blockedLines: 0, creatureTokenIds: [] })
  })

  it('gives half cover when a low wall blocks two lines from the best corner', () => {
    expect(cover({ barriers: [wall('low', 30, 4, 20)] })).toMatchObject({
      tier: { code: 'HALF' },
      blockedLines: 2,
      wallBlockedLines: 2
    })
  })

  it('gives three-quarters cover when only a narrow gap lets one line through', () => {
    const slit = [wall('upper', 30, -20, 4.5), wall('lower', 30, 5.5, 30)]
    expect(cover({ barriers: slit })).toMatchObject({
      tier: { code: 'THREE_QUARTERS' },
      blockedLines: 3
    })
  })

  it('gives total cover behind a solid wall', () => {
    expect(cover({ barriers: [wall('solid', 30, -20, 30)] })).toMatchObject({
      tier: { code: 'TOTAL' },
      blockedLines: 4,
      wallBlockedLines: 4
    })
  })

  it('blocks an attacker shooting through the wall along its own edge, but not a target backed against a wall', () => {
    expect(cover({ barriers: [wall('near', 10, -20, 30)] })?.tier?.code).toBe('TOTAL')
    expect(cover({ barriers: [wall('behind', 50, -20, 30)] })?.tier).toBeNull()
  })

  it('caps a creature in the way at the System creature tier and names it', () => {
    const result = cover({ creatures: [space('blocker', 25, 5), attacker, target] })
    expect(result).toMatchObject({
      tier: { code: 'HALF' },
      blockedLines: 4,
      wallBlockedLines: 0,
      creatureTokenIds: ['blocker']
    })
  })

  it('gives no creature cover under a System whose creatures give none', () => {
    const result = cover({
      creatures: [space('blocker', 25, 5)],
      rules: { ...rules, creatureMaxTierCode: null }
    })
    expect(result).toMatchObject({ tier: null, blockedLines: 4, creatureTokenIds: ['blocker'] })
  })

  it('lets walls reach past the creature cap, and a creature beside the line give nothing', () => {
    expect(
      cover({ barriers: [wall('solid', 30, -20, 30)], creatures: [space('blocker', 25, 5)] })?.tier
        ?.code
    ).toBe('TOTAL')
    expect(cover({ creatures: [space('beside', 25, 15)] })).toMatchObject({
      tier: null,
      creatureTokenIds: []
    })
  })

  it('takes the thresholds from the System data, so a homebrew table moves the tiers', () => {
    const strict = { tiers: [{ code: 'HEAVY', minBlockedLines: 2 }], creatureMaxTierCode: null }
    expect(cover({ barriers: [wall('low', 30, 4, 20)], rules: strict })?.tier?.code).toBe('HEAVY')
    expect(cover({ barriers: [wall('low', 30, 6, 20)], rules: strict })).toMatchObject({
      tier: null,
      blockedLines: 1
    })
  })

  it('follows door state: a closed door gives total cover, an open one none', () => {
    const door: SceneBarrier = {
      a: { x: 30, y: -20 },
      b: { x: 30, y: 30 },
      blocksLightWhenClosed: true,
      blocksMovementWhenClosed: true,
      id: 'door',
      initialState: 'CLOSED',
      kind: 'DOOR',
      openAngleDegrees: 90
    }
    expect(cover({ barriers: [door] })?.tier?.code).toBe('TOTAL')
    expect(cover({ barriers: [door], doorStates: { door: 'OPEN' } })?.tier).toBeNull()
  })

  it("picks a large target's least-covered square", () => {
    const large = space('large', 50, 10, 20)
    expect(cover({ barriers: [wall('upper', 30, -20, 9)], target: large })).toMatchObject({
      tier: null,
      targetCellId: '4:1'
    })
  })

  it("measures an area save from the area's point of origin", () => {
    const origin = { kind: 'POINT' as const, point: { x: 5, y: 5 } }
    expect(cover({ origin })).toMatchObject({ tier: null, originCorner: { x: 5, y: 5 } })
    expect(cover({ barriers: [wall('solid', 30, -20, 30)], origin })?.tier?.code).toBe('TOTAL')
  })

  it('fails closed off a square grid, for unaligned spaces, and for disordered tiers', () => {
    expect(cover({ sceneGrid: { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' } })).toBeNull()
    expect(cover({ target: space('target', 47, 5) })).toBeNull()
    expect(cover({ creatures: [space('blocker', 23, 5)] })).toBeNull()
    expect(
      cover({ rules: { tiers: [...rules.tiers].reverse(), creatureMaxTierCode: 'HALF' } })
    ).toBeNull()
    expect(cover({ rules: { ...rules, creatureMaxTierCode: 'MISSING' } })).toBeNull()
  })
})
