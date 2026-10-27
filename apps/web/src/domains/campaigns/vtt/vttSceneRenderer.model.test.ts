import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import {
  campaignSceneStateDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { combatPerceptionCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  requireSceneIlluminationLevel,
  SceneBarrierIndex,
  sceneDistanceAsCoordinateLength,
  scenePointInPolygon,
  sceneRangeBand,
  sceneRangeOutline,
  spatialTokensInsideArea,
  type SceneGrid,
  type SceneIlluminationLevel,
  type ScenePoint,
  type SpatialDirectedAreaSize
} from '@artificer-toolkit/shared/vtt'
import { tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import {
  actionPreviewOverlays,
  aimedAreaShape,
  areaBandOverlay,
  areaOverlay,
  buildVttFogMask,
  canPreserveSceneTokenDrag,
  clampPolygonToRadius,
  darknessZoneStyle,
  dashedPolygonSegments,
  directedAreaAim,
  drawnAreaAim,
  describeDarknessZone,
  describeSceneLighting,
  formatSceneMeasurement,
  formatSceneRoute,
  hasCommittedSceneTokenPositionChanged,
  interpolateScenePoint,
  isTokenRevealed,
  isWithinTokenVisual,
  lightTintAlpha,
  dimOverlayAlpha,
  gmDarknessCapAlpha,
  illuminationOverlayAlpha,
  lightRadii,
  positionVttMapTiles,
  resolveViewTokenId,
  resolveVttMapLoadDecision,
  resolveSceneTokenMove,
  minimumFocusedTokenScreenSize,
  resolveVttTokenFocusScale,
  resolveVttZoomScale,
  sceneIlluminationAreas,
  senseEffect,
  senseReachRadius,
  sceneTokenAppearanceKey,
  shouldReloadVttMap,
  stableVttMapPartIds,
  stageOverlays,
  statusCategoryColours,
  visibleGridLinePositions,
  wholeMapPolygon,
  type VttActionPreview,
  type VttSenseReach
} from './vttSceneRenderer.model'
import { countDarknessZones } from './vttDarknessZoneCounts.testUtils'
import { validated } from '../../../test/validatedFixture'

type IlluminationCode = CampaignSceneStateDto['ambientIllumination']

const { illuminationLevels } = combatPerceptionCapabilityRegistry.require(SRD_SYSTEM_ID)
const level = (code: IlluminationCode) => requireSceneIlluminationLevel(illuminationLevels, code)

describe('VTT scene renderer model', () => {
  it('draws a radius area as a target circle and a cube as a target square centered on the point', () => {
    const aim = { origin: { x: 700, y: 500 }, toward: null }
    expect(areaOverlay({ kind: 'RADIUS', radius: 400 }, aim, null)).toMatchObject({
      kind: 'CIRCLE',
      purpose: 'TARGET',
      center: { x: 700, y: 500 },
      radius: 400
    })
    expect(areaOverlay({ kind: 'CUBE', edgeLength: 300 }, aim, null)).toMatchObject({
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

  describe('directed areas', () => {
    const grid = tabletopLiveScene.grid
    const cell = grid.cellSize
    const caster = { id: 'caster', position: { x: 500, y: 500 }, width: cell, height: cell }
    const sizes: SpatialDirectedAreaSize[] = [
      { kind: 'CONE', length: 3 * cell },
      // The longest cone an SRD spell has: 60 feet.
      { kind: 'CONE', length: sceneDistanceAsCoordinateLength(grid, 60) },
      { kind: 'LINE', length: 6 * cell, width: cell },
      {
        kind: 'CUBE_FROM_SIDE',
        edgeLength: 3 * cell,
        cellSize: cell,
        gridOrigin: grid.kind === 'SQUARE' ? grid.origin : { x: 0, y: 0 }
      }
    ]
    const [cone, longCone, line, cube] = sizes as [
      SpatialDirectedAreaSize,
      SpatialDirectedAreaSize,
      SpatialDirectedAreaSize,
      SpatialDirectedAreaSize
    ]
    /** The caster and a token on every square within thirteen of it. */
    const tokens = Array.from({ length: 27 }, (_, row) =>
      Array.from({ length: 27 }, (_, column) => ({
        id: `${column - 13},${row - 13}`,
        position: {
          x: caster.position.x + (column - 13) * cell,
          y: caster.position.y + (row - 13) * cell
        },
        width: cell,
        height: cell
      }))
    )
      .flat()
      .map((token) => (token.id === '0,0' ? caster : token))

    /** The area of the part of `subject` inside the convex `clip` (Sutherland-Hodgman). */
    function overlapArea(subject: ScenePoint[], clip: ScenePoint[]): number {
      const turn = (a: ScenePoint, b: ScenePoint, p: ScenePoint) =>
        (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
      const area = (polygon: ScenePoint[]) =>
        polygon.reduce((sum, point, index) => {
          const next = polygon[(index + 1) % polygon.length]!
          return sum + (point.x * next.y - next.x * point.y) / 2
        }, 0)
      const side = Math.sign(area(clip))
      let clipped = subject
      clip.forEach((a, index) => {
        const b = clip[(index + 1) % clip.length]!
        const input = clipped
        clipped = []
        input.forEach((current, at) => {
          const previous = input[(at + input.length - 1) % input.length]!
          const inside = (p: ScenePoint) => turn(a, b, p) * side >= 0
          if (inside(current) !== inside(previous)) {
            const [u, v] = [turn(a, b, previous), turn(a, b, current)]
            const ratio = u / (u - v)
            clipped.push({
              x: previous.x + (current.x - previous.x) * ratio,
              y: previous.y + (current.y - previous.y) * ratio
            })
          }
          if (inside(current)) clipped.push(current)
        })
      })
      return clipped.length < 3 ? 0 : Math.abs(area(clipped))
    }
    const square = (token: (typeof tokens)[number]): ScenePoint[] => [
      { x: token.position.x - cell / 2, y: token.position.y - cell / 2 },
      { x: token.position.x + cell / 2, y: token.position.y - cell / 2 },
      { x: token.position.x + cell / 2, y: token.position.y + cell / 2 },
      { x: token.position.x - cell / 2, y: token.position.y + cell / 2 }
    ]

    it('draws nothing for a directed area without a direction or a caster', () => {
      const origin = { x: 535, y: 500 }
      expect(areaOverlay(cone, { origin, toward: origin }, caster)).toBeNull()
      expect(areaOverlay(cone, { origin, toward: null }, caster)).toBeNull()
      expect(areaOverlay(cone, { origin, toward: { x: 900, y: 500 } }, null)).toBeNull()
    })

    it('starts on the caster’s edge nearest the pointer and extends toward it', () => {
      const pointer = { x: 900, y: 520 }
      expect(directedAreaAim({ caster, pointer, pressedAt: null, size: cone })).toEqual({
        origin: { x: 535, y: 520 },
        toward: pointer
      })
    })

    it('keeps the origin where the press began while the pointer moves', () => {
      const pointer = { x: 700, y: 200 }
      expect(
        directedAreaAim({ caster, pointer, pressedAt: { x: 600, y: 520 }, size: line })
      ).toEqual({ origin: { x: 535, y: 520 }, toward: pointer })
    })

    it('aims nothing the rules would refuse: into the caster’s space, along its edge, or off a cube’s side', () => {
      expect(
        directedAreaAim({ caster, pointer: { x: 510, y: 500 }, pressedAt: null, size: cone })
      ).toBeNull()
      const eastEdge = { x: 535, y: 500 }
      expect(
        directedAreaAim({ caster, pointer: { x: 535, y: 100 }, pressedAt: eastEdge, size: cone })
      ).toBeNull()
      expect(
        directedAreaAim({ caster, pointer: { x: 700, y: 100 }, pressedAt: eastEdge, size: cube })
      ).toBeNull()
    })

    it('catches exactly the tokens the drawn area overlaps, for every aim around the caster', () => {
      let aimed = 0
      for (const size of sizes) {
        for (let angle = 0; angle < 360; angle += 15) {
          for (const distance of [60, 150, 300]) {
            const pointer = {
              x: caster.position.x + distance * Math.cos((angle * Math.PI) / 180),
              y: caster.position.y + distance * Math.sin((angle * Math.PI) / 180)
            }
            const aim = directedAreaAim({ caster, pointer, pressedAt: null, size })
            // Outside the caster's space there is always somewhere to start from.
            expect(aim).not.toBeNull()
            if (!aim) continue
            aimed += 1
            const overlay = areaOverlay(size, aim, caster)
            expect(overlay).toMatchObject({ kind: 'POLYGON', purpose: 'TARGET' })
            if (overlay?.kind !== 'POLYGON') continue
            const caught = new Set(
              spatialTokensInsideArea({
                origin: aim.origin,
                shape: aimedAreaShape(size, aim)!,
                tokens,
                casterTokenId: caster.id
              })
            )
            // The caster's own space is never in an area drawn from its edge.
            expect(caught.has(caster.id)).toBe(false)
            const overlapped = tokens
              .filter((token) => token.id !== caster.id)
              .filter((token) => overlapArea(square(token), overlay.points) > 1e-6)
              .map((token) => token.id)
            expect([...caught].sort()).toEqual(overlapped.sort())
          }
        }
      }
      expect(aimed).toBe(sizes.length * 24 * 3)
    })

    it('catches the squares a diagonal 60-foot cone covers', () => {
      const aim = directedAreaAim({
        caster,
        pointer: { x: caster.position.x + 400, y: caster.position.y + 400 },
        pressedAt: null,
        size: longCone
      })!
      const caught = spatialTokensInsideArea({
        origin: aim.origin,
        shape: aimedAreaShape(longCone, aim)!,
        tokens,
        casterTokenId: caster.id
      })
      // From the caster's corner the cone runs 840 along the diagonal: squares on that axis are
      // caught out to its end, those behind the corner or beside the cone are not.
      expect(caught).toContain('8,8')
      expect(caught).not.toContain('10,10')
      expect(caught).toContain('1,1')
      expect(caught).not.toContain('0,0')
      expect(caught).not.toContain('-3,3')
      expect(caught).not.toContain('13,0')
    })
  })

  describe('action preview overlays', () => {
    const [source, target] = tabletopLiveScene.tokens
    if (!source || !target) throw new Error('The fixture Scene needs two Tokens.')
    // The fixture Scene is a square grid of 70-pixel cells worth 5 feet each.
    const feet = (amount: number) => ({ amount, unit: 'FEET' as const })
    const preview = (
      range: VttActionPreview['range'],
      targetTokenId: string | null = null
    ): VttActionPreview => ({ range, sourceTokenId: source.id, targetTokenId })

    const sceneWith = (...positions: { x: number; y: number }[]) => ({
      ...tabletopLiveScene,
      tokens: [source, ...positions.map((position) => ({ ...target, position }))]
    })
    const outlineOf = (
      scene: Pick<CampaignSceneStateDto, 'grid'>,
      distance: ReturnType<typeof feet>
    ) => sceneRangeOutline(scene.grid, source, distance)

    it('outlines the region a ranged attack reaches, for its normal and long range', () => {
      expect(
        actionPreviewOverlays(
          preview({ kind: 'RANGED', normal: feet(80), long: feet(320) }),
          tabletopLiveScene
        )
      ).toMatchObject([
        {
          kind: 'POLYGON',
          label: 'Action range',
          points: outlineOf(tabletopLiveScene, feet(80)),
          purpose: 'RANGE'
        },
        {
          kind: 'POLYGON',
          label: 'Action long range',
          points: outlineOf(tabletopLiveScene, feet(320)),
          purpose: 'RANGE'
        }
      ])
    })

    it('outlines a reach or touch action once, from the footprint edge', () => {
      const overlays = actionPreviewOverlays(
        preview({ kind: 'WITHIN', distance: feet(5) }),
        tabletopLiveScene
      )
      expect(overlays).toMatchObject([
        { kind: 'POLYGON', points: outlineOf(tabletopLiveScene, feet(5)), purpose: 'RANGE' }
      ])
      // A Large source covers cells 3-4 across and down; a circle of one cell from its center
      // would stop short of the square next to it.
      const large = { ...source, height: 140, position: { x: 280, y: 280 }, width: 140 }
      const [outline] = actionPreviewOverlays(
        { ...preview({ kind: 'WITHIN', distance: feet(5) }), sourceTokenId: large.id },
        { ...tabletopLiveScene, tokens: [large] }
      )
      const adjacent = { x: 385, y: 245 }
      expect(
        outline?.kind === 'POLYGON' && scenePointInPolygon(adjacent, { points: outline.points })
      ).toBe(true)
    })

    it('draws no range for a self or unlimited action, or one without a range', () => {
      for (const range of [{ kind: 'SELF' as const }, { kind: 'UNLIMITED' as const }, undefined])
        expect(actionPreviewOverlays(preview(range), tabletopLiveScene)).toEqual([])
    })

    it('draws no range around a token that left the Scene or for a range that scales', () => {
      expect(
        actionPreviewOverlays(
          { ...preview({ kind: 'WITHIN', distance: feet(5) }), sourceTokenId: 'gone' },
          tabletopLiveScene
        )
      ).toEqual([])
      expect(
        actionPreviewOverlays(
          preview({
            kind: 'WITHIN',
            distance: {
              ...feet(5),
              scaling: {
                scalingKind: 'BREAKPOINTS',
                scalingSource: 'CHARACTER_LEVEL',
                breakpoints: []
              }
            }
          }),
          tabletopLiveScene
        )
      ).toEqual([])
    })

    it('rings the chosen target, around its footprint', () => {
      const overlays = actionPreviewOverlays(
        preview({ kind: 'WITHIN', distance: feet(5) }, target.id),
        tabletopLiveScene
      )
      expect(overlays).toHaveLength(2)
      expect(overlays[1]).toMatchObject({
        kind: 'CIRCLE',
        purpose: 'TARGET',
        center: target.position
      })
      expect((overlays[1] as { radius: number }).radius).toBeGreaterThan(
        Math.max(target.width, target.height) / 2
      )
    })

    it('tells the ring whether the target is in range, in long range or out of range', () => {
      const range = { kind: 'RANGED' as const, normal: feet(30), long: feet(120) }
      // The Scene counts 5 feet a cell and 30 feet is six cells; the source stands on one row.
      const cases = [
        { band: 'NORMAL', label: 'Target in range', cellsAway: 6 },
        { band: 'LONG', label: 'Target in long range', cellsAway: 7 },
        { band: 'OUT', label: 'Target out of range', cellsAway: 25 }
      ] as const
      const colors = new Set<number>()
      for (const { band, cellsAway, label } of cases) {
        const position = { x: source.position.x + cellsAway * 70, y: source.position.y }
        const scene = sceneWith(position)
        const moved = scene.tokens[1]
        if (!moved) throw new Error('The Scene lost its target Token.')
        expect(sceneRangeBand(scene.grid, source, moved, range)).toBe(band)
        const ring = actionPreviewOverlays(preview(range, moved.id), scene).at(-1)
        expect(ring).toMatchObject({ kind: 'CIRCLE', label, purpose: 'TARGET' })
        colors.add(ring?.color ?? -1)
      }
      expect(colors.size).toBe(3)
    })

    it('rings a target without judging its range when the action has none to measure', () => {
      for (const range of [{ kind: 'SELF' as const }, { kind: 'UNLIMITED' as const }])
        expect(
          actionPreviewOverlays(preview(range, target.id), tabletopLiveScene).at(-1)
        ).toMatchObject({ label: 'Action target', purpose: 'TARGET' })
    })

    it('rebuilds the range outlines only when the acting token, the grid or the range changes', () => {
      const range = { kind: 'RANGED' as const, normal: feet(30), long: feet(120) }
      const overlaysFor = (scene: ReturnType<typeof sceneWith>, rangeToDraw = range) =>
        actionPreviewOverlays(preview(rangeToDraw, target.id), scene)
      const first = overlaysFor(sceneWith(target.position))
      const targetMoved = overlaysFor(
        sceneWith({ x: target.position.x + 70, y: target.position.y })
      )
      const refetched = overlaysFor(structuredClone(sceneWith(target.position)))
      for (const next of [targetMoved, refetched]) {
        expect(next[0]).toBe(first[0])
        expect(next[1]).toBe(first[1])
      }
      const sourceMoved = overlaysFor({
        ...sceneWith(target.position),
        tokens: [
          { ...source, position: { x: source.position.x + 70, y: source.position.y } },
          { ...target }
        ]
      })
      expect(sourceMoved[0]).not.toBe(first[0])
      expect(overlaysFor(sceneWith(target.position), { ...range, normal: feet(35) })[0]).not.toBe(
        first[0]
      )
    })

    it('draws nothing without a preview', () => {
      expect(actionPreviewOverlays(null, tabletopLiveScene)).toEqual([])
    })

    describe('on the stage', () => {
      const ranged = preview({ kind: 'WITHIN', distance: feet(5) }, target.id)
      const stage = {
        actionPreview: ranged,
        aimingArea: false,
        areaAim: null,
        areaSize: null,
        drawerOpened: true,
        scene: tabletopLiveScene
      }

      it('shows the preview while the drawer is open and removes it when the drawer closes', () => {
        expect(stageOverlays(stage)).toEqual(actionPreviewOverlays(ranged, tabletopLiveScene))
        expect(stageOverlays({ ...stage, drawerOpened: false })).toBeUndefined()
        expect(stageOverlays({ ...stage, actionPreview: null })).toBeUndefined()
      })

      it('adds the picked area, and keeps the preview but not the area while aiming it', () => {
        const area = {
          areaAim: { origin: { x: 400, y: 300 }, toward: null },
          areaSize: { kind: 'RADIUS' as const, radius: 100 }
        }
        const picked = areaOverlay(area.areaSize, area.areaAim, null)
        const previewOnly = actionPreviewOverlays(ranged, tabletopLiveScene)
        expect(stageOverlays({ ...stage, ...area })).toEqual([...previewOnly, picked])
        expect(stageOverlays({ ...stage, ...area, aimingArea: true })).toEqual(previewOnly)
        expect(stageOverlays({ ...stage, ...area, drawerOpened: false })).toEqual([picked])
      })

      it('draws a picked directed area from the token the action is previewed for', () => {
        const size = { kind: 'CONE' as const, length: 210 }
        const areaAim = {
          origin: { x: source.position.x + source.width / 2, y: source.position.y },
          toward: { x: source.position.x + 500, y: source.position.y }
        }
        const overlays = stageOverlays({ ...stage, areaAim, areaSize: size })
        expect(overlays).toEqual([
          ...actionPreviewOverlays(ranged, tabletopLiveScene),
          areaOverlay(size, areaAim, source)
        ])
        expect(areaOverlay(size, areaAim, source)).not.toBeNull()
      })
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

  it('focuses a token at a readable zoom, never zooming out and staying within the zoom bounds', () => {
    const footprint = { height: 70, width: 140 }
    const readable = minimumFocusedTokenScreenSize / 140

    expect(resolveVttTokenFocusScale(0.02, footprint)).toBeCloseTo(readable, 12)
    expect(resolveVttTokenFocusScale(1, footprint)).toBe(1)
    expect(resolveVttTokenFocusScale(readable, footprint)).toBeCloseTo(readable, 12)
    expect(resolveVttTokenFocusScale(0.02, { height: 1, width: 1 })).toBe(8)
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
      hasCommittedSceneTokenPositionChanged(current, { tokens: current.tokens }, movementTokenId)
    ).toBe(false)
    expect(
      hasCommittedSceneTokenPositionChanged(
        current,
        { ...current, tokens: [{ ...current.tokens[0]!, position: { x: 125, y: 75 } }] },
        movementTokenId
      )
    ).toBe(true)
    expect(
      hasCommittedSceneTokenPositionChanged(current, { ...current, tokens: [] }, movementTokenId)
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
      currentUserId: movementUserId,
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

  describe('a dragged route’s movement cost (SPELLS-20 T4d)', () => {
    const [ember] = tabletopLiveScene.tokens
    const mover = { ...ember!, id: 'mover', position: { x: 315, y: 315 } }
    const caster = { ...ember!, id: 'caster', position: { x: 595, y: 315 } }
    const scene = { ...tabletopLiveScene, barriers: [], tokens: [mover, caster] }
    // Four 70 px cells east, all inside both zones below.
    const path = [mover.position, { x: 595, y: 315 }]
    const zone = {
      id: 'zone',
      multiplier: 2,
      anchorKind: 'FIXED' as const,
      geometry: {
        frame: 'SCENE_ABSOLUTE' as const,
        shape: { kind: 'CIRCLE' as const, center: { x: 455, y: 315 }, radius: 600 }
      },
      sourceTokenId: null,
      unaffectedActorIds: []
    }
    const aura = (sourceTokenId: string) => ({
      ...zone,
      anchorKind: 'TOKEN' as const,
      geometry: {
        frame: 'TOKEN_LOCAL' as const,
        shape: { kind: 'CIRCLE' as const, center: { x: 0, y: 0 }, radius: 600 }
      },
      sourceTokenId
    })
    const route = (zones: NonNullable<Parameters<typeof formatSceneRoute>[2]>['zones']) =>
      formatSceneRoute(scene, path, {
        actorId: 'wolf',
        tokenId: mover.id,
        zones,
        dragDoublesCost: false
      })

    it('shows the cost a zone that slows the mover adds, as the room charges it', () => {
      expect(route([zone])).toBe('20 ft · costs 40 ft')
      expect(route([aura(caster.id)])).toBe('20 ft · costs 40 ft')
    })

    it('shows the distance alone when no zone slows the mover', () => {
      expect(route([{ ...zone, unaffectedActorIds: ['wolf'] }])).toBe('20 ft')
      expect(route([aura(mover.id)])).toBe('20 ft')
      expect(route([])).toBe('20 ft')
      expect(formatSceneRoute(scene, path, null)).toBe('20 ft')
    })

    it('names, on the GM’s route, who has not noticed each concealed zone it enters (MOVE-3.6)', () => {
      const unnoticed = (shape: typeof zone.geometry.shape, label: string | null) => ({
        label,
        shape,
        by: ['Wolf', 'Ember']
      })
      const elsewhere = {
        kind: 'CIRCLE' as const,
        center: { x: 2000, y: 2000 },
        radius: 50
      }
      const gmRoute = (unnoticedZones: ReturnType<typeof unnoticed>[]) =>
        formatSceneRoute(scene, path, {
          actorId: 'wolf',
          tokenId: mover.id,
          zones: [],
          dragDoublesCost: false,
          unnoticedZones
        })
      expect(gmRoute([unnoticed(zone.geometry.shape, 'Pit')])).toBe(
        '20 ft · Pit not noticed by Wolf, Ember'
      )
      expect(gmRoute([unnoticed(zone.geometry.shape, null)])).toBe(
        '20 ft · Hidden zone not noticed by Wolf, Ember'
      )
      expect(gmRoute([unnoticed(elsewhere, 'Pit')])).toBe('20 ft')
    })

    it('doubles the cost of a drag, on top of difficult terrain (D105)', () => {
      const dragging = { actorId: 'wolf', tokenId: mover.id, zones: [], dragDoublesCost: true }
      expect(formatSceneRoute(scene, path, dragging)).toBe('20 ft · costs 40 ft')
      const rough = {
        ...scene,
        barriers: [
          {
            id: 'rough',
            kind: 'TERRAIN' as const,
            a: { x: 455, y: 245 },
            b: { x: 455, y: 385 },
            movementCostMultiplier: 2
          }
        ]
      }
      expect(formatSceneRoute(rough, path, { ...dragging, dragDoublesCost: false })).toBe(
        '20 ft · costs 40 ft'
      )
      expect(formatSceneRoute(rough, path, dragging)).toBe('20 ft · costs 80 ft')
    })
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
    ) => senseEffect({ channel, illuminationAccess }, illuminationLevels)
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
    expect(
      senseReachRadius(
        square,
        { height: 70, width: 70 },
        { range: { rangeKind: 'DISTANCE', amount: 60 } }
      )
    ).toBe(875)
    expect(
      senseReachRadius(
        square,
        { height: 140, width: 140 },
        { range: { rangeKind: 'DISTANCE', amount: 10 } }
      )
    ).toBe(210)
    expect(
      senseReachRadius(
        { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' },
        { height: 40, width: 40 },
        { range: { rangeKind: 'DISTANCE', amount: 30 } }
      )
    ).toBe(320)
  })

  it('lets an unlimited sense reach the whole line of sight and any token in it', () => {
    const origin = { x: 0, y: 0 }
    const lineOfSight = [
      { x: 5_000, y: 0 },
      { x: 0, y: 5_000 },
      { x: -5_000, y: 0 }
    ]
    const radius = senseReachRadius(
      { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' },
      { height: 40, width: 40 },
      { range: { rangeKind: 'UNLIMITED' } }
    )
    const polygon = clampPolygonToRadius(lineOfSight, origin, radius)

    expect(polygon).toEqual(lineOfSight)
    expect(
      isTokenRevealed({
        halfSize: 35,
        illumination: level('ORDINARY_DARKNESS'),
        illuminationLevels,
        point: { x: 1_000, y: 1_000 },
        reaches: [
          { access: level('ORDINARY_DARKNESS'), effect: 'DARKVISION', origin, polygon, radius }
        ]
      })
    ).toBe(true)
  })

  describe('which tokens are seen', () => {
    const origin = { x: 0, y: 0 }
    // Open-space line of sight clamped to the 100 px radius, as a sense reach carries it.
    const polygon = Array.from({ length: 8 }, (_, step) => ({
      x: 100 * Math.cos((step * Math.PI) / 4),
      y: 100 * Math.sin((step * Math.PI) / 4)
    }))
    // The D&D darkness each sight sense reaches into.
    const sightInto = { DARKVISION: 'ORDINARY_DARKNESS', TRUESIGHT: 'MAGICAL_DARKNESS' } as const
    const reach = (effect: VttSenseReach['effect']): VttSenseReach => ({
      access: effect === 'DARKVISION' || effect === 'TRUESIGHT' ? level(sightInto[effect]) : null,
      effect,
      origin,
      polygon,
      radius: 100
    })
    const seen = (
      illumination: IlluminationCode,
      effects: VttSenseReach['effect'][],
      point = { x: 50, y: 0 }
    ) =>
      isTokenRevealed({
        halfSize: 35,
        illumination: level(illumination),
        illuminationLevels,
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
      const behindWall: VttSenseReach = {
        access: null,
        effect: 'TREMORSENSE',
        origin,
        polygon: [],
        radius: 100
      }
      const feel = (x: number) =>
        isTokenRevealed({
          halfSize: 35,
          illumination: level('ORDINARY_DARKNESS'),
          illuminationLevels,
          point: { x, y: 0 },
          reaches: [behindWall]
        })
      expect(feel(135)).toBe(true)
      expect(feel(136)).toBe(false)
    })

    it('measures every other sense to the token centre, not its edge', () => {
      // Each centre is beyond the 100 px reach (110 and 113 px) while its 35 px edge is inside it.
      for (const edgeInside of [
        { x: 110, y: 0 },
        { x: 80, y: 80 }
      ]) {
        for (const effect of ['DARKVISION', 'TRUESIGHT', 'BLINDSIGHT'] as const) {
          expect(seen('ORDINARY_DARKNESS', [effect], edgeInside)).toBe(false)
        }
        expect(seen('ORDINARY_DARKNESS', ['TREMORSENSE'], edgeInside)).toBe(true)
      }
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
    const alpha = (code: IlluminationCode) => illuminationOverlayAlpha(level(code).renderClass)
    expect(alpha('BRIGHT')).toBe(0)
    expect(alpha('DIM')).toBe(dimOverlayAlpha)
    expect(dimOverlayAlpha).toBeGreaterThan(0)
    expect(alpha('ORDINARY_DARKNESS')).toBe(1)
    expect(alpha('MAGICAL_DARKNESS')).toBe(1)
    expect(gmDarknessCapAlpha).toBeGreaterThan(dimOverlayAlpha)
    expect(gmDarknessCapAlpha).toBeLessThan(1)
  })

  it('lists the ambient level over the whole map, then each zone that sets a level', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ]
    const areas = sceneIlluminationAreas(
      {
        ambientIllumination: 'DIM',
        darknessZones: [
          { ...zone('MAGICAL_DARKNESS', null), id: 'magic', polygon: { points: square } },
          { ...zone(null, 'HEAVY'), id: 'fog', polygon: { points: square } }
        ],
        map: { ...tabletopLiveScene.map, height: 200, width: 300 }
      },
      illuminationLevels
    )
    expect(areas).toEqual([
      { level: level('DIM'), points: wholeMapPolygon({ height: 200, width: 300 }), zone: false },
      { level: level('MAGICAL_DARKNESS'), points: square, zone: true }
    ])
    expect(areas[0]?.points).toContainEqual({ x: 300, y: 200 })
  })

  it('tints a light faintly, stronger for a more intense light', () => {
    expect(lightTintAlpha({ intensity: 0.9 })).toBeGreaterThan(lightTintAlpha({ intensity: 0.3 }))
    expect(lightTintAlpha({ intensity: 5 })).toBeLessThanOrEqual(0.2)
    expect(lightTintAlpha({ intensity: 0 })).toBeGreaterThan(0)
  })

  it('colours harmful, beneficial, concentration and other statuses distinctly', () => {
    expect(
      new Set([
        statusCategoryColours.HARMFUL,
        statusCategoryColours.BENEFICIAL,
        statusCategoryColours.CONCENTRATION,
        statusCategoryColours.OTHER
      ]).size
    ).toBe(4)
    // Pinned hues: amber harm, lime benefit, teal-green Concentration, neutral grey other.
    expect(statusCategoryColours.HARMFUL).toBe(0xffd43b)
    expect(statusCategoryColours.BENEFICIAL).toBe(0x94d82d)
    expect(statusCategoryColours.CONCENTRATION).toBe(0x20c997)
    expect(statusCategoryColours.OTHER).toBe(0xced4da)
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
    const style = (...args: Parameters<typeof zone>) =>
      darknessZoneStyle(zone(...args), illuminationLevels)
    const magical = style('MAGICAL_DARKNESS', null)
    const ordinary = style('ORDINARY_DARKNESS', null)
    expect(magical.illuminationOutline).not.toBeNull()
    expect(ordinary.illuminationOutline).toBeNull()

    const lightObscured = style(null, 'LIGHT').obscurementOutline
    const heavyObscured = style(null, 'HEAVY').obscurementOutline
    expect(lightObscured?.dash).not.toBeNull()
    expect(heavyObscured?.dash).toBeNull()
    expect(style(null, null).obscurementOutline).toBeNull()
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
    const words = (...args: Parameters<typeof zone>) =>
      describeDarknessZone(zone(...args), illuminationLevels)
    expect(words('MAGICAL_DARKNESS', 'HEAVY')).toBe('Magical darkness, heavily obscured')
    expect(words('DIM', null)).toBe('Dim light')
    expect(words(null, 'LIGHT')).toBe('Lightly obscured')
    expect(words(null, null)).toBe('Visual darkness')
  })

  it('summarizes the lighting only when it departs from bright light', () => {
    expect(
      describeSceneLighting(
        { ambientIllumination: 'BRIGHT', darknessZones: [] },
        [],
        illuminationLevels
      )
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
      ['Ember'],
      illuminationLevels
    )
    expect(summary).toContain('Ambient: Dim light')
    expect(summary).toContain('Magical darkness, heavily obscured')
    expect(summary).toContain('Vision: Ember')
  })

  describe("a System's own illumination levels (RULES-2.T9d)", () => {
    // A System whose every darkness dispels light, with its own words for each level.
    const strictLevels: readonly SceneIlluminationLevel[] = [
      { code: 'BRIGHT', label: 'Daylight', renderClass: 'LIT', suppressesLight: false },
      { code: 'DIM', label: 'Twilight', renderClass: 'LIT', suppressesLight: false },
      { code: 'ORDINARY_DARKNESS', label: 'Night', renderClass: 'DARK', suppressesLight: true },
      { code: 'MAGICAL_DARKNESS', label: 'Abyss', renderClass: 'DARK', suppressesLight: true }
    ]
    const strict = (code: IlluminationCode) => requireSceneIlluminationLevel(strictLevels, code)
    const origin = { x: 0, y: 0 }
    const reach: VttSenseReach = {
      access: strict('ORDINARY_DARKNESS'),
      effect: 'DARKVISION',
      origin,
      polygon: [
        { x: -100, y: -100 },
        { x: 100, y: -100 },
        { x: 100, y: 100 },
        { x: -100, y: 100 }
      ],
      radius: 100
    }

    it("reads sight into darkness by the System's rank of its access level", () => {
      const into = (illuminationAccess: Parameters<typeof senseEffect>[0]['illuminationAccess']) =>
        ({ channel: 'VISUAL', illuminationAccess }) as const
      expect(senseEffect(into('ORDINARY_DARKNESS'), illuminationLevels)).toBe('DARKVISION')
      expect(senseEffect(into('ORDINARY_DARKNESS'), strictLevels)).toBe('DARKVISION')
      expect(senseEffect(into('MAGICAL_DARKNESS'), strictLevels)).toBe('TRUESIGHT')
    })

    it('reveals by render class, and sight only into darkness no darker than its access', () => {
      const revealed = (illumination: SceneIlluminationLevel) =>
        isTokenRevealed({
          halfSize: 35,
          illumination,
          illuminationLevels: strictLevels,
          point: origin,
          reaches: [reach]
        })
      expect(revealed(strict('ORDINARY_DARKNESS'))).toBe(true)
      expect(revealed(strict('MAGICAL_DARKNESS'))).toBe(false)
      expect(
        isTokenRevealed({
          halfSize: 35,
          illumination: strict('DIM'),
          illuminationLevels: strictLevels,
          point: origin,
          reaches: []
        })
      ).toBe(true)
    })

    it("outlines and words a zone by the System's level", () => {
      const night = zone('ORDINARY_DARKNESS', null)
      expect(darknessZoneStyle(night, strictLevels).illuminationOutline).not.toBeNull()
      expect(describeDarknessZone(night, strictLevels)).toBe('Night')
      expect(
        describeSceneLighting({ ambientIllumination: 'DIM', darknessZones: [] }, [], strictLevels)
      ).toBeNull()
    })
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

const movementTokenId = '00000000-0000-4000-8000-000000000005'
const movementUserId = '00000000-0000-4000-8000-000000000006'

function movementScene(): CampaignSceneStateDto {
  return validated(campaignSceneStateDtoSchema)({
    annotations: [],
    ambientIllumination: 'BRIGHT',
    daylight: false,
    barriers: [],
    campaignId: '00000000-0000-4000-8000-000000000001',
    darknessZones: [],
    definitionId: '00000000-0000-4000-8000-000000000002',
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
    id: '00000000-0000-4000-8000-000000000003',
    lights: [],
    map: {
      assetId: '00000000-0000-4000-8000-000000000004',
      height: 400,
      tileManifestAssetId: null,
      width: 600
    },
    measurements: [],
    name: 'Movement scene',
    tokens: [
      {
        assetId: null,
        controlledByUserIds: [movementUserId],
        height: 50,
        hidden: false,
        id: movementTokenId,
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
  })
}

describe('VTT drawn wall and ring areas (SPELLS-4.T1b, D154)', () => {
  const wall = { kind: 'WALL', maximum: 1200, thickness: 20 } as const
  const ring = { kind: 'RING', maximum: 200, thickness: 20 } as const

  it('pulls the far point of a drawn area in to its largest size', () => {
    const pressedAt = { x: 100, y: 100 }
    expect(drawnAreaAim({ pointer: { x: 400, y: 500 }, pressedAt, size: wall })).toEqual({
      origin: pressedAt,
      toward: { x: 400, y: 500 }
    })
    expect(drawnAreaAim({ pointer: { x: 100, y: 1100 }, pressedAt, size: ring })).toEqual({
      origin: pressedAt,
      toward: { x: 100, y: 300 }
    })
  })

  it('draws nothing for a wall of no length or a ring no wider than its wall', () => {
    const pressedAt = { x: 100, y: 100 }
    expect(drawnAreaAim({ pointer: pressedAt, pressedAt, size: wall })).toBeNull()
    expect(drawnAreaAim({ pointer: { x: 120, y: 100 }, pressedAt, size: ring })).toBeNull()
  })

  it('places a wall to the aim and a ring out to it, and none before a direction', () => {
    const origin = { x: 0, y: 0 }
    expect(aimedAreaShape(wall, { origin, toward: null })).toBeNull()
    expect(aimedAreaShape(wall, { origin, toward: { x: 300, y: 0 } })).toEqual({
      kind: 'WALL',
      to: { x: 300, y: 0 },
      thickness: 20
    })
    expect(aimedAreaShape(ring, { origin, toward: { x: 0, y: 150 } })).toEqual({
      kind: 'RING',
      outerRadius: 150,
      innerRadius: 130
    })
  })

  it('draws a wall as its rectangle and a ring by its outer edge', () => {
    const origin = { x: 0, y: 0 }
    expect(areaOverlay(wall, { origin, toward: { x: 300, y: 0 } }, null)).toMatchObject({
      kind: 'POLYGON',
      purpose: 'TARGET',
      points: [
        { x: 0, y: 10 },
        { x: 300, y: 10 },
        { x: 300, y: -10 },
        { x: 0, y: -10 }
      ]
    })
    expect(areaOverlay(ring, { origin, toward: { x: 0, y: 150 } }, null)).toMatchObject({
      kind: 'CIRCLE',
      center: origin,
      radius: 150
    })
  })
  it('previews the band on the picked side: beside a wall, or by a ring band edge away from its wall', () => {
    const origin = { x: 0, y: 0 }
    const toward = { x: 300, y: 0 }
    expect(areaBandOverlay(wall, { origin, toward })).toBeNull()
    expect(
      areaBandOverlay({ ...wall, band: { distance: 100, side: 'RIGHT' } }, { origin, toward })
    ).toMatchObject({
      id: 'area-band',
      kind: 'POLYGON',
      points: [
        { x: 0, y: 110 },
        { x: 300, y: 110 },
        { x: 300, y: -10 },
        { x: 0, y: -10 }
      ]
    })
    const ringAim = { origin, toward: { x: 0, y: 150 } }
    expect(
      areaBandOverlay({ ...ring, band: { distance: 100, side: 'OUTSIDE' } }, ringAim)
    ).toMatchObject({ kind: 'CIRCLE', center: origin, radius: 250 })
    expect(
      areaBandOverlay({ ...ring, band: { distance: 100, side: 'INSIDE' } }, ringAim)
    ).toMatchObject({ kind: 'CIRCLE', center: origin, radius: 30 })
    expect(
      stageOverlays({
        actionPreview: null,
        aimingArea: false,
        areaAim: { origin, toward },
        areaSize: { ...wall, band: { distance: 100, side: 'LEFT' } },
        drawerOpened: true,
        scene: null
      })?.map((overlay) => overlay.id)
    ).toEqual(['area-origin', 'area-band'])
  })
})
