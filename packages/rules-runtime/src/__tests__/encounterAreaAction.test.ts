import { describe, expect, it } from 'vitest'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import {
  compileEncounterPointArea,
  encounterActionChoiceTarget,
  encounterActionTargetKind,
  evaluateEncounterAreaTargetPolicy,
  evaluateEncounterCasterCenteredAreaTarget,
  evaluateEncounterDirectedAreaTarget,
  evaluateEncounterSummonTarget
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

describe('chosen creatures target', () => {
  const chosen = (
    targeting: Partial<
      Omit<
        Extract<
          NonNullable<CompiledActionTargetPolicy['targeting']>,
          { selectionKind: 'CHOSEN_CREATURES' }
        >,
        'selectionKind'
      >
    >,
    shape: CompiledActionTargetPolicy['shape'] = null
  ) =>
    policy({
      shape,
      targeting: { selectionKind: 'CHOSEN_CREATURES', dispositionKind: 'ANY', ...targeting }
    })

  it('takes a list of actors for a shapeless selection with an authored cap', () => {
    expect(encounterActionTargetKind(chosen({ maxTargets: 6 }))).toBe('ACTORS')
    expect(encounterActionChoiceTarget(chosen({ maxTargets: 6 }))).toEqual({
      kind: 'ACTORS',
      maxTargets: 6,
      area: null
    })
  })

  it('lets the client name a creature more than once when the selection allows repeated targets', () => {
    expect(
      encounterActionChoiceTarget(chosen({ maxTargets: 3, allowRepeatedTargets: true }))
    ).toEqual({ kind: 'ACTORS', maxTargets: 3, area: null, allowRepeatedTargets: true })
    expect(
      encounterActionChoiceTarget(chosen({ maxTargets: 3, allowRepeatedTargets: false }))
    ).toEqual({ kind: 'ACTORS', maxTargets: 3, area: null })
  })

  it('takes the list inside a round area picked at a point within range', () => {
    for (const shape of [SHAPES.SPHERE, SHAPES.CYLINDER, SHAPES.CIRCLE])
      expect(encounterActionTargetKind(chosen({ maxTargets: 6 }, shape)), shape.shapeKind).toBe(
        'ACTORS'
      )
    expect(encounterActionChoiceTarget(chosen({ maxTargets: 6 }, SHAPES.SPHERE))).toEqual({
      kind: 'ACTORS',
      maxTargets: 6,
      area: { kind: 'RADIUS', radius: feet(20) }
    })
  })

  it('refuses a list inside an area it cannot aim at a point', () => {
    for (const shape of [SHAPES.CUBE, SHAPES.CONE, SHAPES.LINE, SHAPES.WALL, SHAPES.DOME])
      expect(
        encounterActionTargetKind(chosen({ maxTargets: 6 }, shape)),
        shape.shapeKind
      ).toBeNull()
    expect(
      encounterActionTargetKind({
        ...chosen({ maxTargets: 6 }, SHAPES.SPHERE),
        range: { id: 'range', rangeKind: 'SELF' }
      })
    ).toBeNull()
  })

  it('takes an uncapped list that names each creature once (SPELLS-4.T2a3 ruling 4)', () => {
    expect(encounterActionTargetKind(chosen({}))).toBe('ACTORS')
    expect(encounterActionChoiceTarget(chosen({}))).toEqual({ kind: 'ACTORS', area: null })
  })

  it('refuses an uncapped list that repeats creatures, or a cap this path does not resolve', () => {
    const scaling = {
      scalingKind: 'BREAKPOINTS' as const,
      scalingSource: 'CHARACTER_LEVEL' as const,
      breakpoints: [{ id: 'breakpoint', level: 5, order: 0, value: { amount: 8 } }]
    }
    for (const targeting of [
      { allowRepeatedTargets: true },
      { maxTargets: 6, maxTargetsScaling: scaling }
    ])
      expect(encounterActionTargetKind(chosen(targeting)), JSON.stringify(targeting)).toBeNull()
  })
})

describe('encounter action choice target', () => {
  const single = (self: 'ALLOWED' | 'WARN' | 'REFUSED') =>
    encounterActionChoiceTarget(
      policy({
        shape: null,
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY', self }
      })
    )

  it('flags a single target that only a creature the user holds can be', () => {
    const held = encounterActionChoiceTarget(
      policy({
        shape: null,
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY', heldBySource: true }
      })
    )
    expect(held).toMatchObject({ kind: 'ACTOR', heldBySource: true })
    expect(single('REFUSED')).not.toHaveProperty('heldBySource')
  })

  it('projects the authored self of a single target, whatever it is', () => {
    expect(single('REFUSED')).toEqual({ kind: 'ACTOR', self: 'REFUSED' })
    expect(single('WARN')).toEqual({ kind: 'ACTOR', self: 'WARN' })
    expect(single('ALLOWED')).toEqual({ kind: 'ACTOR', self: 'ALLOWED' })
  })

  it('asks for nothing of a self action', () => {
    expect(
      encounterActionChoiceTarget(policy({ shape: null, targeting: { selectionKind: 'SELF' } }))
    ).toEqual({
      kind: 'SELF'
    })
  })

  it('allows the user where the selection authors no self', () => {
    expect(
      encounterActionChoiceTarget(
        policy({
          shape: null,
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        })
      )
    ).toEqual({ kind: 'ACTOR', self: 'ALLOWED' })
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
  })

  it('still checks sight for an unlimited range', () => {
    expect(
      evaluate({
        targetPolicy: policy({ range: { id: 'range', rangeKind: 'UNLIMITED' } }),
        pointSeen: false
      })?.warnings.map(({ code }) => code)
    ).toEqual(['TARGET_OUT_OF_SIGHT'])
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

  it('measures a touch origin against the 5 ft. a single-target touch reaches', () => {
    const touch = policy({ range: { id: 'range', rangeKind: 'TOUCH' } })
    expect(evaluate({ targetPolicy: touch, point: at(1) })?.warnings).toEqual([])
    expect(evaluate({ targetPolicy: touch, point: at(2) })?.warnings).toEqual([
      { code: 'TARGET_OUT_OF_RANGE', message: 'The area origin is out of range.' }
    ])
  })

  it('refuses a policy that takes an actor, an unsupported shape, or a self origin', () => {
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
      evaluate({ targetPolicy: policy({ range: { id: 'range', rangeKind: 'SPECIAL' } }) })
    ).toBeNull()
  })
})

describe('directed area', () => {
  const SELF: CompiledActionTargetPolicy['range'] = { id: 'range', rangeKind: 'SELF' }
  const directed = (shape: CompiledActionTargetPolicy['shape']) => policy({ range: SELF, shape })
  /** A Medium caster in the cell at the grid's origin: its east edge is x = 100. */
  const east = { origin: { x: 100, y: 50 }, toward: { x: 400, y: 50 } }

  it('takes an origin and a direction for a Self cone, line or cube, and refuses any other range', () => {
    for (const shape of [SHAPES.CONE, SHAPES.LINE, SHAPES.CUBE])
      expect(encounterActionTargetKind(directed(shape)), shape.shapeKind).toBe('DIRECTED')
    for (const shape of [SHAPES.CONE, SHAPES.LINE])
      expect(encounterActionTargetKind(policy({ shape })), shape.shapeKind).toBeNull()
    for (const shape of [SHAPES.WALL, SHAPES.DOME])
      expect(encounterActionTargetKind(directed(shape)), shape.shapeKind).toBeNull()
    expect(encounterActionTargetKind(policy({ shape: SHAPES.CUBE }))).toBe('POINT')
  })

  it('projects the authored area of a directed choice, a cube as the cube from the side', () => {
    expect(encounterActionChoiceTarget(directed(SHAPES.CONE))).toEqual({
      kind: 'DIRECTED',
      area: { kind: 'CONE', length: feet(15) }
    })
    expect(encounterActionChoiceTarget(directed(SHAPES.LINE))).toEqual({
      kind: 'DIRECTED',
      area: { kind: 'LINE', length: feet(100), width: feet(5) }
    })
    expect(encounterActionChoiceTarget(directed(SHAPES.CUBE))).toEqual({
      kind: 'DIRECTED',
      area: { kind: 'CUBE_FROM_SIDE', edgeLength: feet(15) }
    })
  })

  it('compiles the authored size into Scene units aimed at the direction', () => {
    expect(
      evaluateEncounterDirectedAreaTarget({
        targetPolicy: directed(SHAPES.CONE),
        ...east,
        grid: FEET_GRID,
        sourceToken: SOURCE_TOKEN
      })
    ).toEqual({ shape: { kind: 'CONE', length: 300, toward: east.toward }, warnings: [] })
    // 15 ft is 4.572 m, which is 3.048 cells of 1.5 m.
    const metric = evaluateEncounterDirectedAreaTarget({
      targetPolicy: directed(SHAPES.CONE),
      ...east,
      grid: METERS_GRID,
      sourceToken: SOURCE_TOKEN
    })
    expect(
      'shape' in metric && metric.shape.kind === 'CONE' ? metric.shape.length : null
    ).toBeCloseTo(304.8, 6)
  })

  it('carries the grid’s cell size and origin on a cube, so it can sit on the grid beside the caster', () => {
    expect(
      evaluateEncounterDirectedAreaTarget({
        targetPolicy: directed(SHAPES.CUBE),
        ...east,
        grid: FEET_GRID,
        sourceToken: SOURCE_TOKEN
      })
    ).toEqual({
      shape: {
        kind: 'CUBE_FROM_SIDE',
        edgeLength: 300,
        cellSize: 100,
        gridOrigin: { x: 0, y: 0 },
        toward: east.toward
      },
      warnings: []
    })
    const offset = { ...FEET_GRID, origin: { x: 30, y: 45 } }
    expect(
      evaluateEncounterDirectedAreaTarget({
        targetPolicy: directed(SHAPES.CUBE),
        ...east,
        grid: offset,
        sourceToken: SOURCE_TOKEN
      })
    ).toMatchObject({ shape: { gridOrigin: { x: 30, y: 45 } } })
  })

  it('refuses with the reason: a size or policy it cannot draw, or an origin off the caster', () => {
    const base = { grid: FEET_GRID, sourceToken: SOURCE_TOKEN, ...east }
    const refusal = (input: Partial<Parameters<typeof evaluateEncounterDirectedAreaTarget>[0]>) =>
      evaluateEncounterDirectedAreaTarget({
        targetPolicy: directed(SHAPES.CONE),
        ...base,
        ...input
      })
    expect(refusal({ origin: { x: 250, y: 50 } })).toEqual({ refusal: 'ORIGIN_OFF_CASTER' })
    expect(refusal({ toward: east.origin })).toEqual({ refusal: 'ORIGIN_OFF_CASTER' })
    expect(refusal({ targetPolicy: policy({ shape: SHAPES.CUBE }) })).toEqual({
      refusal: 'UNSUPPORTED_AREA'
    })
  })
})

// SPELLS-22, D114: a Self sphere, cylinder or circle is centered on the caster and takes no aim.
describe('caster-centered area', () => {
  const CASTER_TOKEN = { position: { x: 150, y: 150 }, width: 100, height: 100 }
  const SELF: CompiledActionTargetPolicy['range'] = { id: 'range', rangeKind: 'SELF' }
  const centered = (shape: CompiledActionTargetPolicy['shape']) => policy({ range: SELF, shape })

  it('takes no aim for a Self sphere, cylinder or circle, and refuses a Self wall or dome', () => {
    for (const shape of [SHAPES.SPHERE, SHAPES.CYLINDER, SHAPES.CIRCLE])
      expect(encounterActionTargetKind(centered(shape)), shape.shapeKind).toBe('CASTER_CENTERED')
    for (const shape of [SHAPES.WALL, SHAPES.DOME])
      expect(encounterActionTargetKind(centered(shape)), shape.shapeKind).toBeNull()
  })

  it('projects the authored radius of a centered choice', () => {
    expect(encounterActionChoiceTarget(centered(SHAPES.SPHERE))).toEqual({
      kind: 'CASTER_CENTERED',
      area: { kind: 'RADIUS', radius: feet(20) }
    })
    expect(encounterActionChoiceTarget(centered(SHAPES.CIRCLE))).toEqual({
      kind: 'CASTER_CENTERED',
      area: { kind: 'RADIUS', radius: feet(5) }
    })
  })

  it('compiles the radius in Scene units, centered on the caster’s token', () => {
    expect(
      evaluateEncounterCasterCenteredAreaTarget({
        targetPolicy: centered(SHAPES.SPHERE),
        grid: FEET_GRID,
        sourceToken: CASTER_TOKEN
      })
    ).toEqual({ shape: { kind: 'RADIUS', radius: 400 }, warnings: [] })
  })

  it('takes the caster’s own space for a Self area that names no shape (SPELLS-33.T6k2b)', () => {
    const ownSpace = centered(null)
    expect(encounterActionTargetKind(ownSpace)).toBe('CASTER_CENTERED')
    expect(encounterActionChoiceTarget(ownSpace)).toEqual({
      kind: 'CASTER_CENTERED',
      area: { kind: 'OWN_SPACE' }
    })
    expect(
      evaluateEncounterCasterCenteredAreaTarget({
        targetPolicy: ownSpace,
        grid: FEET_GRID,
        sourceToken: { position: { x: 150, y: 150 }, width: 200, height: 200 }
      })
    ).toEqual({ shape: { kind: 'CUBE', edgeLength: 200 }, warnings: [] })
  })

  it('refuses with the reason: a size or policy it cannot draw', () => {
    const refusal = (
      input: Partial<Parameters<typeof evaluateEncounterCasterCenteredAreaTarget>[0]>
    ) =>
      evaluateEncounterCasterCenteredAreaTarget({
        targetPolicy: centered(SHAPES.SPHERE),
        grid: FEET_GRID,
        sourceToken: CASTER_TOKEN,
        ...input
      })
    expect(refusal({ targetPolicy: policy({ shape: SHAPES.SPHERE }) })).toEqual({
      refusal: 'UNSUPPORTED_AREA'
    })
    expect(refusal({ targetPolicy: centered(SHAPES.DOME) })).toEqual({
      refusal: 'UNSUPPORTED_AREA'
    })
  })
})

describe('summon target', () => {
  const at = (cells: number) => ({ x: 50 + cells * 100, y: 50 })
  const evaluate = (input: Partial<Parameters<typeof evaluateEncounterSummonTarget>[0]>) =>
    evaluateEncounterSummonTarget({
      statBlock: { size: 'MEDIUM' },
      casterHitPointMaximum: 40,
      range: RANGE_150,
      point: at(10),
      grid: FEET_GRID,
      sourceToken: SOURCE_TOKEN,
      pointSeen: true,
      tokens: [],
      ...input
    })

  it('fills the square of the stat block size, centered on the point, with no warning in range and sight', () => {
    expect(evaluate({})).toEqual({ shape: { kind: 'CUBE', edgeLength: 100 }, warnings: [] })
    expect(evaluate({ statBlock: { size: 'LARGE' } })).toMatchObject({
      shape: { kind: 'CUBE', edgeLength: 200 }
    })
  })

  it('warns when the point is out of range or out of sight, as an area origin does', () => {
    expect(evaluate({ point: at(31) })).toMatchObject({
      warnings: [{ code: 'TARGET_OUT_OF_RANGE' }]
    })
    expect(evaluate({ pointSeen: false })).toMatchObject({
      warnings: [{ code: 'TARGET_OUT_OF_SIGHT' }]
    })
  })

  it('refuses a space another token holds only when the summon occupies space', () => {
    const tokens = [{ position: at(10), width: 100, height: 100 }]
    expect(evaluate({ statBlock: { size: 'MEDIUM', occupiesSpace: true }, tokens })).toEqual({
      refusal: 'SPACE_OCCUPIED'
    })
    expect(
      evaluate({ statBlock: { size: 'MEDIUM', occupiesSpace: false }, tokens })
    ).toHaveProperty('shape')
  })

  it('refuses a stat block whose hit points need a caster maximum the Run does not hold', () => {
    const statBlock = { size: 'MEDIUM', hitPoints: { kind: 'HIT_POINT_MAXIMUM' } } as const
    expect(evaluate({ statBlock, casterHitPointMaximum: null })).toEqual({
      refusal: 'HIT_POINTS_UNKNOWN'
    })
    expect(evaluate({ statBlock, casterHitPointMaximum: 40 })).toHaveProperty('shape')
  })

  it('refuses a stat block with no size', () => {
    expect(evaluate({ statBlock: {} })).toEqual({ refusal: 'UNSUPPORTED_SUMMON' })
  })

  it('makes the choice a point for a summon with a sized stat block', () => {
    expect(
      encounterActionChoiceTarget(
        policy({
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
          shape: null
        }),
        null,
        null,
        null,
        false,
        { statBlock: { size: 'MEDIUM' } }
      )
    ).toMatchObject({
      kind: 'POINT',
      area: { kind: 'CUBE', edgeLength: { amount: 5, unit: 'FEET' } }
    })
  })
})
