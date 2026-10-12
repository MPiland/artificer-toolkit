import type { SignedVttMapDeliveryDto } from '@artificer-toolkit/schema/api/media'
import type { LiveSessionTransientBroadcastDto } from '@artificer-toolkit/schema/api/liveSessions'
import type {
  CampaignSceneStateDto,
  SceneTransientEnvelopeDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  applySceneDelta,
  createSceneFogAreaPatch,
  extendSceneMovementPath,
  isSceneMovementPathValid,
  SceneBarrierIndex,
  visibilityPolygonForLight,
  type ScenePoint,
  type SpatialPointAreaShape
} from '@artificer-toolkit/shared/vtt'
import type {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Text as PixiText,
  Texture
} from 'pixi.js'
import {
  buildVttFogMask,
  canControlSceneToken,
  canPreserveSceneTokenDrag,
  formatSceneMeasurement,
  hasCommittedSceneTokenPositionChanged,
  interpolateScenePoint,
  pointAreaOverlay,
  positionVttMapTiles,
  resolveVttMapLoadDecision,
  resolveSceneTokenMove,
  resolveVttZoomScale,
  sceneTokenAppearanceKey,
  stableVttMapPartIds,
  shouldReloadVttMap,
  visibleGridLinePositions,
  type VttScenePresentationOverlay,
  type VttTokenPresentation
} from './vttSceneRenderer.model'
import { createVttPingPress, isVttPingKey, vttPingRingFrame } from './vttPing'

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
  /** The caster clicked the map while aiming an area. */
  onAreaPoint?: (point: ScenePoint) => void
  /** The caster pressed Escape while aiming an area. */
  onAreaAimCancel?: () => void
  onMapLoadStatus?: (status: VttMapLoadStatus) => void
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
  onTokenPreview: (tokenId: string, position: ScenePoint) => void
}

export type VttMapLoadStatus = 'ERROR' | 'LOADING' | 'READY'

export interface VttSceneRendererUpdate {
  /** While set, the pointer aims this area: a preview follows it and a click picks its origin. */
  areaAim?: { shape: SpatialPointAreaShape } | null
  boundTokenControl: ReadonlyMap<string, boolean>
  currentUserId: string
  mapDelivery: SignedVttMapDeliveryDto | null
  mode: CampaignVttMode
  overlays?: readonly VttScenePresentationOverlay[]
  role: 'OWNER' | 'PLAYER'
  scene: CampaignSceneStateDto
  tokenPresentations?: Readonly<Record<string, VttTokenPresentation>>
  tool: CampaignVttTool
}

export interface VttSceneRenderer {
  applyTransient: (message: LiveSessionTransientBroadcastDto) => void
  destroy: () => void
  fit: () => void
  focusPoint: (point: ScenePoint) => void
  getDiagnostics: () => {
    doorVisualCreateCount: number
    facingIndicatorCount: number
    fogRenderCount: number
    loadedMapAssetCount: number
    mapLoadComplete: boolean
    overlayCount: number
    sceneVersion: number | null
    tokenArtCount: number
    tokenOverflowCount: number
    tokenStatusCount: number
    tokenVisualCount: number
    transientVisualCount: number
    zoomScale: number
  }
  previewDoorState: (barrierId: string, state: 'CLOSED' | 'LOCKED' | 'OPEN' | null) => void
  retryMap: (delivery: SignedVttMapDeliveryDto) => void
  update: (next: VttSceneRendererUpdate) => void
  zoomIn: () => void
  zoomOut: () => void
}

const colors = {
  barrier: 0xe7eaf0,
  darkness: 0x08090b,
  doorClosed: 0xec8c06,
  doorOpen: 0x6bd8cb,
  grid: 0xffffff,
  mapFallback: 0x20252a,
  measurement: 0x6bd8cb,
  ping: 0x6bd8cb,
  token: 0xec8c06,
  tokenOutline: 0xffffff
} as const

const transientVisualLifetimeMs = 1_200
const visibleTokenStatusLimit = 4
const zoomFactor = 1.1

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

function destroyChildren(container: Container): void {
  for (const child of container.removeChildren()) child.destroy({ children: true })
}

function positionKey(point: ScenePoint): string {
  return `${Math.round(point.x)}:${Math.round(point.y)}`
}

function pointsEqual(left: ScenePoint, right: ScenePoint): boolean {
  return left.x === right.x && left.y === right.y
}

function distanceToSegment(point: ScenePoint, a: ScenePoint, b: ScenePoint): number {
  const deltaX = b.x - a.x
  const deltaY = b.y - a.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const progress = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * deltaX + (point.y - a.y) * deltaY) / lengthSquared)
  )
  return Math.hypot(point.x - (a.x + progress * deltaX), point.y - (a.y + progress * deltaY))
}

export async function createVttSceneRenderer(
  host: HTMLElement,
  callbacks: VttSceneRendererCallbacks
): Promise<VttSceneRenderer> {
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
  const gridLayer = new pixi.Container()
  const fogLayer = new pixi.Container()
  const lightLayer = new pixi.Container()
  const darknessLayer = new pixi.Container()
  const presentationLayer = new pixi.Container()
  const tokenLayer = new pixi.Container()
  const measurementLayer = new pixi.Container()
  const wallLayer = new pixi.Container()
  const doorLayer = new pixi.Container()
  const visionRevealLayer = new pixi.Container()
  const transientLayer = new pixi.Container()
  world.addChild(
    mapLayer,
    gridLayer,
    fogLayer,
    lightLayer,
    darknessLayer,
    presentationLayer,
    tokenLayer,
    measurementLayer,
    wallLayer,
    doorLayer,
    visionRevealLayer,
    transientLayer
  )
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
  let renderedLightingDoorStates: CampaignSceneStateDto['doorStates'] | null = null
  let renderedMeasurements: CampaignSceneStateDto['measurements'] | null = null
  let renderedTokens: CampaignSceneStateDto['tokens'] | null = null
  let renderedTokenPresentations: VttSceneRendererUpdate['tokenPresentations'] | null = null
  let renderedOverlays: VttSceneRendererUpdate['overlays'] | null = null
  let lightingBarrierIndex: SceneBarrierIndex | null = null
  let movementBarrierIndex: SceneBarrierIndex | null = null
  let movementBarrierSource: CampaignSceneStateDto['barriers'] | null = null
  let fittedSceneId: string | null = null
  let panStart: { pointer: ScenePoint; world: ScenePoint } | null = null
  let gestureStart: ScenePoint | null = null
  let gesturePath: ScenePoint[] = []
  let wallChainStart: ScenePoint | null = null
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
  const lightVisuals = new Map<string, Graphics>()
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
  const requestRender = () => app.ticker.start()
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

  function fit(): void {
    if (!current) return
    const { height, width } = current.scene.map
    const scale = Math.min(app.screen.width / width, app.screen.height / height) * 0.94
    world.scale.set(Math.max(0.02, Math.min(scale, 8)))
    world.position.set(
      (app.screen.width - width * world.scale.x) / 2,
      (app.screen.height - height * world.scale.y) / 2
    )
    requestRender()
  }

  function focusPoint(point: ScenePoint): void {
    world.position.set(
      app.screen.width / 2 - point.x * world.scale.x,
      app.screen.height / 2 - point.y * world.scale.y
    )
    requestRender()
  }

  function zoomAt(factor: number, point: ScenePoint): void {
    const before = world.toLocal(point)
    const nextScale = resolveVttZoomScale(world.scale.x, factor)
    world.scale.set(nextScale)
    const after = world.toGlobal(before)
    world.position.x += point.x - after.x
    world.position.y += point.y - after.y
    requestRender()
  }

  function zoomAtCanvasCenter(factor: number): void {
    zoomAt(factor, { x: app.screen.width / 2, y: app.screen.height / 2 })
  }

  function drawMap(scene: CampaignSceneStateDto, delivery: SignedVttMapDeliveryDto | null): void {
    destroyChildren(mapLayer)
    releaseMapAssets()
    mapLoadComplete = false
    mapLoadStatus = null
    const generation = ++mapGeneration
    const fallback = new pixi.Graphics()
      .rect(0, 0, scene.map.width, scene.map.height)
      .fill(colors.mapFallback)
    mapLayer.addChild(fallback)
    if (!delivery) return
    if (!isMapDeliveryForScene(scene, delivery)) {
      emitMapLoadStatus('ERROR')
      return
    }
    overviewLayer = new pixi.Container()
    tileLayer = new pixi.Container()
    mapLayer.addChild(overviewLayer, tileLayer)
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
        const sprite = new pixi.Sprite(texture)
        sprite.width = scene.map.width
        sprite.height = scene.map.height
        overviewLayer.addChild(sprite)
      })
    }
    for (const tile of positionVttMapTiles(delivery)) {
      const partId = `tile:${tile.row}:${tile.column}`
      if (!missingPartIds.includes(partId)) continue
      loadMapPart(partId, tile.url, generation, (texture) => {
        if (!tileLayer) return
        const sprite = new pixi.Sprite(texture)
        sprite.position.set(tile.x * scaleX, tile.y * scaleY)
        sprite.width = tile.width * scaleX
        sprite.height = tile.height * scaleY
        tileLayer.addChild(sprite)
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

  function drawLighting(scene: CampaignSceneStateDto): void {
    const lightingStructureChanged =
      renderedLightingBarriers !== scene.barriers || renderedLights !== scene.lights
    if (lightingStructureChanged) {
      destroyChildren(lightLayer)
      lightVisuals.clear()
      lightingBarrierIndex = new SceneBarrierIndex(scene.barriers)
    }
    const changedDoorIds = changedDoorStateIds(renderedLightingDoorStates, scene.doorStates)
    if (lightingStructureChanged || changedDoorIds.length > 0) {
      const barrierIndex = lightingBarrierIndex ?? new SceneBarrierIndex(scene.barriers)
      for (const light of scene.lights) {
        if (
          lightingStructureChanged ||
          changedDoorIds.some((doorId) => doorCanAffectLight(scene, doorId, light))
        ) {
          drawLight(scene, light, barrierIndex)
        }
      }
    }
    if (renderedDarknessZones !== scene.darknessZones) {
      destroyChildren(darknessLayer)
      for (const zone of scene.darknessZones) {
        const darkness = new pixi.Graphics()
          .poly(zone.polygon.points.flatMap((point) => [point.x, point.y]))
          .fill({ alpha: zone.opacity, color: colors.darkness })
        darknessLayer.addChild(darkness)
      }
      renderedDarknessZones = scene.darknessZones
    }
    renderedLightingBarriers = scene.barriers
    renderedLights = scene.lights
    renderedLightingDoorStates = scene.doorStates
  }

  function drawLight(
    scene: CampaignSceneStateDto,
    light: CampaignSceneStateDto['lights'][number],
    barrierIndex: SceneBarrierIndex
  ): void {
    const prior = lightVisuals.get(light.id)
    prior?.removeFromParent()
    prior?.destroy()
    const polygon = visibilityPolygonForLight(light, scene.barriers, scene.doorStates, barrierIndex)
    if (polygon.points.length < 3) {
      lightVisuals.delete(light.id)
      return
    }
    const glow = new pixi.Graphics()
      .poly(polygon.points.flatMap((point) => [point.x, point.y]))
      .fill({ alpha: Math.max(0.05, light.intensity * 0.2), color: light.color })
    lightLayer.addChild(glow)
    lightVisuals.set(light.id, glow)
  }

  function changedDoorStateIds(
    previous: CampaignSceneStateDto['doorStates'] | null,
    next: CampaignSceneStateDto['doorStates']
  ): string[] {
    if (!previous) return Object.keys(next)
    const ids = new Set([...Object.keys(previous), ...Object.keys(next)])
    return [...ids].filter((id) => previous[id] !== next[id])
  }

  function doorCanAffectLight(
    scene: CampaignSceneStateDto,
    doorId: string,
    light: CampaignSceneStateDto['lights'][number]
  ): boolean {
    const door = scene.barriers.find(
      (barrier): barrier is Extract<(typeof scene.barriers)[number], { kind: 'DOOR' }> =>
        barrier.id === doorId && barrier.kind === 'DOOR'
    )
    if (!door) return false
    const maximum = Math.max(light.brightRadius, light.dimRadius)
    return distanceToSegment(light.position, door.a, door.b) <= maximum
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
      const label = measurementLabel(scene, measurement.path)
      measurementLayer.addChild(line, label)
    }
  }

  function tokenCanMove(token: CampaignSceneStateDto['tokens'][number]): boolean {
    return Boolean(current && !token.locked && canControlSceneToken(token, current))
  }

  function movementIndexFor(scene: CampaignSceneStateDto): SceneBarrierIndex {
    if (movementBarrierSource !== scene.barriers) {
      movementBarrierSource = scene.barriers
      movementBarrierIndex = new SceneBarrierIndex(scene.barriers)
    }
    return movementBarrierIndex ?? new SceneBarrierIndex(scene.barriers)
  }

  function drawTokens(
    scene: CampaignSceneStateDto,
    presentations: VttSceneRendererUpdate['tokenPresentations']
  ): void {
    if (renderedTokens === scene.tokens && renderedTokenPresentations === presentations) return
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
    const descriptions = scene.tokens.flatMap((token) => {
      const description = presentations?.[token.id]?.accessibleDescription
      return description ? [description] : [token.label]
    })
    app.canvas.setAttribute(
      'aria-description',
      descriptions.length ? `Visible tokens: ${descriptions.join('; ')}` : 'No visible tokens'
    )
  }

  function createTokenVisual(
    token: CampaignSceneStateDto['tokens'][number],
    presentation: VttTokenPresentation | undefined
  ): Container {
    const visual = new pixi.Container()
    visual.eventMode = tokenCanMove(token) ? 'static' : 'none'
    visual.cursor = tokenCanMove(token) ? 'grab' : 'default'
    if (presentation?.halo) {
      visual.addChild(
        new pixi.Graphics()
          .ellipse(0, 0, token.width / 2 + 8, token.height / 2 + 8)
          .stroke({ alpha: 0.9, color: presentation.halo.color, width: 5 })
      )
    }
    const body = new pixi.Graphics()
      .ellipse(0, 0, token.width / 2, token.height / 2)
      .fill({ color: presentation?.fillColor ?? colors.token })
    visual.addChild(body)
    visual.addChild(
      new pixi.Graphics()
        .ellipse(0, 0, token.width / 2, token.height / 2)
        .stroke({ color: presentation?.outlineColor ?? colors.tokenOutline, width: 3 })
    )
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
          art.height = Math.max(1, token.height - 8)
          art.width = Math.max(1, token.width - 8)
          visual.addChildAt(art, 1)
          label.visible = false
          requestRender()
        })
        .catch(() => {
          label.visible = true
        })
    }
    if (presentation?.facing) {
      const facing = new pixi.Container()
      facing.addChild(
        new pixi.Graphics()
          .arc(0, 0, Math.max(token.width, token.height) / 2 + 12, (-3 * Math.PI) / 4, -Math.PI / 4)
          .stroke({ alpha: 0.9, color: 0xffffff, width: 3 })
      )
      facing.addChild(
        new pixi.Graphics()
          .moveTo(0, -token.height / 2 - 10)
          .lineTo(-7, -token.height / 2 + 1)
          .lineTo(7, -token.height / 2 + 1)
          .closePath()
          .fill(0xffffff)
          .stroke({ color: 0x101315, width: 2 })
      )
      facing.rotation = (token.rotationDegrees * Math.PI) / 180
      visual.addChild(facing)
    }
    if (presentation?.marked) {
      visual.addChild(
        new pixi.Graphics()
          .moveTo(-token.width / 2 - 5, 0)
          .lineTo(token.width / 2 + 5, 0)
          .moveTo(0, -token.height / 2 - 5)
          .lineTo(0, token.height / 2 + 5)
          .stroke({ alpha: 0.9, color: 0x22b8cf, width: 2 })
      )
    }
    addTokenStatuses(visual, token, presentation)
    visual.on('pointerdown', (event) => {
      if (!tokenCanMove(token) || current?.tool !== 'SELECT' || current.areaAim) return
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

  function addTokenStatuses(
    visual: Container,
    token: CampaignSceneStateDto['tokens'][number],
    presentation: VttTokenPresentation | undefined
  ): void {
    if (!presentation?.statuses.length) return
    const shown = presentation.statuses.slice(0, visibleTokenStatusLimit)
    const overflow = presentation.statuses.length - shown.length
    const items =
      overflow > 0
        ? [
            ...shown.slice(0, visibleTokenStatusLimit - 1),
            {
              id: 'overflow',
              kind: 'EFFECT' as const,
              label: `${overflow + 1} more`,
              shortLabel: `+${overflow + 1}`
            }
          ]
        : shown
    const diameter = Math.max(16, Math.min(24, Math.min(token.width, token.height) / 3))
    const startX = -((items.length - 1) * (diameter + 3)) / 2
    items.forEach((status, index) => {
      const badge = new pixi.Container()
      badge.position.set(startX + index * (diameter + 3), token.height / 2 + diameter / 2 + 5)
      badge.addChild(
        new pixi.Graphics()
          .circle(0, 0, diameter / 2)
          .fill(statusColour(status.kind))
          .stroke({ color: 0xffffff, width: 2 })
      )
      const text = new pixi.Text({
        style: {
          align: 'center',
          fill: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
          fontSize: Math.max(9, diameter * 0.45),
          fontWeight: '800'
        },
        text: status.shortLabel
      })
      text.anchor.set(0.5)
      badge.addChild(text)
      visual.addChild(badge)
    })
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

  function statusColour(kind: VttTokenPresentation['statuses'][number]['kind']): number {
    if (kind === 'REACTION') return 0xc2255c
    if (kind === 'INJURY') return 0xa61e4d
    if (kind === 'MORALE') return 0x5f3dc4
    if (kind === 'HEALTH') return 0xc92a2a
    if (kind === 'EFFECT') return 0x1971c2
    return 0x2f9e44
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
    if (!previous?.areaAim && next.areaAim) app.canvas.focus({ preventScroll: true })
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
        !isSceneMovementPathValid(next.scene, drag.path, movementIndexFor(next.scene))
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
    drawPresentationOverlays(next.overlays)
    drawTokens(next.scene, next.tokenPresentations)
    if (renderedMeasurements !== next.scene.measurements) {
      drawMeasurements(next.scene)
      renderedMeasurements = next.scene.measurements
    }
    drawBarriers(next.scene)
    if (fittedSceneId !== next.scene.id) {
      fittedSceneId = next.scene.id
      fit()
    }
  }

  function sameSceneRenderInputs(
    previous: VttSceneRendererUpdate,
    next: VttSceneRendererUpdate
  ): boolean {
    return (
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
      previous.scene.darknessZones === next.scene.darknessZones &&
      previous.scene.measurements === next.scene.measurements &&
      previous.scene.tokens === next.scene.tokens &&
      previous.overlays === next.overlays &&
      previous.tokenPresentations === next.tokenPresentations
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
      measurementLayer.addChild(line, measurementLabel(current.scene, gesturePath))
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
    if (current.areaAim && event.button === 0) {
      callbacks.onAreaPoint?.(point)
      return
    }
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
    // A primary press on the map outside another gesture pings once held in place.
    if (event.button === 0) pingPress.start({ x: event.global.x, y: event.global.y }, point)
  })

  app.stage.on('globalpointermove', (event) => {
    pingPress.move({ x: event.global.x, y: event.global.y })
    if (panStart || drag || gestureStart || current?.areaAim) requestRender()
    if (current?.areaAim && !panStart) {
      destroyChildren(measurementLayer)
      measurementLayer.addChild(
        overlayGraphic(pointAreaOverlay(current.areaAim.shape, worldPoint(event)))
      )
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
        movementIndexFor(current.scene)
      )
      drag.visual.position.set(position.x, position.y)
      if (positionKey(position) !== positionKey(drag.last)) {
        drag.path = extendSceneMovementPath(
          current.scene,
          drag.path,
          position,
          movementIndexFor(current.scene)
        )
        drag.last = position
        callbacks.onTokenPreview(drag.tokenId, position)
      }
      return
    }
    if (gestureStart) updateGesturePreview(point)
  })

  app.stage.on('pointerup', (event) => {
    requestRender()
    pingPress.end()
    panStart = null
    if (drag) {
      const completed = drag
      drag = null
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
      callbacks.onAreaAimCancel?.()
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

  // Pixi hit-tests against transforms it computes when it renders, so a press first renders a pending
  // frame, or it could miss a token rebuilt since the last one. The host's capture listener runs before
  // Pixi's own on the canvas.
  const onPointerDownCapture = () => {
    if (app.ticker.started) app.render()
  }

  host.addEventListener('pointerdown', onPointerDownCapture, { capture: true })
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
      releaseMapAssets()
      for (const url of loadedTokenArtUrls) void pixi.Assets.unload(url)
      loadedTokenArtUrls.clear()
      pingPress.end()
      clearTransientVisuals()
      app.ticker.remove(onTickerUpdate)
      app.renderer.runners.postrender.remove(previewRenderObserver)
      fogTexture?.destroy(true)
      fogTexture = null
      app.canvas.removeEventListener('wheel', onWheel)
      app.canvas.removeEventListener('keydown', onKeyDown)
      app.canvas.removeEventListener('contextmenu', onContextMenu)
      host.removeEventListener('pointerdown', onPointerDownCapture, { capture: true })
      app.canvas.removeEventListener('pointerdown', onTouchPointerDown)
      app.canvas.removeEventListener('pointermove', onTouchPointerMove)
      app.canvas.removeEventListener('pointerup', onTouchPointerEnd)
      app.canvas.removeEventListener('pointercancel', onTouchPointerEnd)
      app.canvas.removeEventListener('lostpointercapture', onTouchPointerEnd)
      app.destroy(true, { children: true })
    },
    fit,
    focusPoint,
    getDiagnostics() {
      return {
        doorVisualCreateCount,
        facingIndicatorCount: [...tokenVisuals.values()].filter(
          (entry) => entry.presentation?.facing
        ).length,
        fogRenderCount,
        loadedMapAssetCount: loadedMapUrls.size,
        mapLoadComplete,
        overlayCount: renderedOverlays?.length ?? 0,
        sceneVersion: current?.scene.version ?? null,
        tokenArtCount: [...tokenVisuals.values()].filter((entry) => entry.presentation?.artUrl)
          .length,
        tokenOverflowCount: [...tokenVisuals.values()].filter(
          (entry) => (entry.presentation?.statuses.length ?? 0) > visibleTokenStatusLimit
        ).length,
        tokenStatusCount: [...tokenVisuals.values()].reduce(
          (total, entry) => total + (entry.presentation?.statuses.length ?? 0),
          0
        ),
        tokenVisualCount: tokenVisuals.size,
        transientVisualCount: transientVisuals.size + pings.size,
        zoomScale: world.scale.x
      }
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
    gestureStart = null
    wallChainStart = null
    gesturePath = []
    if (drag) {
      const activeDrag = drag
      const token = current?.scene.tokens.find((candidate) => candidate.id === activeDrag.tokenId)
      if (token) activeDrag.visual.position.set(token.position.x, token.position.y)
      activeDrag.visual.cursor = 'grab'
      drag = null
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
  }

  function measurementLabel(scene: CampaignSceneStateDto, path: ScenePoint[]): PixiText {
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
      text: formatSceneMeasurement(scene.grid, path)
    })
    label.anchor.set(0.5, 1)
    label.position.set((first.x + last.x) / 2, (first.y + last.y) / 2 - 6)
    return label
  }
}
