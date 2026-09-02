import { describe, expect, it } from 'vitest'

import type { DBLike, EncounterRecord } from '@artificer-toolkit/db'
import type { CampaignSceneState, SceneToken } from '@artificer-toolkit/shared/vtt'

import type { CharacterRuleActionSpatialDirective } from '../rules/characterRuleActionSystemAdapter.js'
import {
  planTowardSourceForcedMovement,
  settleEncounterActionForcedMovement
} from './encounterActionForcedMovement.js'

function token(input: {
  id: string
  x: number
  y?: number
  width?: number
  height?: number
}): SceneToken {
  return {
    assetId: null,
    controlledByUserIds: [],
    height: input.height ?? 5,
    hidden: false,
    id: input.id,
    label: input.id,
    locked: true,
    position: { x: input.x, y: input.y ?? 50 },
    rotationDegrees: 0,
    vision: null,
    width: input.width ?? 5
  }
}

function state(input?: {
  barriers?: CampaignSceneState['barriers']
  doorStates?: CampaignSceneState['doorStates']
}) {
  return {
    barriers: input?.barriers ?? [],
    doorStates: input?.doorStates ?? {},
    map: { width: 500, height: 500 }
  } as Pick<CampaignSceneState, 'barriers' | 'doorStates' | 'map'>
}

describe('planTowardSourceForcedMovement', () => {
  it('rejects a directive without bounded sealed provenance before Scene access', async () => {
    const directive: CharacterRuleActionSpatialDirective = {
      actionEconomy: 'NONE',
      amount: 25,
      authoredPath: null,
      direction: 'TOWARD_SOURCE',
      distanceMode: 'FIXED_DISTANCE',
      kind: 'FORCED_MOVEMENT',
      resolvedPath: ' ',
      sourceNodeId: ' ',
      sourceOperationKey: 'x'.repeat(241),
      targetActorId: 'target',
      targetStateChecksum: 'target-checksum',
      unit: 'FEET'
    }
    await expect(
      settleEncounterActionForcedMovement({
        actorUserId: 'actor-user',
        commandFingerprint: 'fingerprint',
        commandId: 'command',
        db: {} as DBLike,
        directives: [directive],
        encounter: { campaignId: 'campaign', id: 'encounter' } as EncounterRecord,
        sceneContext: null,
        sourceActorId: 'source',
        targetActorId: 'target',
        targetStateChecksum: 'target-checksum'
      })
    ).rejects.toThrow('unsupported forced movement directive')
  })

  it('pulls 25 feet on a calibrated gridless Scene', () => {
    const path = planTowardSourceForcedMovement({
      state: state(),
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'FEET' },
      sourceToken: token({ id: 'source', x: 0 }),
      targetToken: token({ id: 'target', x: 200 }),
      distance: 25
    })
    expect(path).toEqual([
      { x: 200, y: 50 },
      { x: 75, y: 50 }
    ])
  })

  it('uses the square-grid distance policy instead of treating feet as pixels', () => {
    const path = planTowardSourceForcedMovement({
      state: state(),
      grid: {
        kind: 'SQUARE',
        cellSize: 10,
        diagonalPolicy: 'EQUAL',
        distancePerCell: 5,
        origin: { x: 0, y: 0 },
        unit: 'FEET'
      },
      sourceToken: token({ id: 'source', x: 0 }),
      targetToken: token({ id: 'target', x: 200 }),
      distance: 25
    })
    expect(path.at(-1)!.x).toBeGreaterThanOrEqual(145)
    expect(path.at(-1)!.x).toBeLessThanOrEqual(150)
  })

  it('stops at source-footprint contact and leaves an already-adjacent target in place', () => {
    const grid = { kind: 'GRIDLESS' as const, pixelsPerUnit: 1, unit: 'FEET' as const }
    const source = token({ id: 'source', x: 0 })
    const pulled = planTowardSourceForcedMovement({
      state: state(),
      grid,
      sourceToken: source,
      targetToken: token({ id: 'target', x: 50 }),
      distance: 100
    })
    expect(pulled.at(-1)!.x).toBeGreaterThanOrEqual(5)
    expect(pulled.at(-1)!.x).toBeLessThan(5.001)
    expect(
      planTowardSourceForcedMovement({
        state: state(),
        grid,
        sourceToken: source,
        targetToken: token({ id: 'adjacent', x: 5 }),
        distance: 25
      })
    ).toEqual([{ x: 5, y: 50 }])
  })

  it('stops the full token footprint before a blocking barrier', () => {
    const path = planTowardSourceForcedMovement({
      state: state({
        barriers: [
          {
            a: { x: 20, y: 0 },
            b: { x: 20, y: 100 },
            blocksMovement: true,
            blocksLight: true,
            id: 'wall',
            kind: 'WALL'
          }
        ]
      }),
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' },
      sourceToken: token({ id: 'source', x: 0 }),
      targetToken: token({ id: 'target', x: 50 }),
      distance: 100
    })
    expect(path.at(-1)!.x).toBeGreaterThanOrEqual(22.5)
    expect(path.at(-1)!.x).toBeLessThan(22.501)
  })

  for (const { barrier, name } of [
    {
      barrier: {
        a: { x: 30, y: 0 },
        b: { x: 30, y: 100 },
        blocksLight: true,
        blocksMovement: true,
        id: 'contact-wall',
        kind: 'WALL' as const
      },
      name: 'wall'
    },
    {
      barrier: {
        a: { x: 30, y: 0 },
        b: { x: 30, y: 100 },
        blocksLightWhenClosed: true,
        blocksMovementWhenClosed: true,
        id: 'contact-door',
        initialState: 'CLOSED' as const,
        kind: 'DOOR' as const,
        openAngleDegrees: 90
      },
      name: 'closed door'
    }
  ] satisfies readonly { barrier: CampaignSceneState['barriers'][number]; name: string }[]) {
    it(`allows a footprint touching a ${name} to move away or tangent, but not into it`, () => {
      const grid = { kind: 'GRIDLESS' as const, pixelsPerUnit: 1, unit: 'FEET' as const }
      const common = { state: state({ barriers: [barrier] }), grid, distance: 10 }
      expect(
        planTowardSourceForcedMovement({
          ...common,
          sourceToken: token({ id: 'away-source', x: 100 }),
          targetToken: token({ id: 'away-target', x: 32.5 })
        }).at(-1)!.x
      ).toBeCloseTo(42.5)
      expect(
        planTowardSourceForcedMovement({
          ...common,
          sourceToken: token({ id: 'tangent-source', x: 32.5, y: 0 }),
          targetToken: token({ id: 'tangent-target', x: 32.5, y: 50 })
        }).at(-1)!.y
      ).toBeCloseTo(40)
      expect(
        planTowardSourceForcedMovement({
          ...common,
          sourceToken: token({ id: 'into-source', x: 0 }),
          targetToken: token({ id: 'into-target', x: 32.5 })
        })
      ).toEqual([{ x: 32.5, y: 50 }])
    })
  }

  it('stops for a short barrier intersecting the swept footprint between center and corner rays', () => {
    const path = planTowardSourceForcedMovement({
      state: state({
        barriers: [
          {
            a: { x: 30, y: 48 },
            b: { x: 35, y: 48 },
            blocksMovement: true,
            blocksLight: true,
            id: 'short-wall',
            kind: 'WALL'
          }
        ]
      }),
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' },
      sourceToken: token({ id: 'source', x: 0 }),
      targetToken: token({ id: 'target', x: 50 }),
      distance: 100
    })
    expect(path.at(-1)!.x).toBeGreaterThanOrEqual(37.5)
    expect(path.at(-1)!.x).toBeLessThan(37.501)
  })

  it('blocks a closed door footprint collision but allows the same open door', () => {
    const barrier: CampaignSceneState['barriers'][number] = {
      a: { x: 30, y: 48 },
      b: { x: 35, y: 48 },
      blocksLightWhenClosed: true,
      blocksMovementWhenClosed: true,
      id: 'short-door',
      initialState: 'CLOSED',
      kind: 'DOOR',
      openAngleDegrees: 90
    }
    const input = {
      grid: { kind: 'GRIDLESS' as const, pixelsPerUnit: 1, unit: 'FEET' as const },
      sourceToken: token({ id: 'source', x: 0 }),
      targetToken: token({ id: 'target', x: 50 }),
      distance: 100
    }
    expect(
      planTowardSourceForcedMovement({ ...input, state: state({ barriers: [barrier] }) }).at(-1)!.x
    ).toBeLessThan(40.001)
    expect(
      planTowardSourceForcedMovement({
        ...input,
        state: state({ barriers: [barrier], doorStates: { 'short-door': 'OPEN' } })
      }).at(-1)!.x
    ).toBeCloseTo(5)
  })

  it('preserves one-way barrier direction for the full footprint', () => {
    const barrier: CampaignSceneState['barriers'][number] = {
      a: { x: 30, y: 45 },
      b: { x: 30, y: 55 },
      blockedDirection: 'RIGHT_TO_LEFT',
      blocksLight: true,
      blocksMovement: true,
      id: 'one-way',
      kind: 'ONE_WAY'
    }
    const grid = { kind: 'GRIDLESS' as const, pixelsPerUnit: 1, unit: 'FEET' as const }
    expect(
      planTowardSourceForcedMovement({
        state: state({ barriers: [barrier] }),
        grid,
        sourceToken: token({ id: 'source', x: 0 }),
        targetToken: token({ id: 'target', x: 50 }),
        distance: 100
      }).at(-1)!.x
    ).toBeCloseTo(5)
    expect(
      planTowardSourceForcedMovement({
        state: state({ barriers: [barrier] }),
        grid,
        sourceToken: token({ id: 'source', x: 100 }),
        targetToken: token({ id: 'target', x: 5 }),
        distance: 60
      }).at(-1)!.x
    ).toBeCloseTo(27.5)
  })

  it('blocks a footprint already in contact with a one-way barrier only in its blocked direction', () => {
    const barrier: CampaignSceneState['barriers'][number] = {
      a: { x: 30, y: 45 },
      b: { x: 30, y: 55 },
      blockedDirection: 'RIGHT_TO_LEFT',
      blocksLight: true,
      blocksMovement: true,
      id: 'one-way-contact',
      kind: 'ONE_WAY'
    }
    const grid = { kind: 'GRIDLESS' as const, pixelsPerUnit: 1, unit: 'FEET' as const }
    expect(
      planTowardSourceForcedMovement({
        state: state({ barriers: [barrier] }),
        grid,
        sourceToken: token({ id: 'source', x: 100 }),
        targetToken: token({ id: 'target', x: 27.5 }),
        distance: 10
      })
    ).toEqual([{ x: 27.5, y: 50 }])
    expect(
      planTowardSourceForcedMovement({
        state: state({ barriers: [barrier] }),
        grid,
        sourceToken: token({ id: 'source', x: 0 }),
        targetToken: token({ id: 'target', x: 32.5 }),
        distance: 10
      }).at(-1)!.x
    ).toBeCloseTo(22.5)
  })
})
