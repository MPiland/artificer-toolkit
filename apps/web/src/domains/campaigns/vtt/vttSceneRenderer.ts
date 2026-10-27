import type { SignedVttMapDeliveryDto } from '@artificer-toolkit/schema/api/media'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionTransientBroadcastDto } from '@artificer-toolkit/schema/api/liveSessions'
import type {
  CampaignSceneStateDto,
  SceneTransientEnvelopeDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { combatPerceptionCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import {
  applySceneDelta,
  createSceneFogAreaPatch,
  extendSceneMovementPath,
  isSceneMovementPathValid,
  requireSceneIlluminationLevel,
  resolveSceneIlluminationAt,
  sceneTokenLights,
  SceneBarrierIndex,
  sceneTokenMovementIndex,
  visibilityPolygon,
  visibilityPolygonForLight,
  visibilityPolygonForToken,
  visionRangeInMapPixels,
  type ScenePoint,
  type SceneToken,
  type SceneTokenVision
} from '@artificer-toolkit/shared/vtt'
import type {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  RenderTexture,
  Sprite,
  Text as PixiText,
  Texture
} from 'pixi.js'
import {
  areaOverlay,
  buildVttFogMask,
  canControlSceneToken,
  canPreserveSceneTokenDrag,
  clampPolygonToRadius,
  darknessZoneStyle,
  dashedPolygonSegments,
  dimOverlayAlpha,
  ellipseArcPoints,
  describeSceneLighting,
  gmDarknessCapAlpha,
  illuminationOverlayAlpha,
  lightBandAlphas,
  formatSceneMeasurement,
  formatSceneRoute,
  hasCommittedSceneTokenPositionChanged,
  interpolateScenePoint,
  isTokenRevealed,
  isWithinTokenVisual,
  lightRadii,
  lightTintAlpha,
  maxStatusSegments,
  positionVttMapTiles,
  resolveVttMapLoadDecision,
  resolveSceneTokenMove,
  resolveVttTokenFocusScale,
  resolveVttZoomScale,
  sceneIlluminationAreas,
  senseAccessLevel,
  senseEffect,
  senseReachRadius,
  selectionOutlineColor,
  sceneTokenAppearanceKey,
  stableVttMapPartIds,
  statusCategoryColours,
  statusOverflowColour,
  shouldReloadVttMap,
  visibleGridLinePositions,
  wholeMapPolygon,
  type UnnoticedZone,
  type VttAreaSize,
  type VttIlluminationArea,
  type VttScenePresentationOverlay,
  type VttSquarePick,
  type VttSenseEffect,
  type VttSenseReach,
  type VttTokenPresentation
} from './vttSceneRenderer.model'
import {
  addFacingArcWedges,
  createFacingIndicator,
  facingArcDiagnostics,
  tokenFacingLabel
} from './vttTokenFacing'
import { createVttAreaAimGesture } from './vttAreaAimGesture'
import { createVttPingPress, isVttPingKey, vttPingRingFrame } from './vttPing'
import { clampVttZoomScale } from './vttZoom.model'

export type CampaignVttMode = 'PLAY' | 'EDIT'
export type CampaignVttTool =
  | 'SELECT'
  | 'PAN'
  | 'MEASURE'
  | 'WALL'
  | 'DOOR'
  | 'WINDOW'
  | 'ONE_WAY'
  | 'TERRAIN'
  | 'LIGHT'
  | 'DARKNESS'
  | 'TOKEN'
  | 'ANNOTATION'
  | 'FOG_REVEAL'
  | 'FOG_HIDE'

interface VttSceneRendererCallbacks {
  /** The caster clicked the map while aiming a point area. */
  onAreaPoint?: (point: ScenePoint) => void
  /** The caster released a drag from their token's edge while aiming a directed area. */
  onAreaDirection?: (aim: { origin: ScenePoint; toward: ScenePoint }) => void
  /** The caster pressed Escape while aiming an area. */
  onAreaAimCancel?: () => void
  /** The source pressed inside one of a forced movement's legal squares (D157): its centre. */
  onSquarePick?: (center: ScenePoint) => void
  onMapLoadStatus?: (status: VttMapLoadStatus) => void
  /** The zoom changed; origin says whether the viewer did it or the renderer set it when showing a scene. */
  onZoomChange?: (scale: number, origin: 'SCENE' | 'USER') => void
  /** The zoom this device saved for the scene, applied instead of fitting the map when it is first shown. */
  resolveSceneZoom?: (sceneId: string) => number | null
  onCreateAnnotation?: (position: ScenePoint) => void
  onCreateBarrier: (
    kind: 'DOOR' | 'WALL' | 'WINDOW' | 'ONE_WAY' | 'TERRAIN',
    a: ScenePoint,
    b: ScenePoint
  ) => void
  onCreateDarkness: (a: ScenePoint, b: ScenePoint) => void
  onCreateLight: (position: ScenePoint) => void
  onCreateToken: (position: ScenePoint) => void
  onFogArea?: (explored: boolean, a: ScenePoint, b: ScenePoint) => void
  onFogAreaPreview?: (explored: boolean, a: ScenePoint, b: ScenePoint) => void
  onDoorState: (barrierId: string, state: 'CLOSED' | 'OPEN') => void
  onMeasurementCommit: (path: ScenePoint[]) => void
  onMeasurementPreview: (path: ScenePoint[]) => void
  /** Sends a ping; returns whether it was sent, so the renderer draws it for this member too. */
  onPing: (position: ScenePoint) => boolean
  onTokenCommit: (tokenId: string, path: ScenePoint[]) => void
  /** The caster pressed a targetable token while targeting. */
  onTokenPick?: (tokenId: string) => void
  /** The caster pressed Escape while targeting. */
  onTargetingCancel?: () => void
  /** The pointer entered a token, or left it (null). */
  onTokenHover?: (tokenId: string | null) => void
  /** The SELECT tool pressed a token (any token), or the empty map (null). */
  onTokenSelect?: (tokenId: string | null) => void
  onTokenPreview: (tokenId: string, position: ScenePoint) => void
}

export type VttMapLoadStatus = 'ERROR' | 'LOADING' | 'READY'

export interface VttSceneRendererUpdate {
  /**
   * While set, the pointer aims this area: a preview follows it. A point area is picked by a click
   * on its center; a directed area by a drag from the edge of the caster's token (`casterTokenId`).
   */
  areaAim?: { casterTokenId: string | null; size: VttAreaSize } | null
  /** While set, a press inside one of these legal squares picks it, and a press elsewhere does nothing. */
  squarePick?: VttSquarePick | null
  boundTokenControl: ReadonlyMap<string, boolean>
  currentUserId: string
  mapDelivery: SignedVttMapDeliveryDto | null
  mode: CampaignVttMode
  /**
   * For an Encounter's Scene: the actor each bound token moves for, the zones that raise what
   * moving costs and the actors whose drag doubles it, so a dragged route shows the movement the
   * room will charge, and the GM's concealed zones with who has not noticed each (MOVE-3.6).
   */
  movementCost?: {
    actorIdByTokenId: ReadonlyMap<string, string>
    zones: EncounterSessionStateDto['movementCostZones']
    dragDoublingActorIds: ReadonlySet<string>
    unnoticedZones: readonly UnnoticedZone[]
  } | null
  overlays?: readonly VttScenePresentationOverlay[]
  /** The GM's token-view preview: draws what a Player controlling this Token sees. */
  previewTokenId?: string | null
  role: 'OWNER' | 'PLAYER'
  scene: CampaignSceneStateDto
  /** The token drawn with the selection outline. */
  selectedTokenId?: string | null
  tokenPresentations?: Readonly<Record<string, VttTokenPresentation>>
  /** While set, a press on a targetable token picks it as the action's target and nothing else on the map reacts. */
  targeting?: boolean
  tool: CampaignVttTool
  /**
   * The token whose view is drawn: its sight is not clamped to an authored range, and its senses
   * change the darkness it sees. The Stage resolves it (`resolveViewTokenId`); null draws none.
   */
  viewTokenId?: string | null
}

export interface VttSceneRenderer {
  applyTransient: (message: LiveSessionTransientBroadcastDto) => void
  destroy: () => void
  fit: () => void
  focusPoint: (point: ScenePoint) => void
  /** Centres the token and zooms in until its footprint is readable; never zooms out. */
  focusToken: (token: { height: number; position: ScenePoint; width: number }) => void
  getDiagnostics: () => {
    /** The in-progress token drag: its path length, where the token is drawn and the route line drawn. */
    activeDrag: { pointCount: number; position: ScenePoint; route: ScenePoint[] } | null
    doorVisualCreateCount: number
    /** How many route lines are drawn: one during a token drag, none otherwise. */
    dragRouteLabel: string | null
    dragRouteLineCount: number
    facingIndicatorCount: number
    fogRenderCount: number
    lighting: {
      ambientIllumination: CampaignSceneStateDto['ambientIllumination'] | null
      brightLightCount: number
      /** The zone graphics drawn, by kind: darkening and magical zones in the overlay, cues above it. */
      darknessZones: {
        dim: number
        heavyObscured: number
        lightObscured: number
        magical: number
        ordinary: number
        unspecified: number
      }
      dimLightCount: number
      /** The tint polygons drawn, in order: each one's fill colour, alpha and polygon count. */
      lightTints: { alpha: number; color: number; polygonCount: number; radius: 'bright' | 'dim' }[]
      /** The sight polygons cut out of the vision mask. */
      visionCount: number
      /** The fill alpha of each visual-only darkness zone graphic. */
      visualZoneAlphas: number[]
    }
    loadedMapAssetCount: number
    mapLoadComplete: boolean
    overlayCount: number
    sceneVersion: number | null
    tokenArtCount: number
    tokenOverflowCount: number
    tokenStatusCount: number
    tokenVisualCount: number
    /** What is drawn per Token: its body footprint, position and rotations (the body stays upright). */
    tokens: {
      /** The colour of the drawn body fill. */
      bodyFillColor: number | null
      /** Whether the current-turn crosshair is drawn, the shape cue that tells it from a reaction halo. */
      crosshairDrawn: boolean
      /** The drawn facing arcs, by arc name, with the sampled outline of each wedge. */
      facingArcs: { arc: string; polygon: ScenePoint[] }[]
      facingRotationDegrees: number | null
      footprint: { height: number; width: number }
      /** Whether the ring that marks the token as pickable while targeting is drawn. */
      targetableDrawn: boolean
      /** The drawn turn or reaction halo. */
      halo: { color: number; label: string } | null
      id: string
      /** The bounds of the drawn inner disposition ring, in the token's own space. */
      innerRing: { height: number; width: number; x: number; y: number }
      /** The bounds of the drawn outer status ring, in the token's own space. */
      outerRing: { height: number; width: number; x: number; y: number }
      position: ScenePoint
      /** The colour of the drawn inner ring. */
      ringColor: number | null
      rotationDegrees: number
      /** The drawn selection outline: its colour and how many dashes it is made of. */
      selection: { color: number; dashSegmentCount: number } | null
      /** The drawn outer-ring segments in order; the overflow segment is the hollow one. */
      statusSegments: { color: number; overflow: boolean }[]
      /** False while darkness conceals the token from the view token's senses. */
      visible: boolean
    }[]
    transientVisualCount: number
    zoomScale: number
  }
  previewDoorState: (barrierId: string, state: 'CLOSED' | 'LOCKED' | 'OPEN' | null) => void
  retryMap: (delivery: SignedVttMapDeliveryDto) => void
  /**
   * Reads the drawn darkness overlay at scene points: its alpha as the viewer sees it, whether the
   * vision mask hides the point, and whether the map is drawn in greyscale there (darkvision).
   */
  sampleDarkness: (
    points: readonly ScenePoint[]
  ) => { alpha: number; greyscale: boolean; masked: boolean; point: ScenePoint }[]
  /** Zooms about the view centre to an absolute scale (1 = one map pixel per screen pixel), clamped to the range. */
  setZoomScale: (scale: number) => void
  update: (next: VttSceneRendererUpdate) => void
  zoomIn: () => void
  zoomOut: () => void
}

const colors = {
  arcane: 0x8b5cf6,
  barrier: 0xe7eaf0,
  darkness: 0x08090b,
  doorClosed: 0xec8c06,
  doorOpen: 0x6bd8cb,
  grid: 0xffffff,
  mapFallback: 0x20252a,
  measurement: 0x6bd8cb,
  ping: 0x6bd8cb,
  plate: 0x101315,
  token: 0xec8c06,
  tokenOutline: 0xffffff,
  vision: 0x6bd8cb
} as const

const transientVisualLifetimeMs = 1_200
/** The art and inner ring sit this far inside the footprint, leaving the outer ring its own band. */
const tokenRingInset = 11
const outerRingWidth = 5
/** The gap between the footprint edge and the outer ring's stroke. */
const outerRingMargin = 2
/** Radians between neighbouring outer-ring segments. */
const outerRingGap = 0.07
const selectionOutlineOffset = 16
const tokenBodyLabel = 'token-body'
const tokenCrosshairLabel = 'token-crosshair'
const tokenFillLabel = 'token-fill'
const tokenHaloLabelPrefix = 'token-halo:'
const tokenOuterRingLabel = 'token-outer-ring'
const tokenOverflowSegmentLabel = 'token-status-overflow'
const tokenRingLabel = 'token-ring'
const tokenTargetableLabel = 'token-targetable'
const tokenSegmentLabel = 'token-status-segment'
const tokenSelectionLabel = 'token-selection'
const zoomFactor = 1.1
/** A larger map renders its darkness and sight textures at a lower resolution than this. */
const maxLightingTextureSize = 2048
const darknessZoneLabelPrefix = 'darkness-zone:'
/** A zone whose System level dispels light; other zones are labelled by their render class. */
const darknessZoneSuppressingLabel = `${darknessZoneLabelPrefix}SUPPRESSES_LIGHT`
const obscurementLabelPrefix = 'obscurement:'
const lightTintDimLabel = 'light-tint-dim'
const lightTintBrightLabel = 'light-tint-bright'

type SceneLight = CampaignSceneStateDto['lights'][number]

function lightingTextureScale(map: CampaignSceneStateDto['map']): number {
  return Math.min(1, maxLightingTextureSize / Math.max(map.width, map.height))
}

function isBarrierTool(
  tool: CampaignVttTool
): tool is 'DOOR' | 'WALL' | 'WINDOW' | 'ONE_WAY' | 'TERRAIN' {
  return (
    tool === 'WALL' ||
    tool === 'DOOR' ||
    tool === 'WINDOW' ||
    tool === 'ONE_WAY' ||
    tool === 'TERRAIN'
  )
}

function drawnCount(container: Container | null, label: string): number {
  return container?.children.filter((child) => child.label === label).length ?? 0
}

function destroyChildren(container: Container): void {
  for (const child of container.removeChildren()) child.destroy({ children: true })
}

function positionKey(point: ScenePoint): string {
  return `${Math.round(point.x)}:${Math.round(point.y)}`
}

function pointsEqual(left: ScenePoint, right: ScenePoint): boolean {
  return left.x === right.x && left.y === right.y
}

export async function createVttSceneRenderer(
  host: HTMLElement,
  gameSystemId: string,
  callbacks: VttSceneRendererCallbacks
): Promise<VttSceneRenderer> {
  const { illuminationLevels } = combatPerceptionCapabilityRegistry.require(gameSystemId)
  const levelOf = (code: CampaignSceneStateDto['ambientIllumination']) =>
    requireSceneIlluminationLevel(illuminationLevels, code)
  // @ts-expect-error -- Pixi publishes this CSP fallback without a declaration file.
  await import('pixi.js/unsafe-eval')
  const pixi = await import('pixi.js')
  const app: Application = new pixi.Application()
  await app.init({
    antialias: true,
    autoDensity: true,
    // The Stage renders on demand (`requestRender`), not every frame.
    autoStart: false,
    background: '#101315',
    preference: 'webgl',
    resizeTo: host,
    resolution: Math.min(globalThis.devicePixelRatio || 1, 2)
  })
  app.canvas.setAttribute('aria-label', 'Interactive campaign scene')
  app.canvas.setAttribute('role', 'img')
  // P pings the centre of the view; a long press pings the pressed point.
  app.canvas.setAttribute('aria-keyshortcuts', 'P')
  app.canvas.tabIndex = 0
  host.append(app.canvas)

  const world = new pixi.Container()
  const mapLayer = new pixi.Container()
  // Darkvision draws the map again in greyscale, masked to the ground it newly lights.
  const greyscaleLayer = new pixi.Container()
  const greyMapLayer = new pixi.Container()
  const greyscaleMask = new pixi.Sprite()
  const gridLayer = new pixi.Container()
  const fogLayer = new pixi.Container()
  const lightTintLayer = new pixi.Container()
  // The darkness overlay is one black sprite whose alpha encodes the illumination class.
  const darknessSprite = new pixi.Sprite()
  const obscurementLayer = new pixi.Container()
  // The player's map is black outside the union of their sight polygons.
  const sightMaskSprite = new pixi.Sprite()
  const presentationLayer = new pixi.Container()
  const tokenLayer = new pixi.Container()
  const measurementLayer = new pixi.Container()
  const dragRouteLayer = new pixi.Container()
  const wallLayer = new pixi.Container()
  const doorLayer = new pixi.Container()
  const visionRevealLayer = new pixi.Container()
  const transientLayer = new pixi.Container()
  world.addChild(
    mapLayer,
    greyscaleLayer,
    gridLayer,
    fogLayer,
    lightTintLayer,
    darknessSprite,
    obscurementLayer,
    sightMaskSprite,
    presentationLayer,
    tokenLayer,
    measurementLayer,
    dragRouteLayer,
    wallLayer,
    doorLayer,
    visionRevealLayer,
    transientLayer
  )
  const greyscaleFilter = new pixi.ColorMatrixFilter()
  greyscaleFilter.desaturate()
  greyMapLayer.filters = [greyscaleFilter]
  greyscaleLayer.addChild(greyMapLayer, greyscaleMask)
  greyscaleLayer.mask = greyscaleMask
  greyscaleLayer.visible = false
  app.stage.addChild(world)
  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen

  let current: VttSceneRendererUpdate | null = null
  let mapAssetKey: string | null = null
  let mapCredentialKey: string | null = null
  let mapGeneration = 0
  let mapLoadComplete = false
  let mapLoadStatus: VttMapLoadStatus | null = null
  let overviewLayer: Container | null = null
  let tileLayer: Container | null = null
  let greyOverviewLayer: Container | null = null
  let greyTileLayer: Container | null = null
  let fogTexture: Texture | null = null
  let renderedFogLayers: CampaignSceneStateDto['fogLayers'] | null = null
  let renderedFogMode: CampaignSceneStateDto['fogMode'] | null = null
  let renderedFogRole: VttSceneRendererUpdate['role'] | null = null
  let renderedBarriers: CampaignSceneStateDto['barriers'] | null = null
  let renderedDoorStates: CampaignSceneStateDto['doorStates'] | null = null
  let renderedDarknessZones: CampaignSceneStateDto['darknessZones'] | null = null
  let renderedGrid: CampaignSceneStateDto['grid'] | null = null
  let renderedLightingBarriers: CampaignSceneStateDto['barriers'] | null = null
  let renderedLights: CampaignSceneStateDto['lights'] | null = null
  /** The token lights last drawn, by value: a token move that keeps them never redraws lighting. */
  let renderedTokenLightsKey = ''
  let renderedAmbient: CampaignSceneStateDto['ambientIllumination'] | null = null
  let renderedLightingMap: CampaignSceneStateDto['map'] | null = null
  let darknessClassMap: Container | null = null
  let darknessTexture: RenderTexture | null = null
  /** The reach polygon of every light, which clears darkness; the sense textures are rebuilt from them. */
  let lightCutPolygons: ScenePoint[][] = []
  let lightingRevision = 0
  /** The darkness overlay as the view token's senses change it; shown while a sense applies. */
  let viewOverlayTexture: RenderTexture | null = null
  let senseOverlayActive = false
  let greyscaleTexture: RenderTexture | null = null
  let senseReaches: VttSenseReach[] = []
  let renderedSenses: {
    grid: CampaignSceneStateDto['grid']
    lightingRevision: number
    viewToken: CampaignSceneStateDto['tokens'][number] | undefined
  } | null = null
  let sightMaskTexture: RenderTexture | null = null
  let sightPolygonCount = 0
  let renderedVision: {
    barriers: CampaignSceneStateDto['barriers']
    boundTokenControl: VttSceneRendererUpdate['boundTokenControl']
    currentUserId: string
    doorStates: CampaignSceneStateDto['doorStates']
    grid: CampaignSceneStateDto['grid']
    map: CampaignSceneStateDto['map']
    previewTokenId: string | null
    role: VttSceneRendererUpdate['role']
    tokens: CampaignSceneStateDto['tokens']
  } | null = null
  let tokenSummary = 'No visible tokens'
  let visionLabels: string[] = []
  let renderedLightingDoorStates: CampaignSceneStateDto['doorStates'] | null = null
  let renderedMeasurements: CampaignSceneStateDto['measurements'] | null = null
  let renderedTokens: CampaignSceneStateDto['tokens'] | null = null
  let renderedTokenPresentations: VttSceneRendererUpdate['tokenPresentations'] | null = null
  let renderedSelectedTokenId: string | null = null
  let renderedOverlays: VttSceneRendererUpdate['overlays'] | null = null
  let lightingBarrierIndex: SceneBarrierIndex | null = null
  let movementBarrierIndex: SceneBarrierIndex | null = null
  let movementBarrierSource: CampaignSceneStateDto['barriers'] | null = null
  let fittedSceneId: string | null = null
  let panStart: { pointer: ScenePoint; world: ScenePoint } | null = null
  let gestureStart: ScenePoint | null = null
  let gesturePath: ScenePoint[] = []
  let wallChainStart: ScenePoint | null = null
  const areaAimGesture = createVttAreaAimGesture(
    () =>
      current?.squarePick
        ? { squares: current.squarePick }
        : current?.areaAim
          ? {
              caster:
                current.scene.tokens.find(
                  (token) => token.id === current?.areaAim?.casterTokenId
                ) ?? null,
              size: current.areaAim.size
            }
          : null,
    {
      onPoint: (point) => callbacks.onAreaPoint?.(point),
      onDirection: (aim) => callbacks.onAreaDirection?.(aim),
      onSquare: (center) => callbacks.onSquarePick?.(center)
    }
  )
  let drag: {
    appearanceKey: string
    last: ScenePoint
    offset: ScenePoint
    origin: ScenePoint
    path: ScenePoint[]
    tokenId: string
    visual: Container
  } | null = null
  const tokenVisuals = new Map<
    string,
    {
      appearanceKey: string
      presentation: VttTokenPresentation | undefined
      token: CampaignSceneStateDto['tokens'][number]
      visual: Container
    }
  >()
  const doorVisuals = new Map<
    string,
    {
      barrier: Extract<CampaignSceneStateDto['barriers'][number], { kind: 'DOOR' }>
      state: 'CLOSED' | 'LOCKED' | 'OPEN'
      visuals: Record<'CLOSED' | 'LOCKED' | 'OPEN', Graphics>
    }
  >()
  const doorPreviews = new Map<string, 'CLOSED' | 'LOCKED' | 'OPEN'>()
  const loadedTokenArtUrls = new Set<string>()
  const transientVisuals = new Map<
    string,
    | { container: Graphics; kind: 'TOKEN_DRAG_PREVIEW' }
    | { container: Container; kind: 'MEASUREMENT_PREVIEW'; segments: Graphics[] }
  >()
  const transientTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  const remoteTokenDragPreviews = new Map<
    string,
    {
      current: ScenePoint
      graphic: Graphics
      target: ScenePoint
      tokenId: string
      sequence: number
      renderedSequence: number | null
    }
  >()
  const remoteFogPreviews = new Map<
    string,
    Extract<SceneTransientEnvelopeDto, { kind: 'FOG_AREA_PREVIEW' }>
  >()
  const remoteVisionLayers = new Map<
    string,
    {
      baselineVersion: number
      layers: NonNullable<LiveSessionTransientBroadcastDto['visionLayers']>
    }
  >()
  const remoteVisionReveals = new Map<
    string,
    {
      baselineVersion: number
      reveal: NonNullable<LiveSessionTransientBroadcastDto['visionReveal']>
    }
  >()
  const loadedMapUrls = new Set<string>()
  const loadedMapParts = new Map<string, { url: string }>()
  const pendingMapPartUrls = new Map<string, string>()
  const mapPartRequestIds = new Map<string, number>()
  const mapExpectedPartIds = new Set<string>()
  const touchPointers = new Map<number, ScenePoint>()
  /** The latest ping ring of each member, keyed by user ID. */
  const pings = new Map<string, { graphic: Graphics; startedAt: number }>()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let pinchDistance: number | null = null
  let fogRenderCount = 0
  let doorVisualCreateCount = 0

  /**
   * Renders the next frame. Every change to the display tree must request one; the ticker then runs
   * only while previews or pings animate, so an unchanged Scene costs no frames.
   */
  let framePending = false
  const requestRender = () => {
    framePending = true
    app.ticker.start()
  }
  const onTickerUpdate = () => {
    const elapsedMs = app.ticker.deltaMS
    let animating = false
    for (const preview of remoteTokenDragPreviews.values()) {
      if (!tokenVisuals.has(preview.tokenId)) continue
      interpolateScenePoint(preview.current, preview.target, elapsedMs)
      positionRemoteTokenDragPreview(preview.graphic, preview.current)
      if (!pointsEqual(preview.current, preview.target)) animating = true
    }
    for (const [userId, entry] of pings) {
      const frame = vttPingRingFrame(performance.now() - entry.startedAt, reducedMotion.matches)
      if (!frame) {
        clearPing(userId)
        continue
      }
      // The ring keeps its screen size at any zoom, with a dark halo for bright maps.
      const scale = world.scale.x
      entry.graphic
        .clear()
        .circle(0, 0, frame.radius / scale)
        .stroke({ alpha: frame.alpha * 0.6, color: colors.darkness, width: 6 / scale })
        .circle(0, 0, frame.radius / scale)
        .stroke({ alpha: frame.alpha, color: colors.ping, width: 3 / scale })
    }
    // Stopping here still renders this frame: Pixi's render listener runs after this one.
    if (!animating && pings.size === 0) app.ticker.stop()
  }
  app.ticker.add(onTickerUpdate)
  const previewRenderObserver = {
    postrender(options: { container: Container }) {
      if (options.container !== app.stage) return
      framePending = false
      for (const preview of remoteTokenDragPreviews.values()) {
        if (preview.renderedSequence === preview.sequence) continue
        preview.renderedSequence = preview.sequence
        // Record after Pixi submits the updated preview, so browser proofs can observe its paint.
        performance.mark('artificer:vtt-token-preview-rendered', {
          detail: {
            sceneId: current?.scene.id,
            tokenId: preview.tokenId,
            sequence: preview.sequence,
            position: preview.target
          }
        })
        performance.clearMarks('artificer:vtt-token-preview-rendered')
      }
    }
  }
  app.renderer.runners.postrender.add(previewRenderObserver)

  function worldPoint(event: FederatedPointerEvent): ScenePoint {
    const point = world.toLocal(event.global)
    return { x: point.x, y: point.y }
  }

  const pingPress = createVttPingPress(ping)

  /** Sends one ping at a map point and draws it for this member once it is sent (Q19). */
  function ping(point: ScenePoint): void {
    if (!current) return
    const { height, width } = current.scene.map
    if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) return
    if (callbacks.onPing(point)) showPing(current.currentUserId, point)
  }

  /** Pings the map point at the centre of the view, kept within the map (the keyboard ping). */
  function pingViewCentre(): void {
    if (!current) return
    const centre = world.toLocal({ x: app.screen.width / 2, y: app.screen.height / 2 })
    ping({
      x: Math.min(current.scene.map.width, Math.max(0, centre.x)),
      y: Math.min(current.scene.map.height, Math.max(0, centre.y))
    })
  }

  /** Starts a member's ping ring, replacing their previous one. */
  function showPing(userId: string, point: ScenePoint): void {
    clearPing(userId)
    const graphic = new pixi.Graphics()
    graphic.position.set(point.x, point.y)
    transientLayer.addChild(graphic)
    pings.set(userId, { graphic, startedAt: performance.now() })
    requestRender()
  }

  function clearPing(userId: string): void {
    const existing = pings.get(userId)
    if (!existing) return
    existing.graphic.removeFromParent()
    existing.graphic.destroy()
    pings.delete(userId)
  }

  function showMap(scale: number | null, origin: 'SCENE' | 'USER'): void {
    if (!current) return
    const { height, width } = current.scene.map
    world.scale.set(
      scale ??
        clampVttZoomScale(Math.min(app.screen.width / width, app.screen.height / height) * 0.94)
    )
    world.position.set(
      (app.screen.width - width * world.scale.x) / 2,
      (app.screen.height - height * world.scale.y) / 2
    )
    requestRender()
    callbacks.onZoomChange?.(world.scale.x, origin)
  }

  function fit(): void {
    showMap(null, 'USER')
  }

  function setZoomScale(scale: number): void {
    zoomAtCanvasCenter(clampVttZoomScale(scale) / world.scale.x)
  }

  function focusPoint(point: ScenePoint): void {
    world.position.set(
      app.screen.width / 2 - point.x * world.scale.x,
      app.screen.height / 2 - point.y * world.scale.y
    )
    requestRender()
  }

  function focusToken(token: { height: number; position: ScenePoint; width: number }): void {
    world.scale.set(resolveVttTokenFocusScale(world.scale.x, token))
    focusPoint(token.position)
    callbacks.onZoomChange?.(world.scale.x, 'USER')
  }

  function zoomAt(factor: number, point: ScenePoint): void {
    const before = world.toLocal(point)
    const nextScale = resolveVttZoomScale(world.scale.x, factor)
    world.scale.set(nextScale)
    const after = world.toGlobal(before)
    world.position.x += point.x - after.x
    world.position.y += point.y - after.y
    requestRender()
    callbacks.onZoomChange?.(nextScale, 'USER')
  }

  function zoomAtCanvasCenter(factor: number): void {
    zoomAt(factor, { x: app.screen.width / 2, y: app.screen.height / 2 })
  }

  function drawMap(scene: CampaignSceneStateDto, delivery: SignedVttMapDeliveryDto | null): void {
    destroyChildren(mapLayer)
    destroyChildren(greyMapLayer)
    releaseMapAssets()
    mapLoadComplete = false
    mapLoadStatus = null
    const generation = ++mapGeneration
    for (const layer of [mapLayer, greyMapLayer]) {
      layer.addChild(
        new pixi.Graphics().rect(0, 0, scene.map.width, scene.map.height).fill(colors.mapFallback)
      )
    }
    if (!delivery) return
    if (!isMapDeliveryForScene(scene, delivery)) {
      emitMapLoadStatus('ERROR')
      return
    }
    overviewLayer = new pixi.Container()
    tileLayer = new pixi.Container()
    mapLayer.addChild(overviewLayer, tileLayer)
    greyOverviewLayer = new pixi.Container()
    greyTileLayer = new pixi.Container()
    greyMapLayer.addChild(greyOverviewLayer, greyTileLayer)
    loadMissingMapParts(scene, delivery, generation)
  }

  function loadMissingMapParts(
    scene: CampaignSceneStateDto,
    delivery: SignedVttMapDeliveryDto,
    generation = mapGeneration
  ): void {
    if (!isMapDeliveryForScene(scene, delivery) || generation !== mapGeneration) return
    const requiredPartIds = stableVttMapPartIds(delivery)
    mapExpectedPartIds.clear()
    for (const partId of requiredPartIds) mapExpectedPartIds.add(partId)
    const missingPartIds = requiredPartIds.filter((partId) => !loadedMapParts.has(partId))
    if (missingPartIds.length === 0) {
      mapLoadComplete = true
      emitMapLoadStatus('READY')
      return
    }
    mapLoadComplete = false
    emitMapLoadStatus('LOADING')
    const scaleX = scene.map.width / delivery.width
    const scaleY = scene.map.height / delivery.height
    if (missingPartIds.includes('overview')) {
      loadMapPart('overview', delivery.overview.url, generation, (texture) => {
        if (!overviewLayer) return
        for (const layer of [overviewLayer, greyOverviewLayer]) {
          const sprite = new pixi.Sprite(texture)
          sprite.width = scene.map.width
          sprite.height = scene.map.height
          layer?.addChild(sprite)
        }
      })
    }
    for (const tile of positionVttMapTiles(delivery)) {
      const partId = `tile:${tile.row}:${tile.column}`
      if (!missingPartIds.includes(partId)) continue
      loadMapPart(partId, tile.url, generation, (texture) => {
        if (!tileLayer) return
        for (const layer of [tileLayer, greyTileLayer]) {
          const sprite = new pixi.Sprite(texture)
          sprite.position.set(tile.x * scaleX, tile.y * scaleY)
          sprite.width = tile.width * scaleX
          sprite.height = tile.height * scaleY
          layer?.addChild(sprite)
        }
      })
    }
  }

  function loadMapPart(
    partId: string,
    url: string,
    generation: number,
    addSprite: (texture: Texture) => void
  ): void {
    const requestId = (mapPartRequestIds.get(partId) ?? 0) + 1
    mapPartRequestIds.set(partId, requestId)
    pendingMapPartUrls.set(partId, url)
    void pixi.Assets.load(url).then(
      (texture) => {
        if (generation !== mapGeneration || mapPartRequestIds.get(partId) !== requestId) {
          unloadMapUrlUnlessInUse(url)
          return
        }
        pendingMapPartUrls.delete(partId)
        loadedMapParts.set(partId, { url })
        loadedMapUrls.add(url)
        addSprite(texture)
        requestRender()
        if ([...mapExpectedPartIds].every((expectedPartId) => loadedMapParts.has(expectedPartId))) {
          mapLoadComplete = true
          emitMapLoadStatus('READY')
        }
      },
      () => {
        if (generation !== mapGeneration || mapPartRequestIds.get(partId) !== requestId) return
        pendingMapPartUrls.delete(partId)
        mapLoadComplete = false
        emitMapLoadStatus('ERROR')
      }
    )
  }

  function emitMapLoadStatus(status: VttMapLoadStatus): void {
    if (mapLoadStatus === status) return
    mapLoadStatus = status
    callbacks.onMapLoadStatus?.(status)
  }

  function isMapDeliveryForScene(
    scene: CampaignSceneStateDto,
    delivery: SignedVttMapDeliveryDto
  ): boolean {
    return (
      scene.map.assetId === delivery.assetId &&
      scene.map.width === delivery.width &&
      scene.map.height === delivery.height
    )
  }

  function unloadMapUrlUnlessInUse(url: string): void {
    if (
      loadedMapUrls.has(url) ||
      [...pendingMapPartUrls.values()].some((pendingUrl) => pendingUrl === url)
    ) {
      return
    }
    void pixi.Assets.unload(url)
  }

  function drawGrid(scene: CampaignSceneStateDto): void {
    destroyChildren(gridLayer)
    if (scene.grid.kind !== 'SQUARE') return
    const grid = new pixi.Graphics()
    const { cellSize, origin } = scene.grid
    for (const x of visibleGridLinePositions(origin.x, cellSize, scene.map.width)) {
      grid.moveTo(x, 0).lineTo(x, scene.map.height)
    }
    for (const y of visibleGridLinePositions(origin.y, cellSize, scene.map.height)) {
      grid.moveTo(0, y).lineTo(scene.map.width, y)
    }
    grid.stroke({ alpha: 0.16, color: colors.grid, pixelLine: true, width: 1 })
    gridLayer.addChild(grid)
  }

  function drawFog(scene: CampaignSceneStateDto): void {
    fogRenderCount += 1
    destroyChildren(fogLayer)
    fogTexture?.destroy(true)
    fogTexture = null
    const mask = buildVttFogMask(scene, current?.role === 'PLAYER')
    if (!mask) return
    const canvas = document.createElement('canvas')
    canvas.width = mask.width
    canvas.height = mask.height
    const context = canvas.getContext('2d')
    if (!context) return
    const image = context.createImageData(mask.width, mask.height)
    for (let index = 0; index < mask.opacity.length; index += 1) {
      image.data[index * 4 + 3] = mask.opacity[index]!
    }
    context.putImageData(image, 0, 0)
    fogTexture = pixi.Texture.from(canvas)
    fogTexture.source.scaleMode = 'nearest'
    const sprite = new pixi.Sprite(fogTexture)
    sprite.width = scene.map.width
    sprite.height = scene.map.height
    fogLayer.addChild(sprite)
  }

  function drawFogWithRemotePreviews(): void {
    if (!current) return
    if (current.scene.fogMode === 'OFF') return drawFog(current.scene)
    let scene = current.scene
    for (const preview of remoteFogPreviews.values()) {
      if (preview.baselineVersion !== current.scene.version) continue
      const patch = createSceneFogAreaPatch(scene, {
        explored: preview.explored,
        ownerUserId: preview.ownerUserId,
        rectangle: preview.rectangle
      })
      if (patch) {
        scene = applySceneDelta(
          scene,
          { kind: 'FOG_CHUNKS_PATCHED', layer: patch },
          scene.version + 1
        )
      }
    }
    for (const preview of remoteVisionLayers.values()) {
      if (preview.baselineVersion !== current.scene.version) continue
      for (const patch of preview.layers) {
        if (
          current.role === 'PLAYER' &&
          patch.ownerUserId !== null &&
          patch.ownerUserId !== current.currentUserId
        ) {
          continue
        }
        scene = applySceneDelta(
          scene,
          { kind: 'FOG_CHUNKS_PATCHED', layer: patch },
          scene.version + 1
        )
      }
    }
    drawFog(scene)
  }

  function drawVisionReveals(): void {
    destroyChildren(visionRevealLayer)
    if (!current) return
    const barriers = new Map<string, CampaignSceneStateDto['barriers'][number]>()
    const doorStates: CampaignSceneStateDto['doorStates'] = {}
    const tokens = new Map<string, CampaignSceneStateDto['tokens'][number]>()
    for (const preview of remoteVisionReveals.values()) {
      if (preview.baselineVersion !== current.scene.version) continue
      for (const barrier of preview.reveal.barriers) barriers.set(barrier.id, barrier)
      Object.assign(doorStates, preview.reveal.doorStates)
      for (const token of preview.reveal.tokens) tokens.set(token.id, token)
    }
    for (const barrier of barriers.values()) {
      drawBarrier(visionRevealLayer, barrier, doorStates[barrier.id])
    }
    for (const token of tokens.values()) {
      const visual = createTokenVisual(token, undefined)
      visual.eventMode = 'none'
      visual.cursor = 'default'
      visual.position.set(token.position.x, token.position.y)
      visionRevealLayer.addChild(visual)
    }
  }

  function textureForMap(previous: RenderTexture | null, map: CampaignSceneStateDto['map']) {
    const scale = lightingTextureScale(map)
    const width = Math.ceil(map.width * scale)
    const height = Math.ceil(map.height * scale)
    if (previous?.width === width && previous.height === height) return previous
    previous?.destroy(true)
    return pixi.RenderTexture.create({ height, width })
  }

  /** Renders a throwaway composition of black shapes into a lighting texture at its scale. */
  function renderLightingTexture(
    composition: Container,
    texture: RenderTexture,
    map: CampaignSceneStateDto['map']
  ): void {
    composition.scale.set(texture.width / map.width)
    app.renderer.render({ clear: true, container: composition, target: texture })
  }

  function overlayShape(
    points: readonly ScenePoint[],
    alpha: number,
    blendMode: 'erase' | 'max' | 'min',
    label: string,
    color = 0x000000
  ): Graphics {
    const shape = new pixi.Graphics({ blendMode, label })
      .poly(points.flatMap((point) => [point.x, point.y]))
      .fill({ alpha, color })
    return shape
  }

  function tintShape(
    points: readonly ScenePoint[],
    light: SceneLight,
    label: typeof lightTintDimLabel | typeof lightTintBrightLabel
  ): Graphics {
    const shape = new pixi.Graphics()
      .poly(points.flatMap((point) => [point.x, point.y]))
      .fill({ alpha: lightTintAlpha(light), color: light.color })
    shape.label = label
    return shape
  }

  /**
   * Composes the darkness overlay in D108 order: ambient, then dim and ordinary zones darken
   * (darker wins), then lights cut the darkness back inside their radii (brighter wins), then
   * magical darkness forces black. The result is one black texture whose alpha is the class.
   */
  function drawLighting(scene: CampaignSceneStateDto): void {
    const tokenLights = sceneTokenLights(scene)
    const tokenLightsKey = JSON.stringify(tokenLights)
    if (
      renderedAmbient === scene.ambientIllumination &&
      renderedLightingMap === scene.map &&
      renderedLightingBarriers === scene.barriers &&
      renderedLightingDoorStates === scene.doorStates &&
      renderedLights === scene.lights &&
      renderedTokenLightsKey === tokenLightsKey &&
      renderedDarknessZones === scene.darknessZones
    ) {
      return
    }
    renderedAmbient = scene.ambientIllumination
    renderedLightingMap = scene.map
    renderedLightingBarriers = scene.barriers
    renderedLightingDoorStates = scene.doorStates
    renderedLights = scene.lights
    renderedTokenLightsKey = tokenLightsKey
    renderedDarknessZones = scene.darknessZones
    const barrierIndex = new SceneBarrierIndex(scene.barriers)
    lightingBarrierIndex = barrierIndex
    destroyChildren(lightTintLayer)
    destroyChildren(obscurementLayer)
    darknessClassMap?.destroy({ children: true })
    const classMap = new pixi.Container()
    darknessClassMap = classMap
    lightCutPolygons = []
    lightingRevision += 1
    const { map } = scene
    const areas = sceneIlluminationAreas(scene, illuminationLevels)
    // Each area is drawn at its level's class; a level that dispels light goes over every light.
    const drawArea = ({ level, points, zone }: VttIlluminationArea) => {
      const alpha = illuminationOverlayAlpha(level.renderClass)
      if (alpha === 0) return
      const label = !zone
        ? 'ambient-illumination'
        : level.suppressesLight
          ? darknessZoneSuppressingLabel
          : `${darknessZoneLabelPrefix}${level.renderClass}`
      classMap.addChild(overlayShape(points, alpha, 'max', label))
    }
    for (const area of areas) if (!area.level.suppressesLight) drawArea(area)
    // A light's radii shed the System's two brightest levels, drawn at those levels' classes.
    const bandAlpha = lightBandAlphas(illuminationLevels)
    for (const light of [...scene.lights, ...tokenLights]) {
      const polygon = visibilityPolygonForLight(
        light,
        scene.barriers,
        scene.doorStates,
        barrierIndex
      )
      if (polygon.points.length < 3) continue
      const radii = lightRadii(light)
      if (radii.dim > radii.bright) {
        const reach = clampPolygonToRadius(polygon.points, light.position, radii.dim)
        classMap.addChild(overlayShape(reach, bandAlpha.dim, 'min', 'light-dim'))
        lightCutPolygons.push(reach)
        lightTintLayer.addChild(tintShape(reach, light, lightTintDimLabel))
      }
      if (radii.bright > 0) {
        const core = clampPolygonToRadius(polygon.points, light.position, radii.bright)
        classMap.addChild(overlayShape(core, bandAlpha.bright, 'min', 'light-bright'))
        lightCutPolygons.push(core)
        lightTintLayer.addChild(tintShape(core, light, lightTintBrightLabel))
      }
    }
    for (const area of areas) if (area.level.suppressesLight) drawArea(area)
    for (const zone of scene.darknessZones) drawZoneCues(zone)
    darknessTexture = textureForMap(darknessTexture, map)
    renderLightingTexture(classMap, darknessTexture, map)
    darknessSprite.texture = darknessTexture
    darknessSprite.scale.set(map.width / darknessTexture.width)
  }

  /** What a zone shows beyond its class: a visual-only fill, and non-colour outlines. */
  function drawZoneCues(zone: CampaignSceneStateDto['darknessZones'][number]): void {
    const style = darknessZoneStyle(zone, illuminationLevels)
    const points = zone.polygon.points
    if (zone.mechanicalIllumination === null) {
      const fill = new pixi.Graphics()
        .poly(points.flatMap((point) => [point.x, point.y]))
        .fill({ alpha: zone.opacity, color: colors.darkness })
      fill.label = `${darknessZoneLabelPrefix}VISUAL`
      obscurementLayer.addChild(fill)
    }
    const { obscurementOutline } = style
    if (obscurementOutline) {
      const outline =
        obscurementOutline.dash === null
          ? new pixi.Graphics()
              .poly(points.flatMap((point) => [point.x, point.y]))
              .stroke({ color: colors.barrier, width: obscurementOutline.width })
          : dashedOutline(points, obscurementOutline.dash, obscurementOutline.gap, {
              color: colors.barrier,
              width: obscurementOutline.width
            })
      outline.label = `${obscurementLabelPrefix}${zone.mechanicalObscurement}`
      obscurementLayer.addChild(outline)
    }
    if (style.illuminationOutline) {
      obscurementLayer.addChild(
        dashedOutline(points, style.illuminationOutline.dash, style.illuminationOutline.gap, {
          color: colors.arcane,
          width: style.illuminationOutline.width
        })
      )
    }
  }

  function dashedOutline(
    points: readonly ScenePoint[],
    dash: number,
    gap: number,
    stroke: { color: number; width: number }
  ): Graphics {
    const outline = new pixi.Graphics()
    for (const [from, to] of dashedPolygonSegments(points, dash, gap)) {
      outline.moveTo(from.x, from.y).lineTo(to.x, to.y)
    }
    return outline.stroke({ ...stroke, cap: 'round' })
  }

  /**
   * Draws what the viewer sees. A Player map is black outside the union of their controlled
   * Token sight polygons. The GM sees the whole map with darkness capped; previewing a Token
   * draws full darkness and that Token sight, as a Player controlling it would see.
   */
  function drawVision(next: VttSceneRendererUpdate): void {
    const previewTokenId = next.role === 'OWNER' ? (next.previewTokenId ?? null) : null
    const { barriers, doorStates, grid, map, tokens } = next.scene
    const inputs = {
      barriers,
      boundTokenControl: next.boundTokenControl,
      currentUserId: next.currentUserId,
      doorStates,
      grid,
      map,
      previewTokenId,
      role: next.role,
      tokens
    }
    if (
      renderedVision &&
      (Object.keys(inputs) as (keyof typeof inputs)[]).every(
        (key) => renderedVision?.[key] === inputs[key]
      )
    ) {
      return
    }
    renderedVision = inputs
    darknessSprite.alpha = next.role === 'OWNER' && !previewTokenId ? gmDarknessCapAlpha : 1
    visionLabels = []
    sightPolygonCount = 0
    // A Player, or the GM previewing a Token, sees only what their Tokens' sight reaches: with no
    // seeing Token the whole map stays black.
    const sightGoverned = next.role === 'PLAYER' || previewTokenId !== null
    sightMaskSprite.visible = sightGoverned
    if (!sightGoverned) return
    const seers = tokens.filter(
      (token): token is SceneToken & { vision: SceneTokenVision } =>
        Boolean(token.vision?.enabled) &&
        (next.role === 'PLAYER' ? canControlSceneToken(token, next) : token.id === previewTokenId)
    )
    const barrierIndex = lightingBarrierIndex ?? new SceneBarrierIndex(barriers)
    const mask = new pixi.Container()
    mask.addChild(
      new pixi.Graphics().rect(0, 0, map.width, map.height).fill({ alpha: 1, color: 0 })
    )
    for (const token of seers) {
      // Every seeing token sees along its line of sight. The shared visibility polygon already
      // stops at the authored range, and server fog reads that same polygon, so what is drawn
      // and what is explored match by construction; within it, the light and the view token's
      // senses decide what shows.
      const sight = visibilityPolygonForToken(
        token.position,
        visionRangeInMapPixels(grid, token.vision),
        barriers,
        doorStates,
        barrierIndex
      )
      if (!sight || sight.points.length < 3) continue
      mask.addChild(overlayShape(sight.points, 1, 'erase', `sight:${token.id}`))
      visionLabels.push(token.label)
      sightPolygonCount += 1
    }
    sightMaskTexture = textureForMap(sightMaskTexture, map)
    renderLightingTexture(mask, sightMaskTexture, map)
    mask.destroy({ children: true })
    sightMaskSprite.texture = sightMaskTexture
    sightMaskSprite.scale.set(map.width / sightMaskTexture.width)
  }

  /**
   * Adds the ground that ordinary darkness covers, as an indicator: a dark level that light
   * dispels at `ordinaryAlpha`, cleared by every light, with a level that dispels light (which no
   * light clears) either added back in full or erased from it.
   */
  function addDarknessIndicator(
    composition: Container,
    scene: CampaignSceneStateDto,
    ordinaryAlpha: number,
    magical: 'erase' | 'max'
  ): void {
    const indicator = (points: readonly ScenePoint[], alpha: number, blend: 'erase' | 'max') =>
      overlayShape(points, alpha, blend, 'sense-indicator', 0xffffff)
    const areas = sceneIlluminationAreas(scene, illuminationLevels)
    for (const { level, points } of areas) {
      if (level.renderClass === 'DARK' && !level.suppressesLight)
        composition.addChild(indicator(points, ordinaryAlpha, 'max'))
    }
    for (const polygon of lightCutPolygons) composition.addChild(indicator(polygon, 1, 'erase'))
    for (const { level, points } of areas) {
      if (level.suppressesLight) composition.addChild(indicator(points, 1, magical))
    }
  }

  /**
   * The widest reach of each sense the view token has. Darkvision, truesight and blindsight reach
   * as far as their range and its line of sight go; tremorsense is felt through walls.
   */
  function senseReachesOf(
    scene: CampaignSceneStateDto,
    viewToken: CampaignSceneStateDto['tokens'][number]
  ): VttSenseReach[] {
    const { barriers, doorStates, grid, map } = scene
    const lineOfSight = viewToken.senses.length
      ? visibilityPolygon(
          viewToken.position,
          Math.hypot(map.width, map.height),
          barriers,
          doorStates,
          lightingBarrierIndex ?? new SceneBarrierIndex(barriers)
        ).points
      : []
    const widest = new Map<VttSenseEffect, VttSenseReach>()
    for (const sense of viewToken.senses) {
      const effect = senseEffect(sense, illuminationLevels)
      if (!effect) continue
      const radius = senseReachRadius(grid, viewToken, sense)
      if ((widest.get(effect)?.radius ?? -1) >= radius) continue
      widest.set(effect, {
        access: senseAccessLevel(sense, illuminationLevels),
        effect,
        origin: viewToken.position,
        polygon:
          effect === 'TREMORSENSE'
            ? []
            : clampPolygonToRadius(lineOfSight, viewToken.position, radius),
        radius
      })
    }
    return [...widest.values()]
  }

  /**
   * Draws what the view token's senses change in the darkness. Each sense applies inside its reach
   * (range from the footprint edge, within line of sight): darkvision turns ordinary darkness dim
   * and dim light bright, drawing the newly lit ground in greyscale; truesight clears ordinary and
   * magical darkness; blindsight clears all darkness. The best sense wins at each point. Sense
   * textures are composed from the Scene again because ordinary and magical darkness look the
   * same once drawn.
   */
  function drawSenses(next: VttSceneRendererUpdate): void {
    const { scene } = next
    const viewToken = scene.tokens.find((token) => token.id === next.viewTokenId)
    const inputs = { grid: scene.grid, lightingRevision, viewToken }
    if (
      renderedSenses &&
      (Object.keys(inputs) as (keyof typeof inputs)[]).every(
        (key) => renderedSenses?.[key] === inputs[key]
      )
    ) {
      return
    }
    renderedSenses = inputs
    senseReaches = viewToken ? senseReachesOf(scene, viewToken) : []
    const reachOf = (effect: VttSenseEffect) =>
      senseReaches.find((reach) => reach.effect === effect)
    const darkvision = reachOf('DARKVISION')
    const truesight = reachOf('TRUESIGHT')
    const blindsight = reachOf('BLINDSIGHT')
    const baseTexture = darknessTexture
    senseOverlayActive = Boolean(baseTexture && (darkvision || truesight || blindsight))
    greyscaleLayer.visible = Boolean(baseTexture && darkvision)
    if (!baseTexture) return
    if (!senseOverlayActive) {
      darknessSprite.texture = baseTexture
      return
    }
    const { map } = scene
    const wholeMap = wholeMapPolygon(map)
    const scratch: RenderTexture[] = []
    const spriteOf = (
      texture: RenderTexture,
      blendMode: 'erase' | 'max' | 'min' | 'normal'
    ): Sprite => {
      const sprite = new pixi.Sprite({ blendMode, texture })
      sprite.scale.set(map.width / texture.width)
      return sprite
    }
    const compose = (composition: Container): RenderTexture => {
      const texture = pixi.RenderTexture.create({
        height: baseTexture.height,
        width: baseTexture.width
      })
      renderLightingTexture(composition, texture, map)
      composition.destroy({ children: true })
      scratch.push(texture)
      return texture
    }
    /** Opaque everywhere a sense does not reach, so a min against it leaves those points alone. */
    const keepOutside = (reach: VttSenseReach, inside?: RenderTexture): RenderTexture => {
      const composition = new pixi.Container()
      composition.addChild(
        overlayShape(wholeMap, 1, 'max', 'sense-outside', 0xffffff),
        overlayShape(reach.polygon, 1, 'erase', 'sense-reach', 0xffffff)
      )
      if (inside) composition.addChild(spriteOf(inside, 'max'))
      return compose(composition)
    }
    const indicatorTexture = (ordinaryAlpha: number, magical: 'erase' | 'max'): RenderTexture => {
      const composition = new pixi.Container()
      addDarknessIndicator(composition, scene, ordinaryAlpha, magical)
      return compose(composition)
    }
    const view = new pixi.Container()
    view.addChild(spriteOf(baseTexture, 'normal'))
    if (darkvision) {
      // Ordinary darkness becomes dim and dim light bright; magical darkness stays dark.
      view.addChild(
        spriteOf(keepOutside(darkvision, indicatorTexture(dimOverlayAlpha, 'max')), 'min')
      )
    }
    if (truesight) {
      // Ordinary and magical darkness clear; dim light stays dim.
      const clearedDarkness = new pixi.Container()
      clearedDarkness.addChild(
        spriteOf(baseTexture, 'normal'),
        spriteOf(indicatorTexture(1, 'max'), 'erase')
      )
      view.addChild(spriteOf(keepOutside(truesight, compose(clearedDarkness)), 'min'))
    }
    if (blindsight) view.addChild(spriteOf(keepOutside(blindsight), 'min'))
    viewOverlayTexture = textureForMap(viewOverlayTexture, map)
    renderLightingTexture(view, viewOverlayTexture, map)
    view.destroy({ children: true })
    darknessSprite.texture = viewOverlayTexture
    darknessSprite.scale.set(map.width / viewOverlayTexture.width)
    if (darkvision) {
      // Greyscale marks ordinary darkness the darkvision reaches and no better sense clears.
      const newlyLit = new pixi.Container()
      addDarknessIndicator(newlyLit, scene, 1, 'erase')
      newlyLit.addChild(spriteOf(keepOutside(darkvision), 'erase'))
      for (const better of [truesight, blindsight]) {
        if (better) {
          newlyLit.addChild(overlayShape(better.polygon, 1, 'erase', 'sense-better', 0xffffff))
        }
      }
      greyscaleTexture = textureForMap(greyscaleTexture, map)
      renderLightingTexture(newlyLit, greyscaleTexture, map)
      newlyLit.destroy({ children: true })
      greyscaleMask.texture = greyscaleTexture
      greyscaleMask.scale.set(map.width / greyscaleTexture.width)
    }
    for (const texture of scratch) texture.destroy(true)
  }

  /**
   * Hides the tokens the view token cannot perceive: one in darkness is seen only through a sense
   * that reaches it. The view token and a Player's own tokens always show.
   */
  function concealTokens(next: VttSceneRendererUpdate): void {
    const { scene, viewTokenId } = next
    const barrierIndex = lightingBarrierIndex ?? new SceneBarrierIndex(scene.barriers)
    for (const [id, { token, visual }] of tokenVisuals) {
      visual.visible =
        !viewTokenId ||
        id === viewTokenId ||
        (next.role === 'PLAYER' && canControlSceneToken(token, next)) ||
        isTokenRevealed({
          halfSize: Math.max(token.height, token.width) / 2,
          illumination: levelOf(
            resolveSceneIlluminationAt(scene, token.position, barrierIndex, illuminationLevels)
              .illumination
          ),
          illuminationLevels,
          point: token.position,
          reaches: senseReaches
        })
    }
  }

  /** Reads the alpha of a lighting texture at scene points; the texture is extracted once. */
  function textureAlphasAt(texture: RenderTexture | null, points: readonly ScenePoint[]): number[] {
    if (!texture || !current) return points.map(() => 0)
    const ratio = texture.width / current.scene.map.width
    const { height, pixels, width } = app.renderer.extract.pixels({ target: texture })
    return points.map((point) => {
      const x = Math.min(width - 1, Math.max(0, Math.floor(point.x * ratio)))
      const y = Math.min(height - 1, Math.max(0, Math.floor(point.y * ratio)))
      return (pixels[(y * width + x) * 4 + 3] ?? 0) / 255
    })
  }

  function updateCanvasDescription(scene: CampaignSceneStateDto): void {
    const lighting = describeSceneLighting(scene, visionLabels, illuminationLevels)
    app.canvas.setAttribute(
      'aria-description',
      lighting ? `${tokenSummary}. ${lighting}` : tokenSummary
    )
  }

  function drawBarriers(scene: CampaignSceneStateDto): void {
    if (renderedBarriers === scene.barriers && renderedDoorStates === scene.doorStates) return
    if (renderedBarriers !== scene.barriers) {
      destroyChildren(wallLayer)
      for (const barrier of scene.barriers) {
        if (barrier.kind !== 'DOOR') drawBarrier(wallLayer, barrier)
      }
      renderedBarriers = scene.barriers
    }
    const remainingDoorIds = new Set(doorVisuals.keys())
    for (const barrier of scene.barriers) {
      if (barrier.kind !== 'DOOR') continue
      remainingDoorIds.delete(barrier.id)
      const authoritativeState = scene.doorStates[barrier.id] ?? barrier.initialState
      const previewState = doorPreviews.get(barrier.id)
      if (previewState === authoritativeState) doorPreviews.delete(barrier.id)
      const state = previewState ?? authoritativeState
      let entry = doorVisuals.get(barrier.id)
      if (!entry || entry.barrier !== barrier) {
        if (entry) destroyDoorVisuals(entry.visuals)
        const visuals = createDoorVisuals(barrier)
        entry = { barrier, state, visuals }
        doorVisuals.set(barrier.id, entry)
        doorVisualCreateCount += 3
      }
      if (entry.state !== state) {
        entry.state = state
      }
      setDoorVisualState(entry.visuals, state)
    }
    for (const doorId of remainingDoorIds) {
      const entry = doorVisuals.get(doorId)
      if (entry) destroyDoorVisuals(entry.visuals)
      doorVisuals.delete(doorId)
      doorPreviews.delete(doorId)
    }
    renderedDoorStates = scene.doorStates
  }

  function createDoorVisuals(
    barrier: Extract<CampaignSceneStateDto['barriers'][number], { kind: 'DOOR' }>
  ): Record<'CLOSED' | 'LOCKED' | 'OPEN', Graphics> {
    const visuals = {
      CLOSED: new pixi.Graphics(),
      LOCKED: new pixi.Graphics(),
      OPEN: new pixi.Graphics()
    }
    for (const state of ['CLOSED', 'LOCKED', 'OPEN'] as const) {
      drawBarrierGraphic(visuals[state], barrier, state)
      doorLayer.addChild(visuals[state])
    }
    return visuals
  }

  function setDoorVisualState(
    visuals: Record<'CLOSED' | 'LOCKED' | 'OPEN', Graphics>,
    state: 'CLOSED' | 'LOCKED' | 'OPEN'
  ): void {
    for (const candidate of ['CLOSED', 'LOCKED', 'OPEN'] as const) {
      visuals[candidate].visible = candidate === state
    }
  }

  function destroyDoorVisuals(visuals: Record<'CLOSED' | 'LOCKED' | 'OPEN', Graphics>): void {
    for (const visual of Object.values(visuals)) {
      visual.removeFromParent()
      visual.destroy()
    }
  }

  function drawBarrier(
    layer: Container,
    barrier: CampaignSceneStateDto['barriers'][number],
    doorState?: 'CLOSED' | 'LOCKED' | 'OPEN'
  ): void {
    const line = new pixi.Graphics()
    drawBarrierGraphic(line, barrier, doorState)
    layer.addChild(line)
  }

  function drawBarrierGraphic(
    line: Graphics,
    barrier: CampaignSceneStateDto['barriers'][number],
    doorState?: 'CLOSED' | 'LOCKED' | 'OPEN'
  ): void {
    line.clear()
    line.removeAllListeners()
    const isDoor = barrier.kind === 'DOOR'
    const resolvedDoorState = isDoor ? (doorState ?? barrier.initialState) : null
    const end =
      isDoor && resolvedDoorState === 'OPEN'
        ? {
            x:
              barrier.a.x +
              Math.cos((barrier.openAngleDegrees * Math.PI) / 180) * (barrier.b.x - barrier.a.x) -
              Math.sin((barrier.openAngleDegrees * Math.PI) / 180) * (barrier.b.y - barrier.a.y),
            y:
              barrier.a.y +
              Math.sin((barrier.openAngleDegrees * Math.PI) / 180) * (barrier.b.x - barrier.a.x) +
              Math.cos((barrier.openAngleDegrees * Math.PI) / 180) * (barrier.b.y - barrier.a.y)
          }
        : barrier.b
    line
      .moveTo(barrier.a.x, barrier.a.y)
      .lineTo(end.x, end.y)
      .stroke({
        alpha: current?.mode === 'EDIT' || isDoor ? 0.95 : 0.45,
        color:
          isDoor && resolvedDoorState === 'OPEN'
            ? colors.doorOpen
            : isDoor
              ? colors.doorClosed
              : colors.barrier,
        width: 5
      })
    if (isDoor) {
      line.eventMode = 'static'
      line.cursor = resolvedDoorState === 'LOCKED' ? 'not-allowed' : 'pointer'
      line.on('pointertap', (event) => {
        event.stopPropagation()
        if (resolvedDoorState === 'LOCKED') return
        callbacks.onDoorState(barrier.id, resolvedDoorState === 'OPEN' ? 'CLOSED' : 'OPEN')
      })
    }
  }

  function drawMeasurements(scene: CampaignSceneStateDto): void {
    destroyChildren(measurementLayer)
    for (const measurement of scene.measurements) {
      const line = new pixi.Graphics()
      const [first, ...rest] = measurement.path
      if (!first) continue
      line.moveTo(first.x, first.y)
      for (const point of rest) line.lineTo(point.x, point.y)
      line.stroke({ color: colors.measurement, width: 3 })
      const label = measurementLabel(
        measurement.path,
        formatSceneMeasurement(scene.grid, measurement.path)
      )
      measurementLayer.addChild(line, label)
    }
  }

  /**
   * The dragged token's route so far, in the measurement line style and labeled with its distance and
   * cost; gone once the drag ends.
   */
  function drawDragRoute(): void {
    destroyChildren(dragRouteLayer)
    if (!drag || !current) return
    const position = { x: drag.visual.x, y: drag.visual.y }
    const end = drag.path.at(-1)
    const route = end && pointsEqual(end, position) ? drag.path : [...drag.path, position]
    if (route.length < 2) return
    dragRouteLayer.addChild(
      new pixi.Graphics()
        .poly(
          route.flatMap((point) => [point.x, point.y]),
          false
        )
        .stroke({ color: colors.measurement, width: 3 }),
      measurementLabel(route, formatSceneRoute(current.scene, route, routeMover(drag.tokenId)))
    )
  }

  function routeMover(tokenId: string) {
    const pricing = current?.movementCost
    const actorId = pricing?.actorIdByTokenId.get(tokenId)
    return pricing && actorId
      ? { ...pricing, actorId, tokenId, dragDoublesCost: pricing.dragDoublingActorIds.has(actorId) }
      : null
  }

  function tokenCanMove(token: CampaignSceneStateDto['tokens'][number]): boolean {
    return Boolean(current && !token.locked && canControlSceneToken(token, current))
  }

  function movementIndexFor(
    scene: CampaignSceneStateDto,
    token: CampaignSceneStateDto['tokens'][number]
  ): SceneBarrierIndex {
    if (movementBarrierSource !== scene.barriers) {
      movementBarrierSource = scene.barriers
      movementBarrierIndex = new SceneBarrierIndex(scene.barriers)
    }
    return sceneTokenMovementIndex(
      token,
      movementBarrierIndex ?? new SceneBarrierIndex(scene.barriers)
    )
  }

  function drawTokens(
    scene: CampaignSceneStateDto,
    presentations: VttSceneRendererUpdate['tokenPresentations'],
    selectedTokenId: string | null
  ): void {
    if (
      renderedTokens === scene.tokens &&
      renderedTokenPresentations === presentations &&
      renderedSelectedTokenId === selectedTokenId
    )
      return
    const remainingTokenIds = new Set(tokenVisuals.keys())
    for (const token of scene.tokens) {
      remainingTokenIds.delete(token.id)
      const presentation = presentations?.[token.id]
      const appearanceKey = sceneTokenAppearanceKey(token, presentation)
      let entry = tokenVisuals.get(token.id)
      const tokenChanged = entry?.token !== token
      if (!entry || entry.appearanceKey !== appearanceKey) {
        entry?.visual.removeFromParent()
        entry?.visual.destroy({ children: true })
        const visual = createTokenVisual(token, presentation)
        visual.position.set(token.position.x, token.position.y)
        tokenLayer.addChild(visual)
        entry = { appearanceKey, presentation, token, visual }
        tokenVisuals.set(token.id, entry)
      } else if (tokenChanged) {
        entry.token = token
      }
      const outline = entry.visual.getChildByLabel(tokenSelectionLabel)
      if (token.id === selectedTokenId && !outline) addSelectionOutline(entry.visual, token)
      else if (token.id !== selectedTokenId) outline?.destroy()
      if (tokenChanged && (drag?.tokenId !== token.id || drag.visual !== entry.visual)) {
        entry.visual.position.set(token.position.x, token.position.y)
      }
    }
    for (const tokenId of remainingTokenIds) {
      const entry = tokenVisuals.get(tokenId)
      entry?.visual.removeFromParent()
      entry?.visual.destroy({ children: true })
      tokenVisuals.delete(tokenId)
    }
    renderedTokens = scene.tokens
    renderedTokenPresentations = presentations ?? null
    renderedSelectedTokenId = selectedTokenId
    const descriptions = scene.tokens.flatMap((token) => {
      const description = presentations?.[token.id]?.accessibleDescription || token.label
      return [token.id === selectedTokenId ? `${description}, selected` : description]
    })
    tokenSummary = descriptions.length
      ? `Visible tokens: ${descriptions.join('; ')}`
      : 'No visible tokens'
  }

  function createTokenVisual(
    token: CampaignSceneStateDto['tokens'][number],
    presentation: VttTokenPresentation | undefined
  ): Container {
    const visual = new pixi.Container()
    visual.eventMode = 'static'
    visual.cursor = presentation?.targetable ? 'pointer' : tokenCanMove(token) ? 'grab' : 'default'
    visual.on('pointerover', () => callbacks.onTokenHover?.(token.id))
    visual.on('pointerout', () => callbacks.onTokenHover?.(null))
    if (presentation?.halo) {
      const halo = new pixi.Graphics()
        .ellipse(0, 0, token.width / 2 + 8, token.height / 2 + 8)
        .stroke({ alpha: 0.9, color: presentation.halo.color, width: 5 })
      halo.label = `${tokenHaloLabelPrefix}${presentation.halo.label}`
      visual.addChild(halo)
    }
    addFacingArcWedges(pixi, visual, token, presentation?.facingArcs ?? [])
    // The plate spans the footprint; the fill, art and inner ring sit inside it, under the outer ring.
    const body = new pixi.Graphics()
      .ellipse(0, 0, token.width / 2, token.height / 2)
      .fill({ alpha: 0.6, color: 0x101315 })
    body.label = tokenBodyLabel
    visual.addChild(body)
    const insetRadiusX = token.width / 2 - tokenRingInset
    const insetRadiusY = token.height / 2 - tokenRingInset
    const fill = new pixi.Graphics()
      .ellipse(0, 0, insetRadiusX, insetRadiusY)
      .fill({ color: presentation?.fillColor ?? colors.token })
    fill.label = tokenFillLabel
    visual.addChild(fill)
    const ring = new pixi.Graphics()
      .ellipse(0, 0, insetRadiusX, insetRadiusY)
      .stroke({ color: presentation?.outlineColor ?? colors.tokenOutline, width: 3 })
    ring.label = tokenRingLabel
    visual.addChild(ring)
    const label: PixiText = new pixi.Text({
      style: {
        align: 'center',
        fill: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: Math.max(12, Math.min(token.width / 4, 22)),
        fontWeight: '700'
      },
      text: token.label.slice(0, 2).toUpperCase()
    })
    label.anchor.set(0.5)
    visual.addChild(label)
    if (presentation?.artUrl) {
      const artUrl = presentation.artUrl
      void pixi.Assets.load<Texture>(artUrl)
        .then((texture) => {
          loadedTokenArtUrls.add(artUrl)
          if (visual.destroyed) return
          const art = new pixi.Sprite(texture)
          art.anchor.set(0.5)
          art.height = Math.max(1, 2 * insetRadiusY - 4)
          art.width = Math.max(1, 2 * insetRadiusX - 4)
          visual.addChildAt(art, visual.getChildIndex(fill) + 1)
          label.visible = false
          requestRender()
        })
        .catch(() => {
          label.visible = true
        })
    }
    if (presentation?.facing) visual.addChild(createFacingIndicator(pixi, token))
    if (presentation?.marked) {
      const crosshair = new pixi.Graphics()
        .moveTo(-token.width / 2 - 5, 0)
        .lineTo(token.width / 2 + 5, 0)
        .moveTo(0, -token.height / 2 - 5)
        .lineTo(0, token.height / 2 + 5)
        .stroke({ alpha: 0.9, color: 0x22b8cf, width: 2 })
      crosshair.label = tokenCrosshairLabel
      visual.addChild(crosshair)
    }
    if (presentation?.targetable) {
      const targetable = new pixi.Graphics()
        .ellipse(0, 0, token.width / 2 + 14, token.height / 2 + 14)
        .stroke({ alpha: 0.95, color: 0xfab005, width: 3 })
      targetable.label = tokenTargetableLabel
      visual.addChild(targetable)
    }
    addStatusRing(visual, token, presentation?.statuses ?? [])
    visual.on('pointerdown', (event) => {
      if (current?.targeting) {
        if (!presentation?.targetable) return
        event.stopPropagation()
        callbacks.onTokenPick?.(token.id)
        return
      }
      if (current?.tool !== 'SELECT' || current.areaAim || current.squarePick) return
      callbacks.onTokenSelect?.(token.id)
      // A token the member cannot move still lets the press reach the map, so it can ping there.
      if (!tokenCanMove(token)) return
      event.stopPropagation()
      const point = worldPoint(event)
      drag = {
        appearanceKey: sceneTokenAppearanceKey(token, presentation),
        last: { x: visual.x, y: visual.y },
        offset: { x: point.x - visual.x, y: point.y - visual.y },
        origin: { x: token.position.x, y: token.position.y },
        path: [{ x: token.position.x, y: token.position.y }],
        tokenId: token.id,
        visual
      }
      visual.cursor = 'grabbing'
    })
    return visual
  }

  /** What a Graphics actually holds: each fill or stroke instruction's colour and polygon paths. */
  function drawnStyles(
    graphic: Container | null,
    action: 'fill' | 'stroke'
  ): { alpha: number; color: number; paths: ScenePoint[][] }[] {
    if (!(graphic instanceof pixi.Graphics)) return []
    return graphic.context.instructions.flatMap((instruction) => {
      if (instruction.action !== 'fill' && instruction.action !== 'stroke') return []
      if (instruction.action !== action) return []
      return [
        {
          alpha: instruction.data.style.alpha,
          color: instruction.data.style.color,
          paths: instruction.data.path.shapePath.shapePrimitives.flatMap(({ shape }) =>
            shape instanceof pixi.Polygon
              ? [
                  Array.from({ length: shape.points.length / 2 }, (_, index) => ({
                    x: shape.points[index * 2]!,
                    y: shape.points[index * 2 + 1]!
                  }))
                ]
              : []
          )
        }
      ]
    })
  }

  function strokedPath(points: readonly ScenePoint[], color: number, width: number): Graphics {
    return new pixi.Graphics()
      .poly(
        points.flatMap((point) => [point.x, point.y]),
        false
      )
      .stroke({ color, width })
  }

  /** One segment per status around the footprint edge; past the cap the last segment marks overflow. */
  function addStatusRing(
    visual: Container,
    token: CampaignSceneStateDto['tokens'][number],
    statuses: VttTokenPresentation['statuses']
  ): void {
    if (!statuses.length) return
    const overflowing = statuses.length > maxStatusSegments
    const count = Math.min(statuses.length, maxStatusSegments)
    const radiusX = token.width / 2 - outerRingMargin - outerRingWidth / 2
    const radiusY = token.height / 2 - outerRingMargin - outerRingWidth / 2
    const span = (2 * Math.PI) / count
    const gap = count > 1 ? outerRingGap / 2 : 0
    const ring = new pixi.Container()
    ring.label = tokenOuterRingLabel
    for (let index = 0; index < count; index += 1) {
      const path = ellipseArcPoints(
        radiusX,
        radiusY,
        -Math.PI / 2 + index * span + gap,
        -Math.PI / 2 + (index + 1) * span - gap
      )
      const segment = new pixi.Container()
      if (overflowing && index === count - 1) {
        // Hollow, so the overflow reads apart from every category segment without colour.
        segment.label = tokenOverflowSegmentLabel
        segment.addChild(strokedPath(path, statusOverflowColour, outerRingWidth))
        segment.addChild(strokedPath(path, colors.plate, outerRingWidth - 3))
      } else {
        segment.label = tokenSegmentLabel
        segment.addChild(
          strokedPath(path, statusCategoryColours[statuses[index]!.category], outerRingWidth)
        )
      }
      ring.addChild(segment)
    }
    visual.addChild(ring)
  }

  function addSelectionOutline(
    visual: Container,
    token: CampaignSceneStateDto['tokens'][number]
  ): void {
    const outline = dashedOutline(
      ellipseArcPoints(
        token.width / 2 + selectionOutlineOffset,
        token.height / 2 + selectionOutlineOffset,
        0,
        2 * Math.PI
      ),
      10,
      7,
      { color: selectionOutlineColor, width: 3 }
    )
    outline.label = tokenSelectionLabel
    visual.addChild(outline)
  }

  function overlayGraphic(overlay: VttScenePresentationOverlay): Graphics {
    const graphic = new pixi.Graphics()
    if (overlay.kind === 'CIRCLE') {
      graphic
        .circle(overlay.center.x, overlay.center.y, overlay.radius)
        .fill({ alpha: 0.1, color: overlay.color })
        .stroke({ alpha: 0.9, color: overlay.color, width: overlay.purpose === 'TARGET' ? 5 : 3 })
    } else if (overlay.kind === 'PATH') {
      const first = overlay.points[0]
      if (first) graphic.moveTo(first.x, first.y)
      for (const point of overlay.points.slice(1)) graphic.lineTo(point.x, point.y)
      graphic.stroke({ alpha: 0.9, color: overlay.color, width: 4 })
    } else if (overlay.points.length >= 3) {
      graphic
        .poly(overlay.points.flatMap((point) => [point.x, point.y]))
        .fill({ alpha: overlay.purpose === 'TRAP' ? 0.18 : 0.1, color: overlay.color })
        .stroke({ alpha: 0.85, color: overlay.color, width: 3 })
    }
    return graphic
  }

  function drawPresentationOverlays(overlays: VttSceneRendererUpdate['overlays']): void {
    if (renderedOverlays === overlays) return
    destroyChildren(presentationLayer)
    for (const overlay of overlays ?? []) presentationLayer.addChild(overlayGraphic(overlay))
    renderedOverlays = overlays ?? null
  }

  function draw(next: VttSceneRendererUpdate): void {
    requestRender()
    if (
      current &&
      wallChainStart &&
      (current.tool !== next.tool ||
        current.mode !== next.mode ||
        current.scene.id !== next.scene.id)
    ) {
      wallChainStart = null
      gestureStart = null
      destroyChildren(measurementLayer)
    }
    const previous = current
    const activeDrag = drag
    const preserveDrag = Boolean(
      activeDrag &&
      current &&
      canPreserveSceneTokenDrag(current, next, {
        appearanceKey: activeDrag.appearanceKey,
        origin: activeDrag.origin,
        tokenId: activeDrag.tokenId
      })
    )
    const preserveWallChain = Boolean(wallChainStart)
    const hasActiveInteraction = Boolean(activeDrag || wallChainStart || gestureStart || panStart)
    if (hasActiveInteraction && !preserveDrag && !preserveWallChain) {
      cancelActiveInteraction()
    }
    current = next
    // Escape cancels the aim, so the canvas takes focus when it starts.
    if ((!previous?.areaAim && next.areaAim) || (!previous?.targeting && next.targeting)) {
      app.canvas.focus({ preventScroll: true })
    }
    if (previous?.areaAim && !next.areaAim) {
      destroyChildren(measurementLayer)
      drawMeasurements(next.scene)
    }
    if (previous) clearCommittedRemoteTokenDragPreviews(previous.scene, next.scene)
    clearCommittedRemoteFogPreviews(next.scene)
    if (previous && sameSceneRenderInputs(previous, next)) {
      return
    }
    if (drag) {
      const token = next.scene.tokens.find((candidate) => candidate.id === drag?.tokenId)
      if (
        !token ||
        !isSceneMovementPathValid(next.scene, drag.path, movementIndexFor(next.scene, token))
      ) {
        cancelActiveInteraction()
      }
    }
    const nextMapAssetKey =
      next.mapDelivery && isMapDeliveryForScene(next.scene, next.mapDelivery)
        ? `${next.mapDelivery.assetId}:${next.scene.map.width}x${next.scene.map.height}`
        : null
    const nextMapCredentialKey = next.mapDelivery?.expiresAt ?? null
    if (next.mapDelivery && nextMapAssetKey) {
      const mapDecision = resolveVttMapLoadDecision({
        currentAssetKey: mapAssetKey,
        loadedPartIds: [...loadedMapParts.keys()],
        nextAssetKey: nextMapAssetKey,
        requiredPartIds: stableVttMapPartIds(next.mapDelivery)
      })
      if (mapDecision === 'RESET') {
        mapAssetKey = nextMapAssetKey
        mapCredentialKey = nextMapCredentialKey
        drawMap(next.scene, next.mapDelivery)
      } else if (!mapLoadComplete && mapCredentialKey !== nextMapCredentialKey) {
        mapCredentialKey = nextMapCredentialKey
        loadMissingMapParts(next.scene, next.mapDelivery)
      }
    } else if (
      shouldReloadVttMap(
        {
          assetKey: mapAssetKey,
          credentialKey: mapCredentialKey,
          layerEmpty: mapLayer.children.length === 0,
          loadComplete: mapLoadComplete
        },
        { assetKey: nextMapAssetKey, credentialKey: nextMapCredentialKey }
      )
    ) {
      mapAssetKey = nextMapAssetKey
      mapCredentialKey = nextMapCredentialKey
      drawMap(next.scene, next.mapDelivery)
    }
    if (renderedGrid !== next.scene.grid) {
      drawGrid(next.scene)
      renderedGrid = next.scene.grid
    }
    if (
      renderedFogLayers !== next.scene.fogLayers ||
      renderedFogMode !== next.scene.fogMode ||
      renderedFogRole !== next.role
    ) {
      drawFogWithRemotePreviews()
      renderedFogLayers = next.scene.fogLayers
      renderedFogMode = next.scene.fogMode
      renderedFogRole = next.role
    }
    drawLighting(next.scene)
    drawVision(next)
    drawSenses(next)
    drawPresentationOverlays(next.overlays)
    drawTokens(next.scene, next.tokenPresentations, next.selectedTokenId ?? null)
    concealTokens(next)
    updateCanvasDescription(next.scene)
    if (renderedMeasurements !== next.scene.measurements) {
      drawMeasurements(next.scene)
      renderedMeasurements = next.scene.measurements
    }
    drawBarriers(next.scene)
    if (fittedSceneId !== next.scene.id) {
      fittedSceneId = next.scene.id
      showMap(callbacks.resolveSceneZoom?.(next.scene.id) ?? null, 'SCENE')
    }
  }

  function sameSceneRenderInputs(
    previous: VttSceneRendererUpdate,
    next: VttSceneRendererUpdate
  ): boolean {
    return (
      previous.boundTokenControl === next.boundTokenControl &&
      previous.currentUserId === next.currentUserId &&
      previous.mapDelivery === next.mapDelivery &&
      previous.mode === next.mode &&
      previous.role === next.role &&
      previous.tool === next.tool &&
      previous.scene.id === next.scene.id &&
      previous.scene.map === next.scene.map &&
      previous.scene.grid === next.scene.grid &&
      previous.scene.fogLayers === next.scene.fogLayers &&
      previous.scene.fogMode === next.scene.fogMode &&
      previous.scene.barriers === next.scene.barriers &&
      previous.scene.doorStates === next.scene.doorStates &&
      previous.scene.lights === next.scene.lights &&
      previous.scene.ambientIllumination === next.scene.ambientIllumination &&
      previous.scene.darknessZones === next.scene.darknessZones &&
      previous.scene.measurements === next.scene.measurements &&
      previous.scene.tokens === next.scene.tokens &&
      previous.overlays === next.overlays &&
      previous.previewTokenId === next.previewTokenId &&
      previous.selectedTokenId === next.selectedTokenId &&
      previous.tokenPresentations === next.tokenPresentations &&
      previous.targeting === next.targeting &&
      previous.viewTokenId === next.viewTokenId
    )
  }

  function updateGesturePreview(point: ScenePoint): void {
    destroyChildren(measurementLayer)
    if (!current || !gestureStart) return
    if (current.tool === 'MEASURE') {
      gesturePath = [gestureStart, point]
      const line = new pixi.Graphics()
        .moveTo(gestureStart.x, gestureStart.y)
        .lineTo(point.x, point.y)
        .stroke({ color: colors.measurement, width: 3 })
      measurementLayer.addChild(
        line,
        measurementLabel(gesturePath, formatSceneMeasurement(current.scene.grid, gesturePath))
      )
      callbacks.onMeasurementPreview(gesturePath)
      return
    }
    if (current.mode !== 'EDIT') return
    const preview = new pixi.Graphics()
    if (isBarrierTool(current.tool)) {
      const start = current.tool === 'WALL' && wallChainStart ? wallChainStart : gestureStart
      preview
        .moveTo(start.x, start.y)
        .lineTo(point.x, point.y)
        .stroke({ color: current.tool === 'DOOR' ? colors.doorClosed : colors.barrier, width: 5 })
    } else if (
      current.tool === 'DARKNESS' ||
      current.tool === 'FOG_REVEAL' ||
      current.tool === 'FOG_HIDE'
    ) {
      if (current.tool === 'FOG_REVEAL' || current.tool === 'FOG_HIDE') {
        callbacks.onFogAreaPreview?.(current.tool === 'FOG_REVEAL', gestureStart, point)
      }
      preview
        .rect(
          Math.min(gestureStart.x, point.x),
          Math.min(gestureStart.y, point.y),
          Math.abs(point.x - gestureStart.x),
          Math.abs(point.y - gestureStart.y)
        )
        .fill({
          alpha: 0.45,
          color: current.tool === 'FOG_REVEAL' ? colors.measurement : colors.darkness
        })
    }
    measurementLayer.addChild(preview)
  }

  app.stage.on('pointerdown', (event) => {
    requestRender()
    if (!current) return
    const point = worldPoint(event)
    if (current.targeting && event.button === 0) return
    if (event.button === 0 && areaAimGesture.press(point)) return
    if (current.tool === 'PAN' || event.button === 1) {
      panStart = {
        pointer: { x: event.global.x, y: event.global.y },
        world: { x: world.x, y: world.y }
      }
      // A pan held in place pings; moving past the tolerance pans instead.
      if (event.button === 0) pingPress.start({ x: event.global.x, y: event.global.y }, point)
      return
    }
    if (current.mode === 'EDIT' && current.tool === 'LIGHT') {
      callbacks.onCreateLight(point)
      return
    }
    if (current.mode === 'EDIT' && current.tool === 'TOKEN') {
      callbacks.onCreateToken(point)
      return
    }
    if (current.mode === 'EDIT' && current.tool === 'ANNOTATION') {
      callbacks.onCreateAnnotation?.(point)
      return
    }
    if (current.mode === 'EDIT' && current.tool === 'WALL' && event.button === 0) {
      if (!wallChainStart) {
        wallChainStart = point
      } else if (!pointsEqual(wallChainStart, point)) {
        callbacks.onCreateBarrier('WALL', wallChainStart, point)
        wallChainStart = point
      }
      gestureStart = wallChainStart
      gesturePath = [wallChainStart]
      return
    }
    if (
      current.tool === 'MEASURE' ||
      (current.mode === 'EDIT' &&
        (isBarrierTool(current.tool) ||
          current.tool === 'DARKNESS' ||
          current.tool === 'FOG_REVEAL' ||
          current.tool === 'FOG_HIDE'))
    ) {
      gestureStart = point
      gesturePath = [point]
      return
    }
    // A press on the empty map clears the selection; one on a token, at any depth of its
    // visual, has already selected it.
    if (
      event.button === 0 &&
      current.tool === 'SELECT' &&
      !isWithinTokenVisual(event.target, tokenLayer)
    ) {
      callbacks.onTokenSelect?.(null)
    }
    // A primary press on the map outside another gesture pings once held in place.
    if (event.button === 0) pingPress.start({ x: event.global.x, y: event.global.y }, point)
  })

  app.stage.on('globalpointermove', (event) => {
    pingPress.move({ x: event.global.x, y: event.global.y })
    if (panStart || drag || gestureStart || current?.areaAim) requestRender()
    if (current?.areaAim && !panStart) {
      destroyChildren(measurementLayer)
      const { casterTokenId, size } = current.areaAim
      const aim = areaAimGesture.aimAt(worldPoint(event))
      const caster = current.scene.tokens.find((token) => token.id === casterTokenId) ?? null
      const overlay = aim ? areaOverlay(size, aim, caster) : null
      if (overlay) measurementLayer.addChild(overlayGraphic(overlay))
      return
    }
    if (panStart) {
      world.position.set(
        panStart.world.x + event.global.x - panStart.pointer.x,
        panStart.world.y + event.global.y - panStart.pointer.y
      )
      return
    }
    const point = worldPoint(event)
    if (drag) {
      const token = current?.scene.tokens.find((candidate) => candidate.id === drag?.tokenId)
      if (!token || !current) return
      const position = resolveSceneTokenMove(
        current.scene,
        token,
        drag.last,
        { x: point.x - drag.offset.x, y: point.y - drag.offset.y },
        movementIndexFor(current.scene, token)
      )
      drag.visual.position.set(position.x, position.y)
      if (positionKey(position) !== positionKey(drag.last)) {
        drag.path = extendSceneMovementPath(
          current.scene,
          drag.path,
          position,
          movementIndexFor(current.scene, token)
        )
        drag.last = position
        callbacks.onTokenPreview(drag.tokenId, position)
      }
      drawDragRoute()
      return
    }
    if (gestureStart) updateGesturePreview(point)
  })

  app.stage.on('pointerup', (event) => {
    requestRender()
    pingPress.end()
    panStart = null
    if (areaAimGesture.release(worldPoint(event))) return
    if (drag) {
      const completed = drag
      drag = null
      drawDragRoute()
      completed.visual.cursor = 'grab'
      if (!pointsEqual(completed.last, completed.origin)) {
        callbacks.onTokenCommit(completed.tokenId, completed.path)
      }
      return
    }
    if (!current || !gestureStart) return
    const start = gestureStart
    const end = worldPoint(event)
    gestureStart = null
    destroyChildren(measurementLayer)
    drawMeasurements(current.scene)
    if (current.tool === 'MEASURE') callbacks.onMeasurementCommit([start, end])
    if (current.mode === 'EDIT' && current.tool === 'WALL') {
      gestureStart = wallChainStart
      return
    }
    if (current.mode === 'EDIT' && isBarrierTool(current.tool)) {
      callbacks.onCreateBarrier(current.tool, start, end)
    }
    if (current.mode === 'EDIT' && current.tool === 'DARKNESS') {
      callbacks.onCreateDarkness(start, end)
    }
    if (current.mode === 'EDIT' && (current.tool === 'FOG_REVEAL' || current.tool === 'FOG_HIDE')) {
      callbacks.onFogArea?.(current.tool === 'FOG_REVEAL', start, end)
    }
  })
  app.stage.on('pointerupoutside', () => {
    cancelActiveInteraction()
  })

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    const bounds = app.canvas.getBoundingClientRect()
    const pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
    zoomAt(event.deltaY < 0 ? zoomFactor : 1 / zoomFactor, pointer)
  }
  app.canvas.addEventListener('wheel', onWheel, { passive: false })
  const onKeyDown = (event: KeyboardEvent) => {
    if (isVttPingKey(event)) {
      event.preventDefault()
      pingViewCentre()
      return
    }
    if (current?.areaAim && event.key === 'Escape') {
      event.preventDefault()
      areaAimGesture.cancel()
      callbacks.onAreaAimCancel?.()
      return
    }
    if (current?.targeting && event.key === 'Escape') {
      event.preventDefault()
      callbacks.onTargetingCancel?.()
      return
    }
    if (!current || current.tool !== 'WALL' || !wallChainStart) return
    requestRender()
    if (event.key === 'Escape') {
      event.preventDefault()
      wallChainStart = null
      gestureStart = null
      destroyChildren(measurementLayer)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      wallChainStart = null
      gestureStart = null
      destroyChildren(measurementLayer)
    }
  }
  const onContextMenu = (event: MouseEvent) => {
    // A touch long press pings instead of opening the browser's context menu.
    if (event instanceof PointerEvent && event.pointerType === 'touch') {
      event.preventDefault()
      return
    }
    if (!current || current.tool !== 'WALL' || !wallChainStart) return
    event.preventDefault()
    wallChainStart = null
    gestureStart = null
    destroyChildren(measurementLayer)
    requestRender()
  }
  app.canvas.addEventListener('keydown', onKeyDown)
  app.canvas.addEventListener('contextmenu', onContextMenu)

  const onTouchPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return
    touchPointers.set(event.pointerId, { x: event.offsetX, y: event.offsetY })
    app.canvas.setPointerCapture(event.pointerId)
    if (touchPointers.size === 2) {
      cancelActiveInteraction()
      pinchDistance = touchDistance()
    }
  }

  const onTouchPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || !touchPointers.has(event.pointerId)) return
    touchPointers.set(event.pointerId, { x: event.offsetX, y: event.offsetY })
    if (touchPointers.size < 2) return
    event.preventDefault()
    const distance = touchDistance()
    if (!distance) return
    if (pinchDistance && pinchDistance > 0) {
      zoomAt(distance / pinchDistance, touchMidpoint())
    }
    pinchDistance = distance
  }

  const onTouchPointerEnd = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return
    touchPointers.delete(event.pointerId)
    if (app.canvas.hasPointerCapture(event.pointerId)) {
      app.canvas.releasePointerCapture(event.pointerId)
    }
    if (touchPointers.size < 2) pinchDistance = null
  }

  // Pixi hit-tests against transforms it computes when it renders, so a press or hover first renders a
  // pending frame, or it could miss a token rebuilt since the last one. Pixi listens for moves on the
  // document in the capture phase, so only a window capture listener runs before it.
  const renderPendingFrame = (event: PointerEvent) => {
    if (framePending && event.target instanceof Node && host.contains(event.target)) {
      app.render()
    }
  }

  globalThis.addEventListener('pointerdown', renderPendingFrame, { capture: true })
  globalThis.addEventListener('pointermove', renderPendingFrame, { capture: true })
  app.canvas.addEventListener('pointerdown', onTouchPointerDown)
  app.canvas.addEventListener('pointermove', onTouchPointerMove, { passive: false })
  app.canvas.addEventListener('pointerup', onTouchPointerEnd)
  app.canvas.addEventListener('pointercancel', onTouchPointerEnd)
  app.canvas.addEventListener('lostpointercapture', onTouchPointerEnd)

  return {
    applyTransient(message) {
      requestRender()
      // A ping is one message about a map point, so it stays valid across Scene versions.
      if (message.envelope.kind === 'PING') {
        if (current?.scene.id === message.envelope.sceneId)
          showPing(message.userId, message.envelope.position)
        return
      }
      if (
        !current ||
        message.envelope.sceneId !== current.scene.id ||
        message.envelope.baselineVersion !== current.scene.version
      )
        return
      const key = `${message.userId}:${message.envelope.kind}:${message.envelope.kind === 'TOKEN_DRAG_PREVIEW' ? message.envelope.tokenId : ''}`
      const timeout = transientTimeouts.get(key)
      if (timeout) clearTimeout(timeout)
      transientTimeouts.delete(key)
      if (message.envelope.kind === 'TOKEN_DRAG_PREVIEW') {
        const visionLayers = message.visionLayers ?? []
        const hadVisionLayers = remoteVisionLayers.has(key)
        if (visionLayers.length > 0) {
          remoteVisionLayers.set(key, {
            baselineVersion: message.envelope.baselineVersion,
            layers: visionLayers
          })
        } else {
          remoteVisionLayers.delete(key)
        }
        const hadVisionReveal = remoteVisionReveals.has(key)
        if (message.visionReveal) {
          remoteVisionReveals.set(key, {
            baselineVersion: message.envelope.baselineVersion,
            reveal: message.visionReveal
          })
        } else {
          remoteVisionReveals.delete(key)
        }
        if (visionLayers.length > 0 || hadVisionLayers) drawFogWithRemotePreviews()
        if (message.visionReveal || hadVisionReveal) drawVisionReveals()
        if (message.userId === current?.currentUserId) {
          if (message.tokenDragResolution?.accepted === false && drag) {
            const accepted = message.tokenDragResolution.path.at(-1)
            if (drag.tokenId === message.envelope.tokenId && accepted) {
              drag.path = message.tokenDragResolution.path
              drag.last = accepted
              drag.visual.position.set(accepted.x, accepted.y)
              drawDragRoute()
            }
          }
          transientTimeouts.set(
            key,
            setTimeout(() => clearTransientVisual(key), transientVisualLifetimeMs)
          )
          return
        }
      }
      if (message.envelope.kind === 'FOG_AREA_PREVIEW') {
        if (
          current?.role === 'PLAYER' &&
          message.envelope.ownerUserId !== null &&
          message.envelope.ownerUserId !== current.currentUserId
        ) {
          return
        }
        remoteFogPreviews.set(key, message.envelope)
        drawFogWithRemotePreviews()
        transientTimeouts.set(
          key,
          setTimeout(() => clearTransientVisual(key), transientVisualLifetimeMs)
        )
        return
      }
      if (message.envelope.kind === 'TOKEN_DRAG_PREVIEW') {
        const { position, tokenId } = message.envelope
        const token = current?.scene.tokens.find((candidate) => candidate.id === tokenId)
        if (token) {
          let visual = transientVisuals.get(key)
          if (!visual) {
            const graphic = new pixi.Graphics()
              .ellipse(0, 0, token.width / 2, token.height / 2)
              .stroke({ alpha: 0.8, color: colors.measurement, width: 3 })
            visual = { container: graphic, kind: 'TOKEN_DRAG_PREVIEW' }
            transientLayer.addChild(graphic)
            transientVisuals.set(key, visual)
          }
          if (visual.kind !== 'TOKEN_DRAG_PREVIEW') return
          const preview = remoteTokenDragPreviews.get(key)
          if (preview) {
            preview.target = position
            preview.sequence = message.envelope.sequence
          } else {
            const initial = { x: token.position.x, y: token.position.y }
            remoteTokenDragPreviews.set(key, {
              current: initial,
              graphic: visual.container,
              target: position,
              tokenId: token.id,
              sequence: message.envelope.sequence,
              renderedSequence: null
            })
            positionRemoteTokenDragPreview(visual.container, initial)
          }
        }
      } else if (message.envelope.kind === 'MEASUREMENT_PREVIEW' && message.envelope.path) {
        let visual = transientVisuals.get(key)
        if (!visual) {
          const container = new pixi.Container()
          visual = { container, kind: 'MEASUREMENT_PREVIEW', segments: [] }
          transientLayer.addChild(container)
          transientVisuals.set(key, visual)
        }
        if (visual.kind !== 'MEASUREMENT_PREVIEW') return
        positionMeasurementPreview(visual, message.envelope.path)
      }
      transientTimeouts.set(
        key,
        setTimeout(() => clearTransientVisual(key), transientVisualLifetimeMs)
      )
    },
    destroy() {
      mapGeneration += 1
      destroyChildren(mapLayer)
      destroyChildren(greyMapLayer)
      releaseMapAssets()
      for (const url of loadedTokenArtUrls) void pixi.Assets.unload(url)
      loadedTokenArtUrls.clear()
      pingPress.end()
      clearTransientVisuals()
      app.ticker.remove(onTickerUpdate)
      app.renderer.runners.postrender.remove(previewRenderObserver)
      fogTexture?.destroy(true)
      fogTexture = null
      darknessClassMap?.destroy({ children: true })
      darknessTexture?.destroy(true)
      viewOverlayTexture?.destroy(true)
      greyscaleTexture?.destroy(true)
      sightMaskTexture?.destroy(true)
      app.canvas.removeEventListener('wheel', onWheel)
      app.canvas.removeEventListener('keydown', onKeyDown)
      app.canvas.removeEventListener('contextmenu', onContextMenu)
      globalThis.removeEventListener('pointerdown', renderPendingFrame, { capture: true })
      globalThis.removeEventListener('pointermove', renderPendingFrame, { capture: true })
      app.canvas.removeEventListener('pointerdown', onTouchPointerDown)
      app.canvas.removeEventListener('pointermove', onTouchPointerMove)
      app.canvas.removeEventListener('pointerup', onTouchPointerEnd)
      app.canvas.removeEventListener('pointercancel', onTouchPointerEnd)
      app.canvas.removeEventListener('lostpointercapture', onTouchPointerEnd)
      app.destroy(true, { children: true })
    },
    fit,
    focusPoint,
    focusToken,
    getDiagnostics() {
      return {
        activeDrag: drag
          ? {
              pointCount: drag.path.length,
              position: { x: drag.visual.x, y: drag.visual.y },
              route: drawnStyles(dragRouteLayer.children[0] ?? null, 'stroke')[0]?.paths[0] ?? []
            }
          : null,
        doorVisualCreateCount,
        dragRouteLabel:
          dragRouteLayer.children.find((child): child is PixiText => child instanceof pixi.Text)
            ?.text ?? null,
        dragRouteLineCount: dragRouteLayer.children.filter((child) => !(child instanceof pixi.Text))
          .length,
        facingIndicatorCount: [...tokenVisuals.values()].filter(({ visual }) =>
          visual.getChildByLabel(tokenFacingLabel)
        ).length,
        fogRenderCount,
        lighting: {
          ambientIllumination: renderedAmbient,
          brightLightCount: drawnCount(lightTintLayer, lightTintBrightLabel),
          darknessZones: {
            dim: drawnCount(darknessClassMap, `${darknessZoneLabelPrefix}DIM`),
            heavyObscured: drawnCount(obscurementLayer, `${obscurementLabelPrefix}HEAVY`),
            lightObscured: drawnCount(obscurementLayer, `${obscurementLabelPrefix}LIGHT`),
            magical: drawnCount(darknessClassMap, darknessZoneSuppressingLabel),
            ordinary: drawnCount(darknessClassMap, `${darknessZoneLabelPrefix}DARK`),
            unspecified: drawnCount(obscurementLayer, `${darknessZoneLabelPrefix}VISUAL`)
          },
          dimLightCount: drawnCount(lightTintLayer, lightTintDimLabel),
          lightTints: lightTintLayer.children.flatMap((child) => {
            const fill = drawnStyles(child, 'fill')[0]
            return fill
              ? [
                  {
                    alpha: fill.alpha,
                    color: fill.color,
                    polygonCount: fill.paths.length,
                    radius:
                      child.label === lightTintBrightLabel ? ('bright' as const) : ('dim' as const)
                  }
                ]
              : []
          }),
          visionCount: sightPolygonCount,
          visualZoneAlphas: obscurementLayer.children
            .filter((child) => child.label === `${darknessZoneLabelPrefix}VISUAL`)
            .flatMap((child) => drawnStyles(child, 'fill').map((fill) => fill.alpha))
        },
        loadedMapAssetCount: loadedMapUrls.size,
        mapLoadComplete,
        overlayCount: renderedOverlays?.length ?? 0,
        sceneVersion: current?.scene.version ?? null,
        tokenArtCount: [...tokenVisuals.values()].filter((entry) => entry.presentation?.artUrl)
          .length,
        tokenOverflowCount: [...tokenVisuals.values()].filter(({ visual }) =>
          visual.getChildByLabel(tokenOuterRingLabel)?.getChildByLabel(tokenOverflowSegmentLabel)
        ).length,
        tokenStatusCount: [...tokenVisuals.values()].reduce(
          (total, entry) => total + (entry.presentation?.statuses.length ?? 0),
          0
        ),
        tokenVisualCount: tokenVisuals.size,
        tokens: [...tokenVisuals].map(([id, { visual }]) => {
          const body = visual.getChildByLabel(tokenBodyLabel)?.getLocalBounds()
          const facing = visual.getChildByLabel(tokenFacingLabel)
          const outerRing = visual.getChildByLabel(tokenOuterRingLabel)
          const outerBounds = outerRing?.getLocalBounds()
          const innerBounds = visual.getChildByLabel(tokenRingLabel)?.getLocalBounds()
          const halo = visual.children.find((child) =>
            child.label?.startsWith(tokenHaloLabelPrefix)
          )
          const selection = visual.getChildByLabel(tokenSelectionLabel)
          const selectionStroke = drawnStyles(selection, 'stroke')[0]
          const haloColor = drawnStyles(halo ?? null, 'stroke')[0]?.color
          return {
            bodyFillColor:
              drawnStyles(visual.getChildByLabel(tokenFillLabel), 'fill')[0]?.color ?? null,
            crosshairDrawn: visual.getChildByLabel(tokenCrosshairLabel) !== null,
            facingArcs: facingArcDiagnostics(
              visual,
              (wedge) => drawnStyles(wedge, 'fill')[0]?.paths[0] ?? []
            ),
            facingRotationDegrees: facing ? (facing.rotation * 180) / Math.PI : null,
            footprint: { height: body?.height ?? 0, width: body?.width ?? 0 },
            halo:
              halo && haloColor !== undefined
                ? { color: haloColor, label: halo.label.slice(tokenHaloLabelPrefix.length) }
                : null,
            id,
            targetableDrawn: visual.getChildByLabel(tokenTargetableLabel) !== null,
            innerRing: {
              height: innerBounds?.height ?? 0,
              width: innerBounds?.width ?? 0,
              x: innerBounds?.x ?? 0,
              y: innerBounds?.y ?? 0
            },
            outerRing: {
              height: outerBounds?.height ?? 0,
              width: outerBounds?.width ?? 0,
              x: outerBounds?.x ?? 0,
              y: outerBounds?.y ?? 0
            },
            position: { x: visual.x, y: visual.y },
            ringColor:
              drawnStyles(visual.getChildByLabel(tokenRingLabel), 'stroke')[0]?.color ?? null,
            rotationDegrees: visual.angle,
            selection: selectionStroke
              ? { color: selectionStroke.color, dashSegmentCount: selectionStroke.paths.length }
              : null,
            statusSegments: (outerRing?.children ?? []).flatMap((segment) => {
              const color = drawnStyles(segment.children[0] ?? null, 'stroke')[0]?.color
              return color === undefined
                ? []
                : [{ color, overflow: segment.label === tokenOverflowSegmentLabel }]
            }),
            visible: visual.visible
          }
        }),
        transientVisualCount: transientVisuals.size + pings.size,
        zoomScale: world.scale.x
      }
    },
    sampleDarkness(points) {
      const darkness = textureAlphasAt(
        senseOverlayActive ? viewOverlayTexture : darknessTexture,
        points
      )
      const hidden = textureAlphasAt(sightMaskSprite.visible ? sightMaskTexture : null, points)
      const grey = textureAlphasAt(greyscaleLayer.visible ? greyscaleTexture : null, points)
      return points.map((point, index) => ({
        alpha: (darkness[index] ?? 0) * darknessSprite.alpha,
        greyscale: (grey[index] ?? 0) > 0.5,
        masked: (hidden[index] ?? 0) > 0.5,
        point
      }))
    },
    previewDoorState(barrierId, state) {
      const entry = doorVisuals.get(barrierId)
      if (!entry) return
      requestRender()
      if (state) {
        doorPreviews.set(barrierId, state)
        setDoorVisualState(entry.visuals, state)
        return
      }
      doorPreviews.delete(barrierId)
      const authoritativeState = current?.scene.doorStates[barrierId] ?? entry.barrier.initialState
      setDoorVisualState(entry.visuals, authoritativeState)
    },
    retryMap(delivery) {
      if (!current || !isMapDeliveryForScene(current.scene, delivery)) return
      const assetKey = `${delivery.assetId}:${current.scene.map.width}x${current.scene.map.height}`
      if (mapAssetKey !== assetKey) return
      mapCredentialKey = delivery.expiresAt
      loadMissingMapParts(current.scene, delivery)
    },
    setZoomScale,
    update: draw,
    zoomIn: () => zoomAtCanvasCenter(zoomFactor),
    zoomOut: () => zoomAtCanvasCenter(1 / zoomFactor)
  }

  function clearTransientVisual(key: string): void {
    const timeout = transientTimeouts.get(key)
    if (timeout) clearTimeout(timeout)
    transientTimeouts.delete(key)
    remoteTokenDragPreviews.delete(key)
    const clearedFogPreview = remoteFogPreviews.delete(key)
    const clearedVisionPreview = remoteVisionLayers.delete(key)
    const clearedVisionReveal = remoteVisionReveals.delete(key)
    const visual = transientVisuals.get(key)
    if (visual) {
      visual.container.removeFromParent()
      visual.container.destroy({ children: true })
    }
    transientVisuals.delete(key)
    if (clearedFogPreview || clearedVisionPreview) drawFogWithRemotePreviews()
    if (clearedVisionReveal) drawVisionReveals()
    requestRender()
  }

  function cancelActiveInteraction(): void {
    requestRender()
    pingPress.end()
    panStart = null
    areaAimGesture.cancel()
    gestureStart = null
    wallChainStart = null
    gesturePath = []
    if (drag) {
      const activeDrag = drag
      const token = current?.scene.tokens.find((candidate) => candidate.id === activeDrag.tokenId)
      if (token) activeDrag.visual.position.set(token.position.x, token.position.y)
      activeDrag.visual.cursor = 'grab'
      drag = null
      drawDragRoute()
    }
    if (current) drawMeasurements(current.scene)
  }

  function clearTransientVisuals(): void {
    for (const key of transientVisuals.keys()) clearTransientVisual(key)
    for (const key of remoteFogPreviews.keys()) clearTransientVisual(key)
    for (const key of remoteVisionLayers.keys()) clearTransientVisual(key)
    for (const key of remoteVisionReveals.keys()) clearTransientVisual(key)
    for (const userId of pings.keys()) clearPing(userId)
  }

  function clearCommittedRemoteFogPreviews(nextScene: CampaignSceneStateDto): void {
    for (const [key, preview] of remoteFogPreviews) {
      if (preview.baselineVersion !== nextScene.version) clearTransientVisual(key)
    }
    for (const [key, preview] of remoteVisionLayers) {
      if (preview.baselineVersion !== nextScene.version) clearTransientVisual(key)
    }
    for (const [key, preview] of remoteVisionReveals) {
      if (preview.baselineVersion !== nextScene.version) clearTransientVisual(key)
    }
  }

  function clearCommittedRemoteTokenDragPreviews(
    previousScene: CampaignSceneStateDto,
    nextScene: CampaignSceneStateDto
  ): void {
    for (const [key, preview] of remoteTokenDragPreviews) {
      if (hasCommittedSceneTokenPositionChanged(previousScene, nextScene, preview.tokenId)) {
        clearTransientVisual(key)
      }
    }
  }

  function positionRemoteTokenDragPreview(graphic: Graphics, position: ScenePoint): void {
    graphic.position.set(position.x, position.y)
  }

  function positionMeasurementPreview(
    visual: { container: Container; segments: Graphics[] },
    path: ScenePoint[]
  ): void {
    const segmentCount = Math.max(0, path.length - 1)
    while (visual.segments.length < segmentCount) {
      const segment = new pixi.Graphics()
        .moveTo(0, 0)
        .lineTo(1, 0)
        .stroke({ alpha: 0.8, color: colors.measurement, width: 3 })
      visual.container.addChild(segment)
      visual.segments.push(segment)
    }
    for (let index = 0; index < visual.segments.length; index += 1) {
      const segment = visual.segments[index]!
      const start = path[index]
      const end = path[index + 1]
      segment.visible = Boolean(start && end)
      if (!start || !end) continue
      const dx = end.x - start.x
      const dy = end.y - start.y
      segment.position.set(start.x, start.y)
      segment.rotation = Math.atan2(dy, dx)
      segment.scale.set(Math.hypot(dx, dy), 1)
    }
  }

  function touchDistance(): number {
    const [first, second] = [...touchPointers.values()]
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0
  }

  function touchMidpoint(): ScenePoint {
    const [first, second] = [...touchPointers.values()]
    if (!first || !second) return { x: app.screen.width / 2, y: app.screen.height / 2 }
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
  }

  function releaseMapAssets(): void {
    for (const url of loadedMapUrls) void pixi.Assets.unload(url)
    loadedMapUrls.clear()
    loadedMapParts.clear()
    pendingMapPartUrls.clear()
    mapPartRequestIds.clear()
    mapExpectedPartIds.clear()
    overviewLayer = null
    tileLayer = null
    greyOverviewLayer = null
    greyTileLayer = null
  }

  function measurementLabel(path: readonly ScenePoint[], text: string): PixiText {
    const first = path[0]!
    const last = path[path.length - 1]!
    const label: PixiText = new pixi.Text({
      style: {
        fill: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fontWeight: '700',
        stroke: { color: '#101315', width: 4 }
      },
      text
    })
    label.anchor.set(0.5, 1)
    label.position.set((first.x + last.x) / 2, (first.y + last.y) / 2 - 6)
    return label
  }
}
