import { describe, expect, it } from 'vitest'
import type { AreaActionTargetDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterAreaActionPendingContextDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { areaMatchesTarget } from '../actionAreaPending.js'

const SCENE = { sceneId: '00000000-0000-4000-8000-000000000001', expectedSceneVersion: 3 }

const sealed = (shape: EncounterAreaActionPendingContextDto['area']['shape']) => ({
  origin: { x: 200, y: 150 },
  shape
})
const cone = sealed({ kind: 'CONE', length: 300, toward: { x: 500, y: 150 } })

describe('the sealed area against the command that aimed it', () => {
  it('matches a point area at the same point', () => {
    const point: AreaActionTargetDto = { kind: 'POINT', ...SCENE, point: { x: 200, y: 150 } }
    expect(areaMatchesTarget(sealed({ kind: 'RADIUS', radius: 400 }), point)).toBe(true)
    expect(
      areaMatchesTarget(sealed({ kind: 'RADIUS', radius: 400 }), {
        ...point,
        point: { x: 300, y: 150 }
      })
    ).toBe(false)
  })

  it('matches a directed area at the same origin and direction', () => {
    expect(
      areaMatchesTarget(cone, {
        kind: 'DIRECTED',
        ...SCENE,
        origin: { x: 200, y: 150 },
        toward: { x: 500, y: 150 }
      })
    ).toBe(true)
  })

  it.each([
    ['origin', { origin: { x: 200, y: 160 }, toward: { x: 500, y: 150 } }],
    ['direction', { origin: { x: 200, y: 150 }, toward: { x: 500, y: 300 } }]
  ])('rejects a directed area whose %s changed', (_name, aim) => {
    expect(areaMatchesTarget(cone, { kind: 'DIRECTED', ...SCENE, ...aim })).toBe(false)
  })

  it('rejects a directed command against a sealed area that holds no direction', () => {
    expect(
      areaMatchesTarget(sealed({ kind: 'RADIUS', radius: 400 }), {
        kind: 'DIRECTED',
        ...SCENE,
        origin: { x: 200, y: 150 },
        toward: { x: 500, y: 150 }
      })
    ).toBe(false)
  })
})
