import { describe, expect, it } from 'vitest'

import { SceneBarrierIndex } from '../domains/vtt/geometry.js'
import type { CampaignSceneState, SceneToken } from '../domains/vtt/scene.js'
import {
  measureSceneTokenFootprintDistance,
  resolveSceneCombatPerceptionEnvironment,
  resolveSceneIlluminationAt
} from '../domains/vtt/sceneCombatPerception.js'

const grid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
} as const

function token(position: { x: number; y: number }, size = 100): SceneToken {
  return {
    assetId: null,
    controlledByUserIds: [],
    height: size,
    hidden: false,
    id: crypto.randomUUID(),
    label: 'private label',
    locked: false,
    position,
    rotationDegrees: 0,
    vision: null,
    width: size
  }
}

function scene(
  overrides: Partial<
    Pick<
      CampaignSceneState,
      'ambientIllumination' | 'barriers' | 'darknessZones' | 'doorStates' | 'grid' | 'lights'
    >
  > = {}
) {
  return {
    ambientIllumination: 'BRIGHT',
    barriers: [],
    darknessZones: [],
    doorStates: {},
    grid,
    lights: [],
    ...overrides
  } satisfies Pick<
    CampaignSceneState,
    'ambientIllumination' | 'barriers' | 'darknessZones' | 'doorStates' | 'grid' | 'lights'
  >
}

function resolve(observer: SceneToken, subject: SceneToken, environment = scene()) {
  return resolveSceneCombatPerceptionEnvironment({
    scene: environment,
    observer,
    subject,
    sharedSurface: false,
    invisibleChannels: [],
    suppressedChannels: []
  })
}

describe('Scene combat-perception environment', () => {
  it('counts grid squares to the nearest occupied square, so adjacent is 5 feet', () => {
    const observer = token({ x: 50, y: 50 })

    expect(measureSceneTokenFootprintDistance(grid, observer, token({ x: 50, y: 50 }))).toBe(0)
    expect(measureSceneTokenFootprintDistance(grid, observer, token({ x: 150, y: 50 }))).toBe(5)
    expect(measureSceneTokenFootprintDistance(grid, observer, token({ x: 150, y: 150 }))).toBe(5)
    expect(measureSceneTokenFootprintDistance(grid, observer, token({ x: 250, y: 50 }))).toBe(10)
  })

  it('measures a multi-square creature from its nearest occupied square', () => {
    const observer = token({ x: 50, y: 50 })
    // A Large creature occupying the 2x2 squares from (200, 0) to (400, 200).
    const large = token({ x: 300, y: 100 }, 200)

    expect(measureSceneTokenFootprintDistance(grid, observer, large)).toBe(10)
    expect(measureSceneTokenFootprintDistance(grid, large, observer)).toBe(10)
    expect(measureSceneTokenFootprintDistance(grid, token({ x: 150, y: 150 }), large)).toBe(5)
  })

  it("counts diagonals by the grid's diagonal rule", () => {
    const observer = token({ x: 50, y: 50 })
    const diagonal = token({ x: 250, y: 250 })

    expect(measureSceneTokenFootprintDistance(grid, observer, diagonal)).toBe(10)
    expect(
      measureSceneTokenFootprintDistance(
        { ...grid, diagonalPolicy: 'ALTERNATING' },
        observer,
        diagonal
      )
    ).toBe(15)
  })

  it('uses zero gap on an overlapping footprint axis', () => {
    const gridless = {
      kind: 'GRIDLESS',
      pixelsPerUnit: 10,
      unit: 'FEET'
    } as const

    // A 10-foot edge gap plus the 5-foot base square.
    expect(
      measureSceneTokenFootprintDistance(
        gridless,
        token({ x: 50, y: 50 }),
        token({ x: 100, y: 250 })
      )
    ).toBe(15)
  })

  it('measures a gridless Scene as the edge gap plus the base square, so adjacent is 5 feet', () => {
    const gridless = { kind: 'GRIDLESS', pixelsPerUnit: 20, unit: 'FEET' } as const
    const observer = token({ x: 50, y: 50 })

    expect(measureSceneTokenFootprintDistance(gridless, observer, token({ x: 150, y: 50 }))).toBe(5)
    expect(measureSceneTokenFootprintDistance(gridless, observer, token({ x: 250, y: 50 }))).toBe(
      10
    )
    expect(
      measureSceneTokenFootprintDistance(
        { ...gridless, unit: 'METERS' },
        observer,
        token({ x: 150, y: 50 })
      )
    ).toBeCloseTo(1.524)
  })

  it('separates visual obstruction from physical line of effect', () => {
    const observer = token({ x: 50, y: 50 })
    const subject = token({ x: 250, y: 50 })
    const window = {
      a: { x: 150, y: 0 },
      b: { x: 150, y: 100 },
      blocksLight: true,
      blocksMovement: false,
      id: crypto.randomUUID(),
      kind: 'WINDOW'
    } as const

    expect(resolve(observer, subject, scene({ barriers: [window] }))).toMatchObject({
      lineOfEffect: true,
      suppressedChannels: ['VISUAL']
    })
    expect(
      resolve(observer, subject, scene({ barriers: [{ ...window, blocksMovement: true }] }))
    ).toMatchObject({ lineOfEffect: false, suppressedChannels: ['VISUAL'] })
  })

  it('uses barrier-aware lights then applies authoritative mechanical zone severity', () => {
    const observer = token({ x: 50, y: 50 })
    const subject = token({ x: 250, y: 50 })
    const environment = scene({
      ambientIllumination: 'ORDINARY_DARKNESS',
      lights: [
        {
          brightRadius: 100,
          color: '#ffffff',
          dimRadius: 200,
          id: crypto.randomUUID(),
          intensity: 1,
          kind: 'POINT',
          position: subject.position
        }
      ]
    })

    expect(resolve(observer, subject, environment).illumination).toBe('BRIGHT')
    expect(
      resolve(
        observer,
        subject,
        scene({
          ...environment,
          darknessZones: [
            {
              id: crypto.randomUUID(),
              mechanicalIllumination: 'MAGICAL_DARKNESS',
              mechanicalObscurement: 'HEAVY',
              opacity: 1,
              polygon: {
                points: [
                  { x: 200, y: 0 },
                  { x: 300, y: 0 },
                  { x: 300, y: 100 },
                  { x: 200, y: 100 }
                ]
              }
            }
          ]
        })
      )
    ).toMatchObject({ illumination: 'MAGICAL_DARKNESS', obscurement: 'HEAVY' })
  })

  describe('illumination precedence at a point (D108)', () => {
    const observer = token({ x: 50, y: 450 })
    const torch = {
      brightRadius: 100,
      color: '#ffffff',
      dimRadius: 300,
      id: crypto.randomUUID(),
      intensity: 1,
      kind: 'POINT',
      position: { x: 50, y: 50 }
    } as const
    const zonePolygon = {
      points: [
        { x: 0, y: 0 },
        { x: 600, y: 0 },
        { x: 600, y: 100 },
        { x: 0, y: 100 }
      ]
    }
    const zoneOf = (mechanicalIllumination: 'DIM' | 'ORDINARY_DARKNESS' | 'MAGICAL_DARKNESS') => ({
      id: crypto.randomUUID(),
      mechanicalIllumination,
      mechanicalObscurement: null,
      opacity: 1,
      polygon: zonePolygon
    })
    const illuminationAt = (x: number, environment: ReturnType<typeof scene>) =>
      resolve(observer, token({ x, y: 50 }), environment).illumination

    it('lets a torch light a point inside an ordinary darkness zone by its radii', () => {
      const environment = scene({
        darknessZones: [zoneOf('ORDINARY_DARKNESS')],
        lights: [torch]
      })

      expect(illuminationAt(100, environment)).toBe('BRIGHT')
      expect(illuminationAt(250, environment)).toBe('DIM')
      expect(illuminationAt(450, environment)).toBe('ORDINARY_DARKNESS')
    })

    it('lets a torch light an unlit cave outside any zone', () => {
      const environment = scene({ ambientIllumination: 'ORDINARY_DARKNESS', lights: [torch] })

      expect(illuminationAt(100, environment)).toBe('BRIGHT')
      expect(illuminationAt(250, environment)).toBe('DIM')
      expect(illuminationAt(450, environment)).toBe('ORDINARY_DARKNESS')
    })

    it('keeps magical darkness over a torch, even within its bright radius', () => {
      const environment = scene({
        darknessZones: [zoneOf('MAGICAL_DARKNESS')],
        lights: [torch]
      })

      expect(illuminationAt(100, environment)).toBe('MAGICAL_DARKNESS')
    })

    it('keeps a magically dark Scene dark under a torch, even within its bright radius', () => {
      const environment = scene({ ambientIllumination: 'MAGICAL_DARKNESS', lights: [torch] })

      expect(illuminationAt(100, environment)).toBe('MAGICAL_DARKNESS')
      expect(illuminationAt(250, environment)).toBe('MAGICAL_DARKNESS')
    })

    it('darkens bright ambient light to dim inside a dim zone with no light', () => {
      expect(illuminationAt(100, scene({ darknessZones: [zoneOf('DIM')] }))).toBe('DIM')
    })

    it('leaves the zone darkness when a wall stops the torch light', () => {
      const wall = {
        a: { x: 150, y: 0 },
        b: { x: 150, y: 100 },
        blocksLight: true,
        blocksMovement: true,
        id: crypto.randomUUID(),
        kind: 'WALL'
      } as const
      const environment = scene({
        barriers: [wall],
        darknessZones: [zoneOf('ORDINARY_DARKNESS')],
        lights: [torch]
      })

      expect(illuminationAt(250, environment)).toBe('ORDINARY_DARKNESS')
    })

    it('resolves the same illumination and obscurement for a bare point', () => {
      const environment = scene({
        darknessZones: [{ ...zoneOf('ORDINARY_DARKNESS'), mechanicalObscurement: 'LIGHT' }],
        lights: [torch]
      })

      expect(
        resolveSceneIlluminationAt(
          environment,
          { x: 100, y: 50 },
          new SceneBarrierIndex(environment.barriers)
        )
      ).toEqual({ illumination: 'BRIGHT', obscurement: 'LIGHT' })
    })
  })

  it('retains only canonical channel facts and requires shared-surface authority explicitly', () => {
    const result = resolveSceneCombatPerceptionEnvironment({
      scene: scene(),
      observer: token({ x: 50, y: 50 }),
      subject: token({ x: 250, y: 50 }),
      sharedSurface: true,
      invisibleChannels: ['VISUAL', 'NONVISUAL', 'VISUAL'],
      suppressedChannels: ['AUDITORY', 'AUDITORY']
    })

    expect(result).toMatchObject({
      sharedSurface: true,
      invisibleChannels: ['NONVISUAL', 'VISUAL'],
      suppressedChannels: ['AUDITORY']
    })
  })
})
