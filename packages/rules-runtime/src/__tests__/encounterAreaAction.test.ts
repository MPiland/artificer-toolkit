import { describe, expect, it } from 'vitest'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import {
  compileEncounterPointArea,
  encounterActionTargetKind,
  evaluateEncounterAreaTargetPolicy
} from '../encounterAreaAction.js'

/** 100px cells of 5 feet; a Medium token fills one cell and is anchored at its center. */
const FEET_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
const METERS_GRID: SceneGrid = { ...FEET_GRID, distancePerCell: 1.5, unit: 'METERS' }
const SOURCE_TOKEN = { position: { x: 50, y: 50 }, width: 100, height: 100, rotationDegrees: 0 }

const feet = (amount: number) => ({ amount, unit: 'FEET' as const })
const RANGE_150: CompiledActionTargetPolicy['range'] = {
  id: 'range',
  rangeKind: 'DISTANCE',
  amount: 150,
  unit: 'FEET'
}
const AREA: CompiledActionTargetPolicy['targeting'] = {
  selectionKind: 'AREA_CONTENTS',
  dispositionKind: 'ANY'
}

function policy(input: Partial<CompiledActionTargetPolicy>): CompiledActionTargetPolicy {
  return {
    range: RANGE_150,
    targeting: AREA,
    shape: { id: 'shape', shapeKind: 'SPHERE', radius: feet(20) },
    pathOverrides: [],
    ...input
  }
}

const SHAPES = {
  SPHERE: { id: 'shape', shapeKind: 'SPHERE', radius: feet(20) },
  CYLINDER: { id: 'shape', shapeKind: 'CYLINDER', radius: feet(10), height: feet(40) },
  CIRCLE: { id: 'shape', shapeKind: 'CIRCLE', radius: feet(5) },
  CUBE: { id: 'shape', shapeKind: 'CUBE', edgeLength: feet(15) },
  CONE: { id: 'shape', shapeKind: 'CONE', length: feet(15) },
  LINE: { id: 'shape', shapeKind: 'LINE', length: feet(100), width: feet(5) },
  WALL: { id: 'shape', shapeKind: 'WALL', length: feet(60), height: feet(20) },
  DOME: { id: 'shape', shapeKind: 'DOME', radius: feet(10) }
} as const

describe('encounter action target kind', () => {
  it('takes a point for an area-contents action over a sphere, cylinder, circle or cube', () => {
    for (const shape of [SHAPES.SPHERE, SHAPES.CYLINDER, SHAPES.CIRCLE, SHAPES.CUBE])
      expect(encounterActionTargetKind(policy({ shape })), shape.shapeKind).toBe('POINT')
  })

  it('takes an actor for a single-target or self action', () => {
    expect(
      encounterActionTargetKind(
        policy({
          shape: null,
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        })
      )
    ).toBe('ACTOR')
    expect(
      encounterActionTargetKind(
        policy({ shape: null, targeting: null, range: { id: 'range', rangeKind: 'SELF' } })
      )
    ).toBe('ACTOR')
  })

  it('refuses an unsupported area shape and an area policy with no shape or with path overrides', () => {
    for (const shape of [SHAPES.CONE, SHAPES.LINE, SHAPES.WALL, SHAPES.DOME])
      expect(encounterActionTargetKind(policy({ shape })), shape.shapeKind).toBeNull()
    expect(encounterActionTargetKind(policy({ shape: null }))).toBeNull()
    expect(
      encounterActionTargetKind(
        policy({
          pathOverrides: [
            {
              entryId: 'entry',
              pathGroupId: 'group',
              pathCode: 'path',
              pathOrder: 0,
              entryOrder: 0,
              range: null,
              targeting: { selectionKind: 'SINGLE_TARGET' }
            }
          ]
        })
      )
    ).toBeNull()
  })

  it('refuses a single-target action that still names a shape', () => {
    expect(
      encounterActionTargetKind(
        policy({ targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' } })
      )
    ).toBeNull()
  })
})

describe('compiled point area', () => {
  it('compiles a sphere, cylinder and circle to a radius and a cube to an edge in coordinate length', () => {
    expect(compileEncounterPointArea(policy({ shape: SHAPES.SPHERE }), FEET_GRID)).toEqual({
      kind: 'RADIUS',
      radius: 400
    })
    expect(compileEncounterPointArea(policy({ shape: SHAPES.CYLINDER }), FEET_GRID)).toEqual({
      kind: 'RADIUS',
      radius: 200
    })
    expect(compileEncounterPointArea(policy({ shape: SHAPES.CIRCLE }), FEET_GRID)).toEqual({
      kind: 'RADIUS',
      radius: 100
    })
    expect(compileEncounterPointArea(policy({ shape: SHAPES.CUBE }), FEET_GRID)).toEqual({
      kind: 'CUBE',
      edgeLength: 300
    })
  })

  it('reads the authored size in the Scene unit, whatever the grid calibration', () => {
    const area = compileEncounterPointArea(policy({ shape: SHAPES.SPHERE }), METERS_GRID)
    expect(area?.kind).toBe('RADIUS')
    // 20 ft is 6.096 m, which is 4.064 cells of 1.5 m.
    expect(area && area.kind === 'RADIUS' ? area.radius : null).toBeCloseTo(406.4, 6)
    expect(
      compileEncounterPointArea(policy({ shape: SHAPES.SPHERE }), {
        kind: 'GRIDLESS',
        pixelsPerUnit: 8,
        unit: 'FEET'
      })
    ).toEqual({ kind: 'RADIUS', radius: 160 })
  })

  it('reads a feet size as 5-foot squares on a SQUARES grid', () => {
    expect(
      compileEncounterPointArea(policy({ shape: SHAPES.SPHERE }), {
        ...FEET_GRID,
        distancePerCell: 1,
        unit: 'SQUARES'
      })
    ).toEqual({ kind: 'RADIUS', radius: 400 })
  })

  it('refuses a policy that is not a supported point area', () => {
    for (const shape of [SHAPES.CONE, SHAPES.LINE, SHAPES.WALL, SHAPES.DOME, null])
      expect(compileEncounterPointArea(policy({ shape }), FEET_GRID)).toBeNull()
  })

  it('refuses a scaled size, and a non-positive size', () => {
    expect(
      compileEncounterPointArea(
        policy({
          shape: {
            ...SHAPES.SPHERE,
            radius: {
              ...feet(20),
              scaling: {
                scalingKind: 'BREAKPOINTS',
                scalingSource: 'SPELL_CAST_LEVEL',
                breakpoints: [{ id: 'level-4', level: 4, order: 1, value: feet(25) }]
              }
            }
          }
        }),
        FEET_GRID
      )
    ).toBeNull()
    expect(
      compileEncounterPointArea(policy({ shape: { ...SHAPES.SPHERE, radius: feet(0) } }), FEET_GRID)
    ).toBeNull()
  })
})

describe('area target policy', () => {
  const at = (cells: number) => ({ x: 50 + cells * 100, y: 50 })
  const evaluate = (input: Partial<Parameters<typeof evaluateEncounterAreaTargetPolicy>[0]>) =>
    evaluateEncounterAreaTargetPolicy({
      targetPolicy: policy({}),
      point: at(10),
      grid: FEET_GRID,
      sourceToken: SOURCE_TOKEN,
      pointSeen: true,
      ...input
    })

  it('returns the compiled area and no warning for an origin within range, including exactly at it', () => {
    expect(evaluate({})).toEqual({ shape: { kind: 'RADIUS', radius: 400 }, warnings: [] })
    expect(evaluate({ point: at(30) })?.warnings).toEqual([])
  })

  it('warns that an origin beyond the range is out of range', () => {
    expect(evaluate({ point: at(31) })?.warnings).toEqual([
      { code: 'TARGET_OUT_OF_RANGE', message: 'The area origin is out of range.' }
    ])
  })

  it('warns that an origin the caster cannot see is out of sight, even within range', () => {
    expect(evaluate({ pointSeen: false })?.warnings).toEqual([
      { code: 'TARGET_OUT_OF_SIGHT', message: 'The area origin is out of sight.' }
    ])
  })

  it('reports an origin that is both out of range and out of sight with both warnings, range first', () => {
    expect(evaluate({ point: at(31), pointSeen: false })?.warnings.map(({ code }) => code)).toEqual(
      ['TARGET_OUT_OF_RANGE', 'TARGET_OUT_OF_SIGHT']
    )
    expect(
      evaluate({ sourceToken: null, pointSeen: false })?.warnings.map(({ code }) => code)
    ).toEqual(['TARGET_RANGE_UNCHECKED', 'TARGET_OUT_OF_SIGHT'])
  })

  it('still checks sight for an unlimited range', () => {
    expect(
      evaluate({
        targetPolicy: policy({ range: { id: 'range', rangeKind: 'UNLIMITED' } }),
        pointSeen: false
      })?.warnings.map(({ code }) => code)
    ).toEqual(['TARGET_OUT_OF_SIGHT'])
  })

  it('warns the range is unchecked without the caster token, and still returns the area', () => {
    expect(evaluate({ sourceToken: null })).toEqual({
      shape: { kind: 'RADIUS', radius: 400 },
      warnings: [
        {
          code: 'TARGET_RANGE_UNCHECKED',
          message: "Range can't be checked without both tokens on the map."
        }
      ]
    })
  })

  it('has no range limit for an unlimited range', () => {
    expect(
      evaluate({
        targetPolicy: policy({ range: { id: 'range', rangeKind: 'UNLIMITED' } }),
        point: at(500)
      })?.warnings
    ).toEqual([])
  })

  it('never applies the self-target or disposition rules to the creatures an area catches', () => {
    for (const dispositionKind of ['ANY', 'WILLING', 'HOSTILE'] as const)
      expect(
        evaluate({
          targetPolicy: policy({ targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind } }),
          point: at(0)
        })?.warnings
      ).toEqual([])
  })

  it('refuses a policy that takes an actor, an unsupported shape, or a self or touch origin', () => {
    expect(
      evaluate({
        targetPolicy: policy({
          shape: null,
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        })
      })
    ).toBeNull()
    expect(evaluate({ targetPolicy: policy({ shape: SHAPES.CONE }) })).toBeNull()
    expect(
      evaluate({ targetPolicy: policy({ range: { id: 'range', rangeKind: 'SELF' } }) })
    ).toBeNull()
    expect(
      evaluate({ targetPolicy: policy({ range: { id: 'range', rangeKind: 'TOUCH' } }) })
    ).toBeNull()
  })
})
