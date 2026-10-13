import { Container } from 'pixi.js'
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
  isTokenRevealed,
  isWithinTokenVisual,
  lightTintAlpha,
  dimOverlayAlpha,
  gmDarknessCapAlpha,
  illuminationOverlayAlpha,
  lightRadii,
  pointAreaOverlay,
  positionVttMapTiles,
  resolveViewTokenId,
  resolveVttMapLoadDecision,
  resolveSceneTokenMove,
  resolveVttZoomScale,
  senseEffect,
  senseReachRadius,
  sceneTokenAppearanceKey,
  shouldReloadVttMap,
  stableVttMapPartIds,
  statusCategoryColours,
  visibleGridLinePositions,
  type VttSenseReach
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

describe('VTT token press target', () => {
  it('finds the token visual from a press at any depth of it, and nothing elsewhere', () => {
    const stage = new Container()
    const tokenLayer = stage.addChild(new Container())
    const visual = tokenLayer.addChild(new Container())
    const ring = visual.addChild(new Container())
    ring.eventMode = 'static'
    const art = ring.addChild(new Container())
    art.eventMode = 'static'
    const map = stage.addChild(new Container())
    expect(isWithinTokenVisual(visual, tokenLayer)).toBe(true)
    expect(isWithinTokenVisual(ring, tokenLayer)).toBe(true)
    expect(isWithinTokenVisual(art, tokenLayer)).toBe(true)
    expect(isWithinTokenVisual(map, tokenLayer)).toBe(false)
    expect(isWithinTokenVisual(tokenLayer, tokenLayer)).toBe(false)
    expect(isWithinTokenVisual(null, tokenLayer)).toBe(false)
  })
})

describe('VTT view token and senses', () => {
  type Token = CampaignSceneStateDto['tokens'][number]
  const token = (id: string, controlledByUserIds: string[]): Token => ({
    assetId: null,
    controlledByUserIds,
    height: 70,
    hidden: false,
    id,
    label: id,
    locked: false,
    position: { x: 0, y: 0 },
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 70
  })
  const tokens = [token('mine', ['me']), token('also-mine', ['me']), token('theirs', ['them'])]
  const view = (overrides: Partial<Parameters<typeof resolveViewTokenId>[0]> = {}) =>
    resolveViewTokenId({
      assignedTokenId: null,
      boundTokenControl: new Map(),
      currentUserId: 'me',
      previewTokenId: null,
      role: 'PLAYER',
      selectedTokenId: null,
      tokens,
      ...overrides
    })

  it('gives a Player the selected token they control, else their main Character token, else none', () => {
    expect(view({ assignedTokenId: 'mine', selectedTokenId: 'also-mine' })).toBe('also-mine')
    expect(view({ assignedTokenId: 'mine', selectedTokenId: null })).toBe('mine')
    expect(view({ assignedTokenId: null, selectedTokenId: 'also-mine' })).toBe('also-mine')
    expect(view()).toBeNull()
  })

  it('never views through a selected token the Player does not control', () => {
    expect(view({ assignedTokenId: 'mine', selectedTokenId: 'theirs' })).toBe('mine')
    expect(view({ selectedTokenId: 'theirs' })).toBeNull()
  })

  it('follows actor control for a bound token and ignores a token that left the Scene', () => {
    expect(
      view({ boundTokenControl: new Map([['theirs', true]]), selectedTokenId: 'theirs' })
    ).toBe('theirs')
    expect(
      view({ boundTokenControl: new Map([['mine', false]]), selectedTokenId: 'mine' })
    ).toBeNull()
    expect(view({ assignedTokenId: 'gone' })).toBeNull()
  })

  it('gives the GM only the previewed token', () => {
    expect(view({ previewTokenId: 'theirs', role: 'OWNER', selectedTokenId: 'mine' })).toBe(
      'theirs'
    )
    expect(view({ role: 'OWNER', selectedTokenId: 'mine' })).toBeNull()
    expect(view({ previewTokenId: 'gone', role: 'OWNER' })).toBeNull()
  })

  it('never lets the GM preview token reach a Player', () => {
    expect(view({ previewTokenId: 'theirs' })).toBeNull()
    expect(view({ assignedTokenId: 'mine', previewTokenId: 'theirs' })).toBe('mine')
  })

  it('tells senses apart by channel and illumination access, never by label', () => {
    const sense = (
      channel: Parameters<typeof senseEffect>[0]['channel'],
      illuminationAccess: Parameters<typeof senseEffect>[0]['illuminationAccess']
    ) => senseEffect({ channel, illuminationAccess })
    expect(sense('VISUAL', 'ORDINARY_DARKNESS')).toBe('DARKVISION')
    expect(sense('VISUAL', 'MAGICAL_DARKNESS')).toBe('TRUESIGHT')
    expect(sense('NONVISUAL', 'IGNORE')).toBe('BLINDSIGHT')
    expect(sense('VIBRATION', 'IGNORE')).toBe('TREMORSENSE')
    expect(sense('VISUAL', 'BRIGHT_ONLY')).toBeNull()
    expect(sense('AUDITORY', 'IGNORE')).toBeNull()
  })

  it('measures a sense reach from the footprint edge in Scene units', () => {
    const square: SceneGrid = {
      cellSize: 70,
      diagonalPolicy: 'EQUAL',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    }
    expect(senseReachRadius(square, { height: 70, width: 70 }, { range: 60 })).toBe(875)
    expect(senseReachRadius(square, { height: 140, width: 140 }, { range: 10 })).toBe(210)
    expect(
      senseReachRadius(
        { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' },
        { height: 40, width: 40 },
        { range: 30 }
      )
    ).toBe(320)
  })

  describe('which tokens are seen', () => {
    const origin = { x: 0, y: 0 }
    const polygon = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: 100 },
      { x: -100, y: 100 }
    ]
    const reach = (effect: VttSenseReach['effect']): VttSenseReach => ({
      effect,
      origin,
      polygon,
      radius: 100
    })
    const seen = (
      illumination: Parameters<typeof isTokenRevealed>[0]['illumination'],
      effects: VttSenseReach['effect'][],
      point = { x: 50, y: 0 }
    ) =>
      isTokenRevealed({
        halfSize: 35,
        illumination,
        point,
        reaches: effects.map(reach)
      })

    it('shows a token in bright or dim light without any sense', () => {
      expect(seen('BRIGHT', [])).toBe(true)
      expect(seen('DIM', [])).toBe(true)
    })

    it('hides a token in darkness unless a sense reaches it', () => {
      expect(seen('ORDINARY_DARKNESS', [])).toBe(false)
      expect(seen('MAGICAL_DARKNESS', [])).toBe(false)
    })

    it('lets darkvision see ordinary darkness only, truesight and blindsight both', () => {
      expect(seen('ORDINARY_DARKNESS', ['DARKVISION'])).toBe(true)
      expect(seen('MAGICAL_DARKNESS', ['DARKVISION'])).toBe(false)
      expect(seen('MAGICAL_DARKNESS', ['TRUESIGHT'])).toBe(true)
      expect(seen('ORDINARY_DARKNESS', ['BLINDSIGHT'])).toBe(true)
      expect(seen('MAGICAL_DARKNESS', ['BLINDSIGHT'])).toBe(true)
    })

    it('reveals nothing outside the sense reach', () => {
      const far = { x: 400, y: 0 }
      expect(seen('ORDINARY_DARKNESS', ['DARKVISION', 'BLINDSIGHT', 'TRUESIGHT'], far)).toBe(false)
      expect(seen('ORDINARY_DARKNESS', ['TREMORSENSE'], far)).toBe(false)
    })

    it('lets tremorsense feel a token through walls within range, measured to its edge', () => {
      const behindWall: VttSenseReach = { effect: 'TREMORSENSE', origin, polygon: [], radius: 100 }
      const feel = (x: number) =>
        isTokenRevealed({
          halfSize: 35,
          illumination: 'ORDINARY_DARKNESS',
          point: { x, y: 0 },
          reaches: [behindWall]
        })
      expect(feel(135)).toBe(true)
      expect(feel(136)).toBe(false)
    })

    it('measures every other sense to the token centre, not its edge', () => {
      // The centre is outside the reach while the 35 px edge is inside it.
      const edgeInside = { x: 120, y: 0 }
      for (const effect of ['DARKVISION', 'TRUESIGHT', 'BLINDSIGHT'] as const) {
        expect(seen('ORDINARY_DARKNESS', [effect], edgeInside)).toBe(false)
      }
      expect(seen('ORDINARY_DARKNESS', ['TREMORSENSE'], edgeInside)).toBe(true)
    })
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

  it('colours condition, concentration and other statuses distinctly and draws an effect as other', () => {
    expect(
      new Set([
        statusCategoryColours.CONDITION,
        statusCategoryColours.CONCENTRATION,
        statusCategoryColours.OTHER
      ]).size
    ).toBe(3)
    // Pinned hues: amber conditions, teal-green Concentration, neutral grey other.
    expect(statusCategoryColours.CONDITION).toBe(0xffd43b)
    expect(statusCategoryColours.CONCENTRATION).toBe(0x20c997)
    expect(statusCategoryColours.OTHER).toBe(0xced4da)
    // Lane 1 ruling: an EFFECT stays neutral until its polarity is derived.
    expect(statusCategoryColours.EFFECT).toBe(statusCategoryColours.OTHER)
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
        senses: [],
        vision: null,
        width: 50
      }
    ],
    version: 1
  }
}
