import { describe, expect, it } from 'vitest'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { SceneBarrierIndex, type SceneGrid } from '@artificer-toolkit/shared/vtt'
import {
  buildVttFogMask,
  canPreserveSceneTokenDrag,
  clampPolygonToRadius,
  countDarknessZones,
  darknessZoneStyle,
  dashedPolygonSegments,
  describeDarknessZone,
  describeSceneLighting,
  formatSceneMeasurement,
  hasCommittedSceneTokenPositionChanged,
  interpolateScenePoint,
  lightTintAlpha,
  dimOverlayAlpha,
  gmDarknessCapAlpha,
  illuminationOverlayAlpha,
  lightRadii,
  pointAreaOverlay,
  positionVttMapTiles,
  resolveVttMapLoadDecision,
  resolveSceneTokenMove,
  resolveVttZoomScale,
  sceneTokenAppearanceKey,
  shouldReloadVttMap,
  stableVttMapPartIds,
  visibleGridLinePositions
} from './vttSceneRenderer.model'

describe('VTT scene renderer model', () => {
  it('draws a radius area as a target circle and a cube as a target square centered on the point', () => {
    expect(pointAreaOverlay({ kind: 'RADIUS', radius: 400 }, { x: 700, y: 500 })).toMatchObject({
      kind: 'CIRCLE',
      purpose: 'TARGET',
      center: { x: 700, y: 500 },
      radius: 400
    })
    expect(pointAreaOverlay({ kind: 'CUBE', edgeLength: 300 }, { x: 700, y: 500 })).toMatchObject({
      kind: 'POLYGON',
      purpose: 'TARGET',
      points: [
        { x: 550, y: 350 },
        { x: 850, y: 350 },
        { x: 850, y: 650 },
        { x: 550, y: 650 }
      ]
    })
  })

  it('resolves symmetric, bounded, and safe zoom scales', () => {
    const zoomedIn = resolveVttZoomScale(1, 1.1)

    expect(resolveVttZoomScale(zoomedIn, 1 / 1.1)).toBeCloseTo(1, 12)
    expect(resolveVttZoomScale(7.9, 2)).toBe(8)
    expect(resolveVttZoomScale(0.03, 0.1)).toBe(0.02)
    expect(resolveVttZoomScale(1, 0)).toBe(1)
    expect(resolveVttZoomScale(1, Number.NaN)).toBe(1)
    expect(resolveVttZoomScale(Number.NaN, 2)).toBe(0.04)
  })

  it('interpolates remote token previews smoothly without overshooting', () => {
    const origin = { x: 0, y: 0 }
    const target = { x: 100, y: -100 }
    const first = { ...origin }
    const oneStep = { ...origin }
    const twoSteps = { ...origin }
    interpolateScenePoint(first, target, 50)
    interpolateScenePoint(oneStep, target, 100)
    interpolateScenePoint(twoSteps, target, 50)
    interpolateScenePoint(twoSteps, target, 50)

    expect(first.x).toBeGreaterThan(0)
    expect(first.x).toBeLessThan(target.x)
    expect(first.y).toBeLessThan(0)
    expect(first.y).toBeGreaterThan(target.y)
    expect(twoSteps.x).toBeCloseTo(oneStep.x, 8)
    expect(twoSteps.y).toBeCloseTo(oneStep.y, 8)
    const converged = { ...origin }
    interpolateScenePoint(converged, target, 10_000)
    expect(converged).toEqual(target)
    const paused = { ...origin }
    interpolateScenePoint(paused, target, 0)
    interpolateScenePoint(paused, target, -20)
    expect(paused).toEqual(origin)
    const nearTarget = { x: 99.9, y: -99.9 }
    interpolateScenePoint(nearTarget, target, 1)
    expect(nearTarget).toEqual(target)
  })

  it('clears remote token previews only for that token’s committed movement or removal', () => {
    const current = movementScene()

    expect(
      hasCommittedSceneTokenPositionChanged(current, { tokens: current.tokens }, 'token')
    ).toBe(false)
    expect(
      hasCommittedSceneTokenPositionChanged(
        current,
        { ...current, tokens: [{ ...current.tokens[0]!, position: { x: 125, y: 75 } }] },
        'token'
      )
    ).toBe(true)
    expect(
      hasCommittedSceneTokenPositionChanged(current, { ...current, tokens: [] }, 'token')
    ).toBe(true)
  })

  it('clamps token movement and rejects movement through blocking barriers', () => {
    const current = movementScene()
    const token = current.tokens[0]!

    expect(resolveSceneTokenMove(current, token, token.position, { x: -50, y: 900 })).toEqual({
      x: 25,
      y: 375
    })

    const wallScene = {
      ...current,
      barriers: [
        {
          a: { x: 100, y: 0 },
          b: { x: 100, y: 400 },
          blocksLight: true,
          blocksMovement: true,
          id: 'wall',
          kind: 'WALL' as const
        }
      ]
    }
    expect(
      resolveSceneTokenMove(
        wallScene,
        token,
        token.position,
        { x: 125, y: 75 },
        new SceneBarrierIndex(wallScene.barriers)
      )
    ).toEqual(token.position)

    const doorScene = {
      ...current,
      barriers: [
        {
          a: { x: 100, y: 0 },
          b: { x: 100, y: 400 },
          blocksLightWhenClosed: true,
          blocksMovementWhenClosed: true,
          id: 'door',
          initialState: 'CLOSED' as const,
          kind: 'DOOR' as const,
          openAngleDegrees: 90
        }
      ],
      doorStates: { door: 'OPEN' as const }
    }
    expect(resolveSceneTokenMove(doorScene, token, token.position, { x: 125, y: 75 })).toEqual({
      x: 125,
      y: 75
    })
  })

  it('preserves a drag only across compatible same-scene updates', () => {
    const current = movementScene()
    const token = current.tokens[0]!
    const update = {
      boundTokenControl: new Map<string, boolean>(),
      currentUserId: 'user',
      mode: 'PLAY' as const,
      role: 'PLAYER' as const,
      scene: current,
      tool: 'SELECT'
    }
    const drag = {
      appearanceKey: sceneTokenAppearanceKey(token),
      origin: token.position,
      tokenId: token.id
    }

    expect(
      canPreserveSceneTokenDrag(
        update,
        {
          ...update,
          scene: { ...current, doorStates: { door: 'OPEN' } }
        },
        drag
      )
    ).toBe(true)
    expect(canPreserveSceneTokenDrag(update, { ...update, tool: 'PAN' }, drag)).toBe(false)
    expect(
      canPreserveSceneTokenDrag(
        update,
        {
          ...update,
          scene: {
            ...current,
            tokens: [{ ...token, position: { x: 125, y: 75 } }]
          }
        },
        drag
      )
    ).toBe(false)
    expect(
      canPreserveSceneTokenDrag(
        update,
        {
          ...update,
          scene: {
            ...current,
            tokens: [{ ...token, locked: true }]
          }
        },
        drag
      )
    ).toBe(false)
  })

  it('combines explored fog bits from private layers and draws no fog while fog is OFF', () => {
    const fogLayers = [
      {
        chunks: [{ data: 'BQ==', height: 2, index: 0, width: 2, x: 0, y: 0 }],
        height: 2,
        ownerUserId: null,
        width: 2
      },
      {
        chunks: [{ data: 'Ag==', height: 2, index: 0, width: 2, x: 0, y: 0 }],
        height: 2,
        ownerUserId: '11111111-1111-4111-8111-111111111111',
        width: 2
      }
    ]
    const mask = buildVttFogMask({ fogLayers, fogMode: 'PER_PLAYER' })

    expect(mask && [...mask.opacity]).toEqual([0, 0, 0, 224])
    expect(buildVttFogMask({ fogLayers: [], fogMode: 'SHARED_PARTY' })).toBeNull()
    expect(buildVttFogMask({ fogLayers: [], fogMode: 'SHARED_PARTY' }, true)?.opacity).toEqual(
      new Uint8ClampedArray([224])
    )
    expect(buildVttFogMask({ fogLayers, fogMode: 'OFF' }, true)).toBeNull()
    expect(buildVttFogMask({ fogLayers: [], fogMode: 'OFF' }, true)).toBeNull()
  })

  it('formats square and gridless measurement paths', () => {
    const square = {
      cellSize: 70,
      diagonalPolicy: 'ALTERNATING',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    } satisfies SceneGrid
    const gridless = {
      kind: 'GRIDLESS',
      pixelsPerUnit: 10,
      unit: 'METERS'
    } satisfies SceneGrid

    expect(
      formatSceneMeasurement(square, [
        { x: 0, y: 0 },
        { x: 140, y: 70 }
      ])
    ).toBe('10 ft')
    expect(
      formatSceneMeasurement(square, [
        { x: 0, y: 0 },
        { x: 70, y: 70 },
        { x: 140, y: 140 }
      ])
    ).toBe('15 ft')
    expect(
      formatSceneMeasurement(gridless, [
        { x: 0, y: 0 },
        { x: 30, y: 40 }
      ])
    ).toBe('5 m')
  })

  it('positions renderer tiles from their row and column dimensions', () => {
    expect(
      positionVttMapTiles({
        tiles: [
          { column: 0, height: 1024, row: 0, url: 'https://example.com/0', width: 1024 },
          { column: 1, height: 1024, row: 0, url: 'https://example.com/1', width: 976 },
          { column: 0, height: 476, row: 1, url: 'https://example.com/2', width: 1024 },
          { column: 1, height: 476, row: 1, url: 'https://example.com/3', width: 976 }
        ]
      }).map(({ column, row, x, y }) => ({ column, row, x, y }))
    ).toEqual([
      { column: 0, row: 0, x: 0, y: 0 },
      { column: 1, row: 0, x: 1024, y: 0 },
      { column: 0, row: 1, x: 0, y: 1024 },
      { column: 1, row: 1, x: 1024, y: 1024 }
    ])
  })

  it('normalizes extreme grid origins and caps tiny-cell rendering work', () => {
    const positions = visibleGridLinePositions(-1_000_000, Number.MIN_VALUE, 8192)

    expect(positions).toHaveLength(2_048)
    expect(positions[0]).toBeGreaterThanOrEqual(0)
    expect(positions.at(-1)).toBeLessThanOrEqual(8192)
  })

  it('keeps a complete map loaded when only signed credentials change', () => {
    const current = {
      assetKey: 'map:1400x900',
      credentialKey: 'first-expiry',
      layerEmpty: false,
      loadComplete: true
    }

    expect(
      shouldReloadVttMap(current, {
        assetKey: current.assetKey,
        credentialKey: 'second-expiry'
      })
    ).toBe(false)
    expect(
      shouldReloadVttMap(
        { ...current, loadComplete: false },
        { assetKey: current.assetKey, credentialKey: 'second-expiry' }
      )
    ).toBe(true)
    expect(
      shouldReloadVttMap(current, {
        assetKey: 'replacement-map:1400x900',
        credentialKey: 'second-expiry'
      })
    ).toBe(true)
  })

  it('preserves complete stable map parts through credential refreshes', () => {
    const parts = ['overview', 'tile:0:0', 'tile:0:1']

    expect(
      resolveVttMapLoadDecision({
        currentAssetKey: 'map:1400x900',
        loadedPartIds: parts,
        nextAssetKey: 'map:1400x900',
        requiredPartIds: parts
      })
    ).toBe('NONE')
  })

  it('retries only missing stable map parts and resets replacements', () => {
    const parts = stableVttMapPartIds({
      tiles: [
        { column: 0, height: 900, row: 0, url: 'https://example.com/0', width: 700 },
        { column: 1, height: 900, row: 0, url: 'https://example.com/1', width: 700 }
      ]
    })

    expect(parts).toEqual(['overview', 'tile:0:0', 'tile:0:1'])
    expect(
      resolveVttMapLoadDecision({
        currentAssetKey: 'map:1400x900',
        loadedPartIds: ['overview', 'tile:0:1'],
        nextAssetKey: 'map:1400x900',
        requiredPartIds: parts
      })
    ).toBe('LOAD_MISSING')
    expect(
      resolveVttMapLoadDecision({
        currentAssetKey: 'map:1400x900',
        loadedPartIds: parts,
        nextAssetKey: 'replacement:1400x900',
        requiredPartIds: parts
      })
    ).toBe('RESET')
  })
})

describe('VTT lighting model', () => {
  const zone = (
    mechanicalIllumination: CampaignSceneStateDto['darknessZones'][number]['mechanicalIllumination'],
    mechanicalObscurement: CampaignSceneStateDto['darknessZones'][number]['mechanicalObscurement'],
    opacity = 0.5
  ) => ({ mechanicalIllumination, mechanicalObscurement, opacity })

  it('encodes each illumination class as a distinct overlay alpha, bright clearest', () => {
    expect(illuminationOverlayAlpha('BRIGHT')).toBe(0)
    expect(illuminationOverlayAlpha('DIM')).toBe(dimOverlayAlpha)
    expect(dimOverlayAlpha).toBeGreaterThan(0)
    expect(illuminationOverlayAlpha('ORDINARY_DARKNESS')).toBe(1)
    expect(illuminationOverlayAlpha('MAGICAL_DARKNESS')).toBe(1)
    expect(gmDarknessCapAlpha).toBeGreaterThan(dimOverlayAlpha)
    expect(gmDarknessCapAlpha).toBeLessThan(1)
  })

  it('tints a light faintly, stronger for a more intense light', () => {
    expect(lightTintAlpha({ intensity: 0.9 })).toBeGreaterThan(lightTintAlpha({ intensity: 0.3 }))
    expect(lightTintAlpha({ intensity: 5 })).toBeLessThanOrEqual(0.2)
    expect(lightTintAlpha({ intensity: 0 })).toBeGreaterThan(0)
  })

  it('never lets the bright radius exceed the dim reach', () => {
    expect(lightRadii({ brightRadius: 100, dimRadius: 250 })).toEqual({ bright: 100, dim: 250 })
    expect(lightRadii({ brightRadius: 300, dimRadius: 200 })).toEqual({ bright: 300, dim: 300 })
  })

  it('clamps a visibility polygon radially without moving points already inside the radius', () => {
    const origin = { x: 100, y: 100 }
    const clamped = clampPolygonToRadius(
      [origin, { x: 140, y: 100 }, { x: 100, y: 500 }, { x: -200, y: 100 }],
      origin,
      100
    )
    expect(clamped[0]).toEqual(origin)
    expect(clamped[1]).toEqual({ x: 140, y: 100 })
    expect(clamped[2]).toEqual({ x: 100, y: 200 })
    expect(clamped[3]).toEqual({ x: 0, y: 100 })
  })

  it('gives magical darkness a dotted arcane outline and each obscurement a non-colour outline', () => {
    const magical = darknessZoneStyle(zone('MAGICAL_DARKNESS', null))
    const ordinary = darknessZoneStyle(zone('ORDINARY_DARKNESS', null))
    expect(magical.illuminationOutline).not.toBeNull()
    expect(ordinary.illuminationOutline).toBeNull()

    const lightObscured = darknessZoneStyle(zone(null, 'LIGHT')).obscurementOutline
    const heavyObscured = darknessZoneStyle(zone(null, 'HEAVY')).obscurementOutline
    expect(lightObscured?.dash).not.toBeNull()
    expect(heavyObscured?.dash).toBeNull()
    expect(darknessZoneStyle(zone(null, null)).obscurementOutline).toBeNull()
  })

  it('walks a dashed outline around a closed polygon with the pattern continuing across corners', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ]
    const segments = dashedPolygonSegments(square, 5, 5)
    expect(segments).toHaveLength(8)
    expect(segments[0]).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 }
    ])
    const dashedLength = segments.reduce(
      (total, [from, to]) => total + Math.hypot(to.x - from.x, to.y - from.y),
      0
    )
    expect(dashedLength).toBeCloseTo(40)
  })

  it('describes darkness in words that do not depend on colour', () => {
    expect(describeDarknessZone(zone('MAGICAL_DARKNESS', 'HEAVY'))).toBe(
      'Magical darkness, heavily obscured'
    )
    expect(describeDarknessZone(zone('DIM', null))).toBe('Dim light')
    expect(describeDarknessZone(zone(null, 'LIGHT'))).toBe('Lightly obscured')
    expect(describeDarknessZone(zone(null, null))).toBe('Visual darkness')
  })

  it('summarizes the lighting only when it departs from bright light', () => {
    expect(
      describeSceneLighting({ ambientIllumination: 'BRIGHT', darknessZones: [] }, [])
    ).toBeNull()
    const summary = describeSceneLighting(
      {
        ambientIllumination: 'DIM',
        darknessZones: [
          {
            id: 'zone',
            ...zone('MAGICAL_DARKNESS', 'HEAVY'),
            polygon: { points: [] }
          }
        ]
      },
      ['Ember']
    )
    expect(summary).toContain('Ambient: Dim light')
    expect(summary).toContain('Magical darkness, heavily obscured')
    expect(summary).toContain('Vision: Ember')
  })

  it('counts zones by illumination and obscurement', () => {
    expect(
      countDarknessZones([
        zone('MAGICAL_DARKNESS', 'HEAVY'),
        zone('ORDINARY_DARKNESS', 'LIGHT'),
        zone('DIM', null),
        zone(null, null)
      ])
    ).toEqual({
      dim: 1,
      heavyObscured: 1,
      lightObscured: 1,
      magical: 1,
      ordinary: 1,
      unspecified: 1
    })
  })
})

function movementScene(): CampaignSceneStateDto {
  return {
    annotations: [],
    ambientIllumination: 'BRIGHT',
    barriers: [],
    campaignId: 'campaign',
    darknessZones: [],
    definitionId: 'definition',
    definitionVersion: 1,
    doorStates: {},
    fogLayers: [],
    fogMode: 'SHARED_PARTY',
    visionRevealMode: 'ON_DROP',
    grid: {
      cellSize: 50,
      diagonalPolicy: 'ALTERNATING',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    id: 'scene',
    lights: [],
    map: { assetId: 'map', height: 400, tileManifestAssetId: null, width: 600 },
    measurements: [],
    name: 'Movement scene',
    tokens: [
      {
        assetId: null,
        controlledByUserIds: ['user'],
        height: 50,
        hidden: false,
        id: 'token',
        label: 'Ember',
        locked: false,
        position: { x: 75, y: 75 },
        rotationDegrees: 0,
        vision: null,
        width: 50
      }
    ],
    version: 1
  }
}
