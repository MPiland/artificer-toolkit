import { describe, expect, it } from 'vitest'

import { SceneBarrierIndex } from '../domains/vtt/geometry.js'
import type { CampaignSceneState, SceneToken } from '../domains/vtt/scene.js'
import {
  measureSceneTokenFootprintDistance,
  resolveSceneCombatPerceptionEnvironment,
  resolveSceneDaylightAt,
  resolveSceneIlluminationAt,
  sceneTokenLights
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
    senses: [],
    vision: null,
    width: size
  }
}

type PerceptionScene = Pick<
  CampaignSceneState,
  'ambientIllumination' | 'barriers' | 'darknessZones' | 'doorStates' | 'grid' | 'lights' | 'tokens'
>

function scene(overrides: Partial<PerceptionScene> = {}): PerceptionScene {
  return {
    ambientIllumination: 'BRIGHT',
    barriers: [],
    darknessZones: [],
    doorStates: {},
    grid,
    lights: [],
    tokens: [],
    ...overrides
  }
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

  describe('light a token sheds (D108, SPELLS-33.T6j)', () => {
    // A 1-square token centred at (50, 50) shedding bright light 10 feet and dim light to 20
    // feet, measured from its edge: 20 coordinates a foot, so bright reaches 250 and dim 450.
    const lantern = { ...token({ x: 50, y: 50 }), light: { brightRadius: 10, dimRadius: 20 } }
    const illuminationAt = (x: number, environment: PerceptionScene) =>
      resolveSceneIlluminationAt(
        environment,
        { x, y: 50 },
        new SceneBarrierIndex(environment.barriers)
      ).illumination

    it('lights the dark around the token from its footprint edge', () => {
      const environment = scene({ ambientIllumination: 'ORDINARY_DARKNESS', tokens: [lantern] })

      expect(sceneTokenLights(environment)).toEqual([
        expect.objectContaining({ brightRadius: 250, dimRadius: 450, position: lantern.position })
      ])
      expect(illuminationAt(290, environment)).toBe('BRIGHT')
      expect(illuminationAt(480, environment)).toBe('DIM')
      expect(illuminationAt(560, environment)).toBe('ORDINARY_DARKNESS')
    })

    it('moves with the token', () => {
      const moved = { ...lantern, position: { x: 450, y: 50 } }
      const environment = scene({ ambientIllumination: 'ORDINARY_DARKNESS', tokens: [moved] })

      expect(illuminationAt(560, environment)).toBe('BRIGHT')
      expect(illuminationAt(50, environment)).toBe('DIM')
    })

    it('is stopped by a wall like any other light', () => {
      const wall = {
        a: { x: 150, y: 0 },
        b: { x: 150, y: 100 },
        blocksLight: true,
        blocksMovement: true,
        id: crypto.randomUUID(),
        kind: 'WALL'
      } as const
      const environment = scene({
        ambientIllumination: 'ORDINARY_DARKNESS',
        barriers: [wall],
        tokens: [lantern]
      })

      expect(illuminationAt(290, environment)).toBe('ORDINARY_DARKNESS')
    })

    it('never darkens a brighter Scene, and a token without light sheds none', () => {
      expect(illuminationAt(480, scene({ tokens: [lantern] }))).toBe('BRIGHT')
      expect(sceneTokenLights(scene({ tokens: [token({ x: 50, y: 50 })] }))).toEqual([])
    })

    it('lights a creature it stands near for combat perception', () => {
      const subject = token({ x: 450, y: 50 })
      const environment = scene({
        ambientIllumination: 'ORDINARY_DARKNESS',
        tokens: [lantern, subject]
      })

      expect(resolve(token({ x: 50, y: 850 }), subject, environment).illumination).toBe('DIM')
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

  describe('sunlight at a point (D189)', () => {
    const point = { x: 50, y: 50 }
    const torch = {
      brightRadius: 100,
      color: '#ffffff',
      dimRadius: 300,
      id: crypto.randomUUID(),
      intensity: 1,
      kind: 'POINT',
      position: point
    } as const
    const darkZone = {
      id: crypto.randomUUID(),
      mechanicalIllumination: 'ORDINARY_DARKNESS',
      mechanicalObscurement: null,
      opacity: 1,
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ]
      }
    } as const
    const daylightAt = (overrides: Partial<PerceptionScene>, daylight: boolean) => {
      const environment = { ...scene(overrides), daylight }
      return resolveSceneDaylightAt(environment, point, new SceneBarrierIndex(environment.barriers))
    }

    it('is sunlight where a daylit Scene resolves BRIGHT', () => {
      expect(daylightAt({}, true)).toBe(true)
    })

    it('is not sunlight in a darkness zone of a daylit Scene', () => {
      expect(daylightAt({ darknessZones: [darkZone] }, true)).toBe(false)
    })

    it('is not sunlight where only a torch makes the square BRIGHT', () => {
      expect(daylightAt({ ambientIllumination: 'ORDINARY_DARKNESS', lights: [torch] }, false)).toBe(
        false
      )
    })

    it('is not sunlight where a daylit Scene resolves only DIM', () => {
      expect(daylightAt({ ambientIllumination: 'DIM' }, true)).toBe(false)
    })
  })
})
