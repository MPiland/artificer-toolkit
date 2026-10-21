import type { LiveSessionRoomSceneCapture } from '@artificer-toolkit/schema/api/liveSessionTransient'
import { scenePresentationFenceSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import { equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { z } from 'zod'
import { hydrateNativeLiveSessionState } from './nativeLiveSessionState.js'
import { callLiveSessionRoute, LiveSessionRouteError } from './liveSessionRoutes.js'
import { type SocketAttachment, type TransientCache } from './roomSocket.js'
import { readRoomSceneState } from './roomSceneRead.js'
import { composeRoomSceneVision } from './roomSceneVision.js'
import type { RoomCommandHost } from './roomCommandHost.js'

const persistedSceneCacheSchema = z.strictObject({
  key: z.string(),
  sceneHeader: z.nullable(sceneLiveStateHeaderSchema),
  encounterId: z.nullable(z.string()),
  presentation: z.nullable(scenePresentationFenceSchema)
})

function cacheKey(capture: LiveSessionRoomSceneCapture): string {
  return JSON.stringify({
    campaignId: capture.campaignId,
    presentation: capture.presentation,
    sceneEncounterId: capture.sceneEncounterId,
    sceneHeader: capture.sceneHeader,
    systemId: capture.systemId,
    visionFreshness: capture.visionFreshness,
    observedCharacterRevisions: capture.observedCharacterRevisions
  })
}

function authorityFingerprint(capture: LiveSessionRoomSceneCapture): unknown {
  return {
    campaignId: capture.campaignId,
    presentation: capture.presentation,
    sceneEncounterId: capture.sceneEncounterId,
    sceneHeader: capture.sceneHeader,
    systemId: capture.systemId,
    visionFreshness: capture.visionFreshness
  }
}

/** The room steps the Scene cache uses. */
export type RoomSceneCachePort = Pick<
  RoomCommandHost,
  | 'afterCommands'
  | 'authorization'
  | 'authorizationBoundary'
  | 'checkpointThrough'
  | 'env'
  | 'inputs'
  | 'journal'
  | 'loadRoomAggregate'
  | 'presentationChanging'
  | 'roomCampaignId'
  | 'storage'
  | 'store'
>

/**
 * The room's presented-Scene cache: the Scene rows composed with Character vision, keyed by the
 * authority it was captured under. A generation counter discards a cache an older step was building.
 * The persisted part lives in the room's SQLite so a woken room restores it without a sign-in round.
 */
export class RoomSceneCache {
  #value: TransientCache | null = null
  /** The persisted part of the cache as last written, serialized; null while no row exists. */
  #saved: string | null = null
  #generation = 0

  constructor(private readonly port: RoomSceneCachePort) {}

  current(): TransientCache | null {
    return this.#value
  }

  generation(): number {
    return this.#generation
  }

  /** Every assignment goes through here, so the copy a woken room restores from stays current. */
  set(value: TransientCache | null): void {
    this.#value = value
    const saved =
      value &&
      JSON.stringify({
        key: value.key,
        sceneHeader: value.sceneHeader,
        encounterId: value.encounterId,
        presentation: value.presentation
      } satisfies z.infer<typeof persistedSceneCacheSchema>)
    if (saved === this.#saved) return
    if (saved === null) this.port.storage.sql.exec('DELETE FROM room_scene_cache WHERE id = 1')
    else
      this.port.storage.sql.exec(
        `INSERT INTO room_scene_cache (id, state) VALUES (1, ?)
         ON CONFLICT (id) DO UPDATE SET state = excluded.state`,
        saved
      )
    this.#saved = saved
  }

  /**
   * Rebuilds the Scene cache of a room that slept, from its own SQLite and the persisted part: the
   * Scene rows are the room's, so no member's token is needed. A failure leaves no cache, and the
   * next admission or preview rebuilds it from Convex.
   */
  async restore(): Promise<void> {
    const row = this.port.storage.sql
      .exec<{ state: string }>('SELECT state FROM room_scene_cache WHERE id = 1')
      .toArray()[0]
    if (!row) return
    this.#saved = row.state
    const current = this.port.journal.readCurrent()
    const campaignId = this.port.roomCampaignId()
    try {
      const saved = persistedSceneCacheSchema.parse(JSON.parse(row.state))
      if (current?.status !== 'ACTIVE' || !campaignId) {
        this.set(null)
        return
      }
      const rebuilt = await this.#build(
        { authorityEpoch: current.authorityEpoch, campaignId },
        saved
      )
      this.set({ ...rebuilt, ...saved })
      if (saved.sceneHeader) this.overlayDurable(saved.sceneHeader.id)
    } catch (error) {
      console.error('Live Session Scene cache restore failed.', error)
      this.set(null)
    }
  }

  overlayDurable(sceneId: string): void {
    const current = this.port.journal.readCurrent()
    if (!current || this.#value?.scene?.id !== sceneId) return
    const durableScene = hydrateNativeLiveSessionState(current.stateJson).scene
    if (durableScene?.id === sceneId && durableScene.version >= this.#value.scene.version)
      this.set({ ...this.#value, scene: durableScene })
  }

  /**
   * Builds the presented-Scene cache when the room holds none (a first admission, or one after the
   * cache was discarded), so no socket is synced without a Scene that is presented. The Scene rows
   * are the room's own; Convex supplies only the pointer and what the rows are composed with.
   */
  async ensure(value: SocketAttachment): Promise<void> {
    if (this.#value) return
    const capture = await this.refresh(value, true)
    if (capture?.sceneHeader) this.overlayDurable(capture.sceneHeader.id)
  }

  /**
   * The presented Scene from the room's own rows, composed with Character vision. The room's Scene
   * rows are loaded from Convex first when the store does not hold this Scene (D78).
   */
  async #hydrate(
    value: SocketAttachment,
    capture: LiveSessionRoomSceneCapture,
    serialized: boolean
  ) {
    // Off-chain refreshes queue behind a running command: the room store runs one at a time.
    const source = { sceneHeader: capture.sceneHeader }
    if (!serialized) return this.#build(value, source)
    return this.port.afterCommands(() => this.#build(value, source))
  }

  /** The Scene rows composed with Character vision: all of a cache that its persisted part does not hold. */
  async #build(
    scope: Pick<SocketAttachment, 'authorityEpoch' | 'campaignId'>,
    { sceneHeader: header }: Pick<TransientCache, 'sceneHeader'>
  ) {
    if (!header)
      return {
        baseOrdinals: { tokens: [], barriers: [] },
        characterRevisions: [],
        scene: null,
        uncomposedScene: null
      }
    await this.port.loadRoomAggregate(header.id)
    const authorization = await this.port.authorizationBoundary(scope)
    return this.port.store.transact(async (transaction) => {
      const { scene: uncomposedScene, baseOrdinals } = await readRoomSceneState(
        transaction,
        header.id
      )
      if (uncomposedScene.version < header.version)
        throw new Error('Room Scene rows are older than the presented Scene.')
      const composition = await composeRoomSceneVision({
        store: this.port.store,
        transaction,
        inputs: this.port.inputs,
        authorization,
        campaignId: scope.campaignId,
        epoch: scope.authorityEpoch,
        scene: uncomposedScene
      })
      return {
        baseOrdinals,
        characterRevisions: composition.characterRevisions,
        scene: composition.scene,
        uncomposedScene
      }
    })
  }

  async refresh(
    value: SocketAttachment,
    serialized = false
  ): Promise<LiveSessionRoomSceneCapture | null> {
    if (this.port.presentationChanging()) return null
    // Convex holds the room's commands before the capture: hydration would otherwise publish them
    // between the two captures, and the refresh would read its own checkpoint as a change.
    const head = this.port.journal.readCurrent()
    if (head && head.sequence !== head.publishedSequence)
      await this.port.checkpointThrough(head.authorityEpoch, head.sequence, 'RELOAD')
    const generation = this.#generation
    let staleRetryUsed = false
    let capture: LiveSessionRoomSceneCapture
    try {
      capture = await this.#capture(value, this.#value?.characterRevisions ?? [])
    } catch (error) {
      if (!(error instanceof LiveSessionRouteError) || error.status !== 409) throw error
      if (generation !== this.#generation || this.port.presentationChanging()) return null
      staleRetryUsed = true
      this.set(null)
      capture = await this.#capture(value, [])
    }
    if (generation !== this.#generation || this.port.presentationChanging()) return null
    const key = cacheKey(capture)
    if (this.#value?.key === key) return capture

    const hydrated = await this.#hydrate(value, capture, serialized)
    let scene = hydrated.scene
    let uncomposedScene = hydrated.uncomposedScene
    let revisions = hydrated.characterRevisions
    let baseOrdinals = hydrated.baseOrdinals
    let finalCapture: LiveSessionRoomSceneCapture
    try {
      finalCapture = await this.#capture(value, revisions)
    } catch (error) {
      if (!(error instanceof LiveSessionRouteError) || error.status !== 409) throw error
      if (generation !== this.#generation || this.port.presentationChanging()) return null
      if (staleRetryUsed) throw error
      staleRetryUsed = true
      this.set(null)
      const retry = await this.#capture(value, [])
      const hydratedRetry = await this.#hydrate(value, retry, serialized)
      scene = hydratedRetry.scene
      uncomposedScene = hydratedRetry.uncomposedScene
      revisions = hydratedRetry.characterRevisions
      baseOrdinals = hydratedRetry.baseOrdinals
      finalCapture = await this.#capture(value, revisions)
      if (!equalCanonicalJson(authorityFingerprint(retry), authorityFingerprint(finalCapture)))
        return null
    }
    if (generation !== this.#generation || this.port.presentationChanging()) return null
    if (!equalCanonicalJson(authorityFingerprint(capture), authorityFingerprint(finalCapture))) {
      this.set(null)
      return null
    }
    this.set({
      baseOrdinals,
      characterRevisions: revisions,
      encounterId: finalCapture.sceneEncounterId,
      key: cacheKey(finalCapture),
      scene,
      uncomposedScene,
      sceneHeader: finalCapture.sceneHeader,
      presentation: finalCapture.presentation
        ? { expectedPresentationVersion: finalCapture.presentation.version }
        : null
    })
    return finalCapture
  }

  /** The room's Scene from Convex, authorized by the room's epoch: no member's token is needed. */
  async #capture(
    value: SocketAttachment,
    observedCharacterRevisions: LiveSessionRoomSceneCapture['observedCharacterRevisions']
  ): Promise<LiveSessionRoomSceneCapture> {
    return callLiveSessionRoute(this.port.env, null, 'roomSceneCapture', {
      campaignId: value.campaignId,
      epoch: value.authorityEpoch,
      observedCharacterRevisions
    })
  }

  /**
   * Cached Scene state belongs to one generation; a bump discards it, and the bound Encounter's
   * actor control reloads before previews use it.
   */
  bump(): void {
    this.#generation += 1
    this.set(null)
    this.port.authorization.invalidatePlay()
  }
}
