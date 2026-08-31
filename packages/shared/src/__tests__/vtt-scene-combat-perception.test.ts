import { describe, expect, it } from 'vitest'

import type { CampaignSceneState, SceneToken } from '../domains/vtt/scene.js'
import {
  measureSceneTokenFootprintDistance,
  resolveSceneCombatPerceptionEnvironment
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
  it('measures range between occupied footprints rather than token centers', () => {
    const observer = token({ x: 50, y: 50 })

    expect(measureSceneTokenFootprintDistance(grid, observer, token({ x: 150, y: 50 }))).toBe(0)
    expect(measureSceneTokenFootprintDistance(grid, observer, token({ x: 250, y: 50 }))).toBe(5)
    expect(measureSceneTokenFootprintDistance(grid, observer, token({ x: 350, y: 50 }, 300))).toBe(
      5
    )
  })

  it('uses zero gap on an overlapping footprint axis', () => {
    const gridless = {
      kind: 'GRIDLESS',
      pixelsPerUnit: 10,
      unit: 'FEET'
    } as const

    expect(
      measureSceneTokenFootprintDistance(
        gridless,
        token({ x: 50, y: 50 }),
        token({ x: 100, y: 250 })
      )
    ).toBe(10)
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
