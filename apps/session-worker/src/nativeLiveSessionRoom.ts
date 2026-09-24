import { DurableObject } from 'cloudflare:workers'
import {
  LIVE_SESSION_CONTROL_PATH,
  liveSessionControlInputSchema,
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandRejectionCodeDto,
  type LiveSessionCorrectionDto,
  type LiveSessionPresentationControlInput,
  type LiveSessionTransientBroadcastDto,
  type LiveSessionWebSocketClientMessageDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { LiveSessionTransientCapture } from '@artificer-toolkit/schema/api/liveSessionTransient'
import {
  liveSessionPublishInputSchema,
  type LiveSessionScenePublicationDto
} from '@artificer-toolkit/schema/api/liveSessionState'
import {
  sceneCommandResultDtoSchema,
  type CampaignSceneStateDto,
  type SceneCommandResultDto,
  type SceneTransientEnvelopeDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson, equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  applySceneDelta,
  extendSceneMovementPath,
  isSceneTokenVisibleToViewer,
  projectSceneDeltaForViewer,
  projectSceneForViewer,
  projectSceneTokenPreviewForViewer,
  SceneBarrierIndex,
  type SceneViewer
} from '@artificer-toolkit/shared/vtt'
import { decodeJwt } from 'jose'
import { z } from 'zod'

import { DurableCommandJournal } from './durableCommandJournal.js'
import { NativeSocketTransientState } from './nativeSocketTransientState.js'
import type { SessionWorkerEnvironment } from './environment.js'
import {
  createNativeLiveSessionState,
  hydrateNativeLiveSessionState,
  projectNativeLiveSessionState
} from './nativeLiveSessionState.js'
import {
  liveSessionSceneCommandInputSchema,
  planLiveSceneCommand
} from './nativeRoomSceneCommand.js'
import { callLiveSessionRoute, LiveSessionRouteError } from './liveSessionRoutes.js'
import { hydrateNativeTransientScene } from './nativeSceneClient.js'
import { verifyLiveSessionTicket } from './ticket.js'

const INTERNAL_TICKET_HEADER = 'x-artificer-live-session-ticket'
const MAX_MESSAGE_BYTES = 256 * 1024

const socketAttachmentSchema = z.strictObject({
  authorityEpoch: z.string().uuid(),
  campaignId: z.string().uuid(),
  membershipEpoch: z.nullable(z.iso.datetime({ offset: true })),
  role: z.enum(['OWNER', 'PLAYER']),
  sessionId: z.string().uuid(),
  socketId: z.string().uuid(),
  ticketExpiresAt: z.number().int().positive(),
  transientSequences: z.record(z.string(), z.number().int().nonnegative()).optional(),
  transientTokenPaths: z
    .record(
      z.string(),
      z
        .array(z.strictObject({ x: z.number().finite(), y: z.number().finite() }))
        .min(1)
        .max(256)
    )
    .optional(),
  userId: z.string().uuid()
})
type SocketAttachment = z.infer<typeof socketAttachmentSchema>

interface Admission {
  accessToken: string
  deadline: number
  generation: number
  membershipEpoch: string
  role: 'OWNER' | 'PLAYER'
  userId: string
}

interface TransientCache {
  characterRevisions: LiveSessionTransientCapture['observedCharacterRevisions']
  key: string
  scene: CampaignSceneStateDto | null
  sceneEncounterBound: boolean
  session: LiveSessionScenePublicationDto['session'] | null
  synchronized: boolean
}

interface NativeRoomIdentityRow extends Record<string, SqlStorageValue> {
  campaign_id: string
  session_id: string
}

function attachment(socket: WebSocket): SocketAttachment | null {
  const parsed = socketAttachmentSchema.safeParse(socket.deserializeAttachment())
  return parsed.success ? parsed.data : null
}

function viewer(value: Pick<Admission, 'role' | 'userId'>): SceneViewer {
  return { role: value.role === 'OWNER' ? 'GM' : 'PLAYER', userId: value.userId }
}

function send(socket: WebSocket, message: LiveSessionWebSocketServerMessageDto): void {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(liveSessionWebSocketServerMessageDtoSchema.parse(message)))
}

function streamKey(envelope: SceneTransientEnvelopeDto): string {
  if (envelope.kind === 'TOKEN_DRAG_PREVIEW') return `${envelope.kind}:${envelope.tokenId}`
  if (envelope.kind === 'FOG_AREA_PREVIEW')
    return `${envelope.kind}:${envelope.ownerUserId ?? 'SHARED_PARTY'}`
  return envelope.kind
}

function cacheKey(capture: LiveSessionTransientCapture): string {
  return JSON.stringify({
    campaignId: capture.campaignId,
    origin: capture.origin,
    presentation: capture.presentation,
    sceneEncounterBound: capture.sceneEncounterBound,
    sceneHeader: capture.sceneHeader,
    session: capture.session,
    systemId: capture.systemId,
    visionFreshness: capture.visionFreshness,
    observedCharacterRevisions: capture.observedCharacterRevisions
  })
}

function authorityFingerprint(capture: LiveSessionTransientCapture): unknown {
  return {
    campaignId: capture.campaignId,
    origin: capture.origin,
    presentation: capture.presentation,
    recipients: [...capture.recipients].sort((left, right) =>
      left.userId.localeCompare(right.userId)
    ),
    sceneEncounterBound: capture.sceneEncounterBound,
    sceneHeader: capture.sceneHeader,
    session: capture.session,
    systemId: capture.systemId,
    visionFreshness: capture.visionFreshness
  }
}

export class NativeLiveSessionRoom extends DurableObject<SessionWorkerEnvironment> {
  readonly #journal: DurableCommandJournal
  readonly #transients: NativeSocketTransientState
  readonly #admissions = new Map<WebSocket, Admission>()
  readonly #authenticating = new Map<
    WebSocket,
    { accessToken: string; deadline: number; generation: number }
  >()
  readonly #generations = new Map<WebSocket, number>()
  readonly #movementIndexes = new Map<
    string,
    { barriers: CampaignSceneStateDto['barriers']; index: SceneBarrierIndex }
  >()
  #activation: Promise<void> | null = null
  #cache: TransientCache | null = null
  #cacheGeneration = 0
  #presentationChanging = false
  #commandChain: Promise<void> = Promise.resolve()
  readonly #queuedPointers = new Map<
    WebSocket,
    { envelope: SceneTransientEnvelopeDto; generation: number }
  >()
  #outboxFlush: Promise<void> | null = null
  #sceneSync: Promise<void> | null = null
  #tokenTransientChain: Promise<void> = Promise.resolve()
  #transientChain: Promise<void> = Promise.resolve()

  constructor(ctx: DurableObjectState, env: SessionWorkerEnvironment) {
    super(ctx, env)
    this.#journal = new DurableCommandJournal(ctx.storage)
    this.#transients = new NativeSocketTransientState(ctx.storage)
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS native_room_identity (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          campaign_id TEXT NOT NULL,
          session_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS used_tickets (
          jti TEXT PRIMARY KEY,
          expires_at INTEGER NOT NULL
        );
      `)
      const liveSocketIds = new Set<string>()
      for (const socket of ctx.getWebSockets()) {
        const value = attachment(socket)
        if (!value) continue
        liveSocketIds.add(value.socketId)
        if (value.transientSequences || value.transientTokenPaths) {
          this.#transients.migrate(
            value.socketId,
            value.transientSequences ?? {},
            value.transientTokenPaths ?? {}
          )
          const { transientSequences: _sequences, transientTokenPaths: _paths, ...identity } = value
          socket.serializeAttachment(identity)
        }
      }
      this.#transients.forgetClosedSockets(liveSocketIds)
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === LIVE_SESSION_CONTROL_PATH) {
      const parsed = liveSessionControlInputSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success)
        return new Response('Invalid live-session control request.', { status: 400 })
      const existing = this.ctx.storage.sql
        .exec<NativeRoomIdentityRow>(
          'SELECT campaign_id, session_id FROM native_room_identity WHERE id = 1'
        )
        .toArray()[0]
      if (
        existing &&
        (existing.campaign_id !== parsed.data.campaignId ||
          existing.session_id !== parsed.data.sessionId)
      )
        return new Response('Live-session room identity does not match.', { status: 409 })
      if (parsed.data.operation.type === 'SET_SCENE_PRESENTATION') {
        const input = { ...parsed.data, operation: parsed.data.operation }
        const next = this.#commandChain.then(() => this.#presentScene(input))
        this.#commandChain = next.then(
          () => undefined,
          () => undefined
        )
        try {
          return Response.json(await next)
        } catch {
          return new Response('Live Scene presentation is unavailable.', { status: 409 })
        }
      }
      return Response.json({
        closed:
          parsed.data.operation.type === 'EVICT_USER'
            ? this.#closeSockets(parsed.data.operation)
            : await this.#closeRoom(parsed.data.campaignId, parsed.data.sessionId)
      })
    }
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
      return new Response('Expected a WebSocket upgrade.', { status: 426 })
    const ticket = request.headers.get(INTERNAL_TICKET_HEADER)
    if (!ticket) return new Response('Live-session ticket is missing.', { status: 401 })

    let claims: Awaited<ReturnType<typeof verifyLiveSessionTicket>>
    try {
      claims = await verifyLiveSessionTicket(ticket, this.env.LIVE_SESSION_TICKET_SECRET)
    } catch {
      return new Response('Live-session ticket is invalid.', { status: 401 })
    }
    const existing = this.ctx.storage.sql
      .exec<NativeRoomIdentityRow>(
        'SELECT campaign_id, session_id FROM native_room_identity WHERE id = 1'
      )
      .toArray()[0]
    if (
      existing &&
      (existing.campaign_id !== claims.campaignId || existing.session_id !== claims.sessionId)
    )
      return new Response('Live-session room identity does not match.', { status: 403 })
    if (!existing)
      this.ctx.storage.sql.exec(
        'INSERT INTO native_room_identity (id, campaign_id, session_id) VALUES (1, ?, ?)',
        claims.campaignId,
        claims.sessionId
      )
    const nowSeconds = Math.floor(Date.now() / 1_000)
    this.ctx.storage.sql.exec('DELETE FROM used_tickets WHERE expires_at <= ?', nowSeconds)
    try {
      this.ctx.storage.sql.exec(
        'INSERT INTO used_tickets (jti, expires_at) VALUES (?, ?)',
        claims.jti,
        claims.exp
      )
    } catch {
      return new Response('Live-session ticket was already used.', { status: 409 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.serializeAttachment({
      authorityEpoch: claims.authorityEpoch,
      campaignId: claims.campaignId,
      membershipEpoch: null,
      role: claims.role,
      sessionId: claims.sessionId,
      socketId: crypto.randomUUID(),
      ticketExpiresAt: claims.exp,
      userId: claims.sub
    } satisfies SocketAttachment)
    this.ctx.acceptWebSocket(server)
    return new Response(null, {
      headers: { 'sec-websocket-protocol': 'artificer.live-session.v1' },
      status: 101,
      webSocket: client
    })
  }

  async webSocketMessage(socket: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    if (typeof rawMessage !== 'string' || rawMessage.length > MAX_MESSAGE_BYTES) {
      socket.close(1008, 'Invalid live-session message.')
      return
    }
    const message = this.#json(rawMessage)

    const parsed = liveSessionWebSocketClientMessageDtoSchema.safeParse(message)

    if (!parsed.success) {
      this.#challenge(socket)
      return
    }
    if (parsed.data.type === 'AUTHENTICATE') {
      await this.#authenticate(socket, parsed.data.accessToken)
      return
    }
    const admission = this.#liveAdmission(socket)

    if (!admission) {
      this.#challenge(socket)
      return
    }
    if (parsed.data.type === 'RESUME') {
      this.#sendStateSync(socket, admission)
      return
    }
    if (parsed.data.type === 'COMMAND') {
      const work = { admission, message: parsed.data }
      const next = this.#commandChain
        .then(() => this.#executeCommand(socket, work.admission, work.message))
        .catch(() =>
          this.#rejectCommand(
            socket,
            work.message.command.command.commandId,
            'UNAVAILABLE',
            'Live Session command unavailable.'
          )
        )
      this.#commandChain = next
      await next
      return
    }
    if (parsed.data.type === 'SYNCHRONIZE_SCENE') {
      const message = parsed.data
      const next = this.#commandChain.then(() =>
        this.#synchronizeScene(
          socket,
          message.sceneId,
          message.version,
          message.expectedSessionVersion,
          message.expectedPresentationVersion
        )
      )
      this.#commandChain = next.catch(() => this.#challenge(socket, admission.generation))
      await this.#commandChain
      return
    }
    const envelope = parsed.data.envelope
    const work = { envelope, generation: admission.generation }
    if (envelope.kind === 'POINTER_PREVIEW') {
      const queued = this.#queuedPointers.get(socket)
      if (queued?.generation === admission.generation) {
        if (
          queued.envelope.sceneId !== envelope.sceneId ||
          queued.envelope.baselineVersion !== envelope.baselineVersion ||
          envelope.sequence > queued.envelope.sequence
        )
          queued.envelope = envelope
        return
      }
      // Pointer samples replace one queued sample; ordered token paths still keep every segment.
      this.#queuedPointers.set(socket, work)
    }
    const chain =
      envelope.kind === 'TOKEN_DRAG_PREVIEW' ? this.#tokenTransientChain : this.#transientChain
    const next = chain
      .then(async () => {
        if (this.#queuedPointers.get(socket) === work) this.#queuedPointers.delete(socket)
        const generationMatches = this.#generations.get(socket) === work.generation

        if (generationMatches) await this.#broadcastTransient(socket, work.envelope)
      })
      .catch(() => {
        this.#cache = null
        this.#challenge(socket, admission.generation)
      })
    if (envelope.kind === 'TOKEN_DRAG_PREVIEW') this.#tokenTransientChain = next
    else this.#transientChain = next
    await next
  }

  webSocketClose(socket: WebSocket): void {
    this.#invalidate(socket)
    const value = attachment(socket)
    if (value) this.#transients.forget(value.socketId)
  }

  webSocketError(socket: WebSocket): void {
    this.#invalidate(socket)
    const value = attachment(socket)
    if (value) this.#transients.forget(value.socketId)
  }

  async #authenticate(socket: WebSocket, accessToken: string): Promise<void> {
    const value = attachment(socket)
    if (!value) {
      socket.close(1008, 'Invalid live-session socket.')
      return
    }
    const pending = this.#authenticating.get(socket)
    if (
      pending?.accessToken === accessToken &&
      pending.generation === this.#generations.get(socket)
    )
      return
    const generation = this.#invalidate(socket)
    if (this.#presentationChanging) return
    const cacheGeneration = this.#cacheGeneration
    let expiration: number
    try {
      const exp = decodeJwt(accessToken).exp
      if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0 || exp * 1_000 <= Date.now())
        throw new Error('Invalid token expiry.')
      expiration = exp
    } catch {
      this.#challenge(socket, generation)
      return
    }
    if (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000) {
      this.#closeIfCurrent(socket, generation, 'Live-session ticket expired.')
      return
    }
    const deadline = expiration * 1_000
    this.#authenticating.set(socket, { accessToken, deadline, generation })
    try {
      const capture = await callLiveSessionRoute(this.env, accessToken, 'capture', {
        campaignId: value.campaignId,
        expectedRole: value.role,
        expectedUserId: value.userId,
        mode: 'AUTHORITY',
        observedCharacterRevisions: [],
        recipientUserIds: this.#recipientUserIds(),
        sessionId: value.sessionId
      })
      if (
        capture.origin.userId !== value.userId ||
        capture.origin.role !== value.role ||
        (value.membershipEpoch !== null && capture.origin.membershipEpoch !== value.membershipEpoch)
      ) {
        this.#closeIfCurrent(socket, generation, 'Live-session membership changed.')
        return
      }
      if (capture.campaignId !== value.campaignId || capture.session.id !== value.sessionId) {
        this.#challenge(socket, generation)
        return
      }
      await this.#ensureAuthority(value, accessToken, capture.origin.role, capture.origin.userId)
      if (generation !== this.#generations.get(socket)) return
      if (this.#presentationChanging || cacheGeneration !== this.#cacheGeneration) {
        this.#challenge(socket, generation)
        return
      }
      if (this.#cache?.scene) {
        if (
          capture.sceneEncounterBound !== this.#cache.sceneEncounterBound ||
          capture.sceneHeader?.id !== this.#cache.scene.id ||
          capture.sceneHeader.version !== this.#cache.scene.version ||
          capture.presentation?.sceneId !== this.#cache.scene.id
        )
          this.#cache = null
        else
          this.#cache = {
            ...this.#cache,
            session: {
              expectedPresentationVersion: capture.presentation.version,
              expectedSessionVersion: capture.session.version,
              sessionId: capture.session.id
            }
          }
      }
      const admitted: Admission = {
        accessToken,
        deadline,
        generation,
        membershipEpoch: capture.origin.membershipEpoch,
        role: capture.origin.role,
        userId: capture.origin.userId
      }
      if (
        Date.now() >= admitted.deadline ||
        generation !== this.#generations.get(socket) ||
        (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000)
      ) {
        if (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000) {
          this.#closeIfCurrent(socket, generation, 'Live-session ticket expired.')
          return
        }
        this.#challenge(socket, generation)
        return
      }
      const latest = attachment(socket)
      if (
        !latest ||
        (latest.membershipEpoch !== null && latest.membershipEpoch !== admitted.membershipEpoch)
      ) {
        this.#challenge(socket, generation)
        return
      }
      if (latest.membershipEpoch === null)
        socket.serializeAttachment({ ...latest, membershipEpoch: admitted.membershipEpoch })
      if (socket.readyState !== WebSocket.OPEN || this.#generations.get(socket) !== generation)
        return
      this.#admissions.set(socket, admitted)
      const current = this.#liveAdmission(socket)
      if (
        current?.generation === admitted.generation &&
        current.role === admitted.role &&
        current.membershipEpoch === admitted.membershipEpoch
      ) {
        send(socket, {
          campaignId: value.campaignId,
          sessionId: value.sessionId,
          type: 'TRANSIENT_READY'
        })
        this.#sendStateSync(socket, current)
        this.#publishInBackground()
      }
    } catch (error) {
      if (
        error instanceof LiveSessionRouteError &&
        (error.status === 401 || error.status === 409)
      ) {
        this.#closeIfCurrent(socket, generation, 'Live-session membership changed.')
        return
      }
      this.#challenge(socket, generation)
    } finally {
      if (this.#authenticating.get(socket)?.generation === generation)
        this.#authenticating.delete(socket)
    }
  }

  async #ensureAuthority(
    value: SocketAttachment,
    accessToken: string,
    role: 'OWNER' | 'PLAYER',
    userId: string
  ): Promise<void> {
    if (!this.#activation) {
      const work = (async () => {
        const bootstrap = await callLiveSessionRoute(this.env, accessToken, 'bootstrap', {
          authorityEpoch: value.authorityEpoch,
          campaignId: value.campaignId,
          expectedRole: role,
          expectedUserId: userId,
          sessionId: value.sessionId
        })
        let current = this.#journal.readCurrent()
        if (
          current &&
          current.authorityEpoch !== value.authorityEpoch &&
          bootstrap.persistedSequence === 0
        ) {
          // Convex verified the replacement epoch; a never-used provisional snapshot can be rebuilt.
          this.#journal.discardUncommittedAuthority(current.authorityEpoch)
          current = null
          this.#cache = null
        }
        if (!current) {
          if (bootstrap.persistedSequence !== 0)
            throw new Error('Live Session bootstrap sequence is unavailable.')
          const initial = createNativeLiveSessionState()
          current = this.#journal.activate({
            authorityEpoch: value.authorityEpoch,
            snapshotChecksum: initial.stateChecksum,
            stateJson: initial.stateJson
          })
        }
        if (current.authorityEpoch !== value.authorityEpoch || current.status !== 'ACTIVE')
          throw new Error('Live Session authority changed.')
        if (
          bootstrap.persistedSequence < current.publishedSequence ||
          bootstrap.persistedSequence > current.sequence
        )
          throw new Error('Live Session publication state is inconsistent.')
        while (current.publishedSequence < bootstrap.persistedSequence) {
          const acknowledged = this.#journal
            .listPending(100)
            .filter((entry) => entry.sequence <= bootstrap.persistedSequence)
            .at(-1)
          if (!acknowledged) throw new Error('Live Session publication recovery is incomplete.')
          current = this.#journal.acknowledge({
            authorityEpoch: value.authorityEpoch,
            stateChecksum: acknowledged.stateChecksum,
            throughSequence: acknowledged.sequence
          })
        }
        if (current.sequence === 0) {
          const activated = await callLiveSessionRoute(this.env, null, 'activate', {
            activationFingerprint: bootstrap.activationFingerprint,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            sessionId: value.sessionId,
            stateChecksum: current.stateChecksum
          })
          if (
            activated.phase !== 'DO_ACTIVE' ||
            activated.persistedSequence !== 0 ||
            activated.persistedStateChecksum !== current.stateChecksum
          )
            throw new Error('Live Session activation did not commit.')
        } else if (
          current.publishedSequence !== bootstrap.persistedSequence ||
          current.publishedChecksum !== bootstrap.persistedStateChecksum
        )
          throw new Error('Live Session publication checksum is inconsistent.')
        await this.#flushOutbox()
      })()
      this.#activation = work
      void work.catch(() => {
        if (this.#activation === work) this.#activation = null
      })
    }
    await this.#activation
    const current = this.#journal.readCurrent()
    if (!current || current.authorityEpoch !== value.authorityEpoch || current.status !== 'ACTIVE')
      throw new Error('Live Session authority changed.')
  }

  #sendStateSync(socket: WebSocket, admission: Admission): void {
    const value = attachment(socket)
    const current = this.#journal.readCurrent()
    if (
      !value ||
      !current ||
      current.authorityEpoch !== value.authorityEpoch ||
      this.#liveAdmission(socket)?.generation !== admission.generation
    )
      return this.#challenge(socket, admission.generation)
    send(socket, {
      authorityEpoch: current.authorityEpoch,
      sequence: current.sequence,
      state: projectNativeLiveSessionState(
        {
          scene: this.#cache?.synchronized ? this.#cache.scene : null
        },
        admission
      ),
      type: 'STATE_SYNC'
    })
  }

  async #executeCommand(
    socket: WebSocket,
    admission: Admission,
    message: Extract<LiveSessionWebSocketClientMessageDto, { type: 'COMMAND' }>
  ): Promise<void> {
    if (this.#liveAdmission(socket)?.generation !== admission.generation) return
    const value = attachment(socket)
    const current = this.#journal.readCurrent()
    const commandId = message.command.command.commandId
    if (!value || !current || current.authorityEpoch !== value.authorityEpoch) {
      this.#rejectCommand(socket, commandId, 'AUTHORITY_CHANGED', 'Live Session authority changed.')
      return
    }
    const sceneCommand =
      message.command.scope === 'SCENE'
        ? liveSessionSceneCommandInputSchema.safeParse(message.command.command)
        : null
    if (!sceneCommand?.success) {
      this.#rejectCommand(
        socket,
        commandId,
        'UNAVAILABLE',
        'This command is not available through live play yet.',
        current.sequence
      )
      return
    }
    const fingerprint = checksumCanonicalJson({
      command: message.command,
      expectedSessionSequence: message.expectedSessionSequence
    })
    const prior = this.#journal.lookupCommand({
      actorId: admission.userId,
      commandId,
      fingerprint
    })
    if (prior.kind === 'MISMATCHED_REUSE') {
      this.#rejectCommand(
        socket,
        commandId,
        'INVALID_COMMAND',
        'The command ID was already used for different input.',
        current.sequence
      )
      return
    }
    if (prior.kind === 'REPLAY') {
      const replay = liveSessionWebSocketServerMessageDtoSchema.parse(
        JSON.parse(prior.receipt.receiptJson)
      )
      if (replay.type !== 'COMMAND_COMMITTED')
        throw new Error('Live Session command receipt is invalid.')
      send(socket, replay)
      return
    }
    const command = sceneCommand.data
    const synchronized = this.#cache?.synchronized ? this.#cache : null
    const scene = synchronized?.scene ?? null
    const correction = (): LiveSessionCorrectionDto | undefined =>
      scene ? { scope: 'SCENE', state: projectSceneForViewer(scene, viewer(admission)) } : undefined
    if (message.expectedSessionSequence !== current.sequence) {
      this.#rejectCommand(
        socket,
        commandId,
        'STALE_SEQUENCE',
        'Live Session changed; the current Scene has been restored.',
        current.sequence,
        correction()
      )
      return
    }
    if (!scene || scene.id !== command.sceneId || scene.version !== command.expectedSceneVersion) {
      this.#rejectCommand(
        socket,
        commandId,
        'STALE_STATE',
        'Scene changed; the current state has been restored.',
        current.sequence,
        correction()
      )
      return
    }
    if (
      !synchronized?.scene ||
      !synchronized.session ||
      synchronized.scene.id !== scene.id ||
      synchronized.scene.version !== scene.version
    ) {
      this.#rejectCommand(
        socket,
        commandId,
        'UNAVAILABLE',
        'Scene synchronization is required before changing the live Scene.',
        current.sequence,
        correction()
      )
      return
    }

    const plan = planLiveSceneCommand({
      actor: admission,
      command,
      latestUnmatchedMove: () => this.#journal.latestUnmatchedSceneTokenMove(scene.id),
      scene,
      sceneEncounterBound: synchronized.sceneEncounterBound
    })
    if (plan.kind === 'REJECTED') {
      this.#rejectCommand(
        socket,
        commandId,
        plan.code,
        plan.message,
        current.sequence,
        plan.correct ? correction() : undefined
      )
      return
    }
    const { delta } = plan

    const occurredAt = new Date().toISOString()
    let nextScene: CampaignSceneStateDto
    try {
      nextScene = applySceneDelta(scene, delta, scene.version + 1)
    } catch (error) {
      this.#rejectCommand(
        socket,
        commandId,
        'INVALID_COMMAND',
        error instanceof Error ? error.message : 'Scene command is invalid.',
        current.sequence,
        correction()
      )
      return
    }
    const next = createNativeLiveSessionState(nextScene)
    const expectedSceneResult = sceneCommandResultDtoSchema.parse({
      commandId,
      delta,
      occurrence: null,
      replayed: false,
      sceneId: scene.id,
      version: nextScene.version
    })
    const committed = liveSessionWebSocketServerMessageDtoSchema.parse({
      commandId,
      delta: { scope: 'SCENE', result: expectedSceneResult },
      sequence: current.sequence + 1,
      type: 'COMMAND_COMMITTED'
    })
    if (committed.type !== 'COMMAND_COMMITTED' || committed.delta?.scope !== 'SCENE')
      throw new Error('Live Session Scene command receipt is invalid.')
    const publication = liveSessionPublishInputSchema.parse({
      actorUserId: admission.userId,
      actorRole: admission.role,
      campaignId: value.campaignId,
      command: {
        command,
        scope: 'SCENE',
        session: synchronized.session
      },
      epoch: value.authorityEpoch,
      expectedSceneResult,
      expectedStateChecksum: current.stateChecksum,
      occurredAt,
      receiptId: commandId,
      sequence: committed.sequence,
      sessionId: value.sessionId,
      stateChecksum: next.stateChecksum
    })
    const result = this.#journal.commit({
      actorId: admission.userId,
      authorityEpoch: value.authorityEpoch,
      commandId,
      expectedSequence: current.sequence,
      expectedStateChecksum: current.stateChecksum,
      fingerprint,
      nextStateChecksum: next.stateChecksum,
      nextStateJson: next.stateJson,
      outboxPayloadJson: JSON.stringify(publication),
      receiptJson: JSON.stringify(committed),
      ...(command.type === 'MOVE_SCENE_TOKEN'
        ? {
            undoJson: JSON.stringify({
              id: scene.id,
              version: scene.version,
              tokens: scene.tokens
                .filter((token) => token.id === command.tokenId)
                .map(({ id, position }) => ({ id, position }))
            })
          }
        : {})
    })
    if (result.kind === 'REPLAY') {
      const replay = liveSessionWebSocketServerMessageDtoSchema.parse(
        JSON.parse(result.receipt.receiptJson)
      )
      if (replay.type !== 'COMMAND_COMMITTED')
        throw new Error('Live Session Scene command receipt is invalid.')
      send(socket, replay)
      return
    }
    this.#cache = { ...synchronized, scene: nextScene, synchronized: true }
    this.#broadcastSceneCommitted(committed, scene, nextScene, expectedSceneResult)
    this.#publishInBackground()
    return
  }

  #broadcastSceneCommitted(
    committed: Extract<LiveSessionWebSocketServerMessageDto, { type: 'COMMAND_COMMITTED' }>,
    before: CampaignSceneStateDto,
    after: CampaignSceneStateDto,
    result: SceneCommandResultDto
  ): void {
    if (!result.delta) throw new Error('Live Session Scene delta is missing.')
    for (const socket of this.ctx.getWebSockets()) {
      const admission = this.#liveAdmission(socket)
      if (!admission) continue
      const delta = projectSceneDeltaForViewer(before, after, viewer(admission), result.delta)
      send(socket, {
        ...committed,
        delta: delta
          ? { scope: 'SCENE', result: { ...result, delta } }
          : { scope: 'SCENE_VERSION', sceneId: result.sceneId, version: result.version }
      })
    }
  }
  #rejectCommand(
    socket: WebSocket,
    commandId: string,
    code: LiveSessionCommandRejectionCodeDto,
    message: string,
    currentSequence = this.#journal.readCurrent()?.sequence ?? 0,
    correction?: LiveSessionCorrectionDto
  ): void {
    send(socket, {
      code,
      commandId,
      ...(correction ? { correction } : {}),
      currentSequence,
      message,
      type: 'COMMAND_REJECTED'
    })
  }

  /** Committed entries stay in the outbox; the next command, admission or drain retries them. */
  #publishInBackground(): void {
    this.ctx.waitUntil(this.#flushOutbox().catch(() => undefined))
  }

  #flushOutbox(): Promise<void> {
    if (this.#outboxFlush) return this.#outboxFlush
    const work = this.#publishPending()
    this.#outboxFlush = work
    void work.then(
      () => {
        if (this.#outboxFlush === work) this.#outboxFlush = null
      },
      () => {
        if (this.#outboxFlush === work) this.#outboxFlush = null
      }
    )
    return work
  }

  async #publishPending(): Promise<void> {
    while (true) {
      const entry = this.#journal.listPending(1)[0]
      if (!entry) return
      const input = liveSessionPublishInputSchema.parse(JSON.parse(entry.payloadJson))
      const published = await callLiveSessionRoute(this.env, null, 'publish', input)
      if (
        published.authority.epoch !== input.epoch ||
        published.authority.persistedSequence !== entry.sequence ||
        published.authority.persistedStateChecksum !== entry.stateChecksum ||
        published.scope !== 'SCENE' ||
        !equalCanonicalJson(published.sceneResult, input.expectedSceneResult)
      )
        throw new Error('Live Session publication result is inconsistent.')
      this.#journal.acknowledge({
        authorityEpoch: input.epoch,
        stateChecksum: entry.stateChecksum,
        throughSequence: entry.sequence
      })
    }
  }
  #broadcastStateSync(): void {
    for (const socket of this.ctx.getWebSockets()) {
      const admission = this.#liveAdmission(socket)
      if (admission) this.#sendStateSync(socket, admission)
    }
  }

  async #broadcastTransient(origin: WebSocket, envelope: SceneTransientEnvelopeDto): Promise<void> {
    if (this.#presentationChanging) return
    const originAttachment = attachment(origin)
    const originAdmission = this.#liveAdmission(origin)
    if (!originAttachment || !originAdmission) return this.#challenge(origin)
    const candidates = this.ctx.getWebSockets().flatMap((socket) => {
      const candidate = this.#liveAdmission(socket)
      return candidate ? [{ admission: candidate, socket }] : (this.#challenge(socket), [])
    })
    if (envelope.kind === 'POINTER_PREVIEW') {
      let capture: LiveSessionTransientCapture
      try {
        capture = await this.#capture(
          originAttachment,
          originAdmission,
          candidates,
          'AUTHORITY',
          []
        )
      } catch (error) {
        if (!(error instanceof LiveSessionRouteError) || error.status !== 409) throw error
        capture = await this.#capture(
          originAttachment,
          originAdmission,
          candidates,
          'AUTHORITY',
          []
        )
      }
      if (
        capture.sceneHeader?.id !== envelope.sceneId ||
        capture.sceneHeader.version !== envelope.baselineVersion
      )
        return
      await this.#sendTransient(
        origin,
        originAttachment,
        originAdmission,
        candidates,
        capture,
        null,
        envelope
      )
      return
    }

    if (envelope.kind === 'TOKEN_DRAG_PREVIEW') {
      if (this.#sceneSync) await this.#sceneSync
      const cached = this.#cache
      if (
        cached?.scene &&
        cached.synchronized &&
        cached.characterRevisions.length === 0 &&
        cached.scene.id === envelope.sceneId &&
        cached.scene.version === envelope.baselineVersion
      ) {
        await this.#sendTransient(
          origin,
          originAttachment,
          originAdmission,
          candidates,
          null,
          cached.scene,
          envelope
        )
        return
      }
    }

    const capture = await this.#refreshSceneCache(originAttachment, originAdmission, candidates)
    const scene = this.#cache?.scene
    if (
      !capture ||
      !scene ||
      scene.id !== envelope.sceneId ||
      scene.version !== envelope.baselineVersion
    )
      return
    await this.#sendTransient(
      origin,
      originAttachment,
      originAdmission,
      candidates,
      capture,
      scene,
      envelope
    )
  }

  #overlayDurableSceneCache(sceneId: string): void {
    const current = this.#journal.readCurrent()
    if (!current || this.#cache?.scene?.id !== sceneId) return
    const durableScene = hydrateNativeLiveSessionState(
      current.stateJson,
      current.stateChecksum
    ).scene
    if (durableScene?.id === sceneId && durableScene.version >= this.#cache.scene.version)
      this.#cache = { ...this.#cache, scene: durableScene }
  }

  #matchesSceneSynchronization(
    value: SocketAttachment,
    sceneId: string,
    version: number,
    expectedSessionVersion: number,
    expectedPresentationVersion: number
  ): boolean {
    return (
      this.#cache?.scene?.id === sceneId &&
      this.#cache.scene.version >= version &&
      this.#cache.session?.sessionId === value.sessionId &&
      this.#cache.session.expectedSessionVersion === expectedSessionVersion &&
      this.#cache.session.expectedPresentationVersion === expectedPresentationVersion
    )
  }

  async #synchronizeScene(
    socket: WebSocket,
    sceneId: string,
    version: number,
    expectedSessionVersion: number,
    expectedPresentationVersion: number
  ): Promise<void> {
    const value = attachment(socket)
    const admission = this.#liveAdmission(socket)
    if (!value || !admission) return this.#challenge(socket)
    this.#overlayDurableSceneCache(sceneId)
    if (
      this.#matchesSceneSynchronization(
        value,
        sceneId,
        version,
        expectedSessionVersion,
        expectedPresentationVersion
      )
    ) {
      if (!this.#cache) throw new Error('Synchronized Scene cache is missing.')
      this.#cache = { ...this.#cache, synchronized: true }
      this.#broadcastStateSync()
      return
    }

    const candidates = this.ctx.getWebSockets().flatMap((candidateSocket) => {
      const candidate = this.#liveAdmission(candidateSocket)
      return candidate ? [{ admission: candidate, socket: candidateSocket }] : []
    })
    const sync = this.#refreshSceneCache(value, admission, candidates).then(() => undefined)
    this.#sceneSync = sync
    try {
      await sync
      this.#overlayDurableSceneCache(sceneId)
      if (
        this.#matchesSceneSynchronization(
          value,
          sceneId,
          version,
          expectedSessionVersion,
          expectedPresentationVersion
        )
      ) {
        if (!this.#cache) throw new Error('Synchronized Scene cache is missing.')
        this.#cache = { ...this.#cache, synchronized: true }
        this.#broadcastStateSync()
      }
    } catch {
      this.#cache = null
      this.#challenge(socket, admission.generation)
    } finally {
      if (this.#sceneSync === sync) this.#sceneSync = null
    }
  }

  async #refreshSceneCache(
    value: SocketAttachment,
    admission: Admission,
    candidates: readonly { admission: Admission; socket: WebSocket }[]
  ): Promise<LiveSessionTransientCapture | null> {
    if (this.#presentationChanging) return null
    const generation = this.#cacheGeneration
    let staleRetryUsed = false
    let capture: LiveSessionTransientCapture
    try {
      capture = await this.#capture(
        value,
        admission,
        candidates,
        'FULL',
        this.#cache?.characterRevisions ?? []
      )
    } catch (error) {
      if (!(error instanceof LiveSessionRouteError) || error.status !== 409) throw error
      if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
      staleRetryUsed = true
      this.#cache = null
      capture = await this.#capture(value, admission, candidates, 'FULL', [])
    }
    if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
    const key = cacheKey(capture)
    if (this.#cache?.key === key) return capture

    const hydrated = await hydrateNativeTransientScene(this.env, admission.accessToken, capture)
    let scene = hydrated.scene
    let revisions = hydrated.characterRevisions
    let finalCapture: LiveSessionTransientCapture
    try {
      finalCapture = await this.#capture(value, admission, candidates, 'FULL', revisions)
    } catch (error) {
      if (!(error instanceof LiveSessionRouteError) || error.status !== 409) throw error
      if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
      if (staleRetryUsed) throw error
      staleRetryUsed = true
      this.#cache = null
      const retry = await this.#capture(value, admission, candidates, 'FULL', [])
      const hydratedRetry = await hydrateNativeTransientScene(
        this.env,
        admission.accessToken,
        retry
      )
      scene = hydratedRetry.scene
      revisions = hydratedRetry.characterRevisions
      finalCapture = await this.#capture(value, admission, candidates, 'FULL', revisions)
      if (!equalCanonicalJson(authorityFingerprint(retry), authorityFingerprint(finalCapture)))
        return null
    }
    if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
    if (!equalCanonicalJson(authorityFingerprint(capture), authorityFingerprint(finalCapture))) {
      this.#cache = null
      return null
    }
    this.#cache = {
      characterRevisions: revisions,
      key: cacheKey(finalCapture),
      scene,
      sceneEncounterBound: finalCapture.sceneEncounterBound,
      session: finalCapture.presentation
        ? {
            expectedPresentationVersion: finalCapture.presentation.version,
            expectedSessionVersion: finalCapture.session.version,
            sessionId: finalCapture.session.id
          }
        : null,
      synchronized: false
    }
    return finalCapture
  }
  async #capture(
    value: SocketAttachment,
    admission: Admission,
    candidates: readonly { admission: Admission; socket: WebSocket }[],
    mode: 'AUTHORITY' | 'FULL',
    observedCharacterRevisions: LiveSessionTransientCapture['observedCharacterRevisions']
  ): Promise<LiveSessionTransientCapture> {
    return callLiveSessionRoute(this.env, admission.accessToken, 'capture', {
      campaignId: value.campaignId,
      expectedRole: admission.role,
      expectedUserId: admission.userId,
      mode,
      observedCharacterRevisions,
      recipientUserIds: [
        ...new Set(candidates.map(({ admission: candidate }) => candidate.userId))
      ],
      sessionId: value.sessionId
    })
  }

  async #sendTransient(
    origin: WebSocket,
    originAttachment: SocketAttachment,
    originAdmission: Admission,
    candidates: readonly { admission: Admission; socket: WebSocket }[],
    capture: LiveSessionTransientCapture | null,
    scene: CampaignSceneStateDto | null,
    envelope: SceneTransientEnvelopeDto
  ): Promise<void> {
    const originMember = capture?.origin ?? originAdmission
    if (!this.#matchesCurrent(origin, originAdmission, originMember)) return
    const key = streamKey(envelope)
    const retained = this.#transients.read(
      originAttachment.socketId,
      key,
      envelope.sceneId,
      envelope.baselineVersion
    )
    if (envelope.kind === 'TOKEN_DRAG_PREVIEW') {
      if (!scene) return
      const currentAttachment = attachment(origin)

      if (
        !currentAttachment ||
        currentAttachment.socketId !== originAttachment.socketId ||
        (retained?.sequence ?? -1) >= envelope.sequence
      )
        return
      if (envelope.previewUserId && originAdmission.role !== 'OWNER') return
      const token = scene.tokens.find((candidate) => candidate.id === envelope.tokenId)

      if (!token || token.locked) return
      if (
        originAdmission.role !== 'OWNER' &&
        (token.hidden || !token.controlledByUserIds.includes(originAdmission.userId))
      )
        return
      const currentPath =
        retained?.sceneId === envelope.sceneId &&
        retained.baselineVersion === envelope.baselineVersion
          ? (retained.path ?? [token.position])
          : [token.position]
      const nextPath =
        envelope.position.x < 0 ||
        envelope.position.y < 0 ||
        envelope.position.x > scene.map.width ||
        envelope.position.y > scene.map.height
          ? currentPath
          : extendSceneMovementPath(
              scene,
              currentPath,
              envelope.position,
              this.#movementIndex(scene)
            )
      const accepted =
        nextPath.at(-1)?.x === envelope.position.x && nextPath.at(-1)?.y === envelope.position.y

      this.#transients.retain(
        currentAttachment.socketId,
        key,
        envelope.sequence,
        envelope.sceneId,
        envelope.baselineVersion,
        nextPath
      )
      if (!accepted)
        return this.#sendIfCurrent(
          origin,
          originAdmission,
          originMember,
          origin,
          originAdmission,
          originMember,
          {
            message: {
              envelope,
              tokenDragResolution: { accepted: false, path: currentPath },
              userId: originAdmission.userId,
              visionLayers: []
            },
            type: 'TRANSIENT'
          }
        )
      const previewScene = {
        ...scene,
        tokens: scene.tokens.map((candidate) =>
          candidate.id === token.id ? { ...candidate, position: envelope.position } : candidate
        )
      }
      const originViewer =
        originAdmission.role === 'OWNER' && envelope.previewUserId
          ? { role: 'PLAYER' as const, userId: envelope.previewUserId }
          : viewer(originAdmission)
      if (!isSceneTokenVisibleToViewer(previewScene, originViewer, token.id)) return
      const originPreview = projectSceneTokenPreviewForViewer(previewScene, {
        path: nextPath,
        tokenId: token.id,
        viewer: originViewer
      })
      this.#sendIfCurrent(
        origin,
        originAdmission,
        originMember,
        origin,
        originAdmission,
        originMember,
        {
          message: {
            envelope,
            tokenDragResolution: { accepted: true, path: nextPath },
            userId: originAdmission.userId,
            visionLayers: originPreview.visionLayers,
            visionReveal: originPreview.reveal
          },
          type: 'TRANSIENT'
        }
      )
      for (const candidate of candidates) {
        if (attachment(candidate.socket)?.socketId === originAttachment.socketId) continue
        const recipientViewer = viewer(candidate.admission)
        if (!isSceneTokenVisibleToViewer(previewScene, recipientViewer, token.id)) continue
        const preview = projectSceneTokenPreviewForViewer(previewScene, {
          path: nextPath,
          tokenId: token.id,
          viewer: recipientViewer
        })
        this.#sendIfCurrent(
          origin,
          originAdmission,
          originMember,
          candidate.socket,
          candidate.admission,
          capture ? this.#member(capture, candidate.admission) : candidate.admission,
          {
            message: {
              envelope: { ...envelope, previewUserId: undefined },
              userId: originAdmission.userId,
              visionLayers: preview.visionLayers,
              visionReveal: preview.reveal
            },
            type: 'TRANSIENT'
          }
        )
      }
      return
    }
    if (envelope.kind === 'FOG_AREA_PREVIEW') {
      if (
        !scene ||
        originAdmission.role !== 'OWNER' ||
        (scene.fogMode === 'SHARED_PARTY' && envelope.ownerUserId !== null) ||
        (scene.fogMode === 'PER_PLAYER' && envelope.ownerUserId === null)
      )
        return
    }
    const currentAttachment = attachment(origin)

    if (
      !currentAttachment ||
      currentAttachment.socketId !== originAttachment.socketId ||
      (retained?.sequence ?? -1) >= envelope.sequence
    )
      return
    this.#transients.retain(
      currentAttachment.socketId,
      key,
      envelope.sequence,
      envelope.sceneId,
      envelope.baselineVersion
    )
    for (const candidate of candidates) {
      if (attachment(candidate.socket)?.socketId === originAttachment.socketId) continue
      if (
        envelope.kind === 'FOG_AREA_PREVIEW' &&
        envelope.ownerUserId !== null &&
        candidate.admission.role !== 'OWNER' &&
        candidate.admission.userId !== envelope.ownerUserId
      )
        continue
      this.#sendIfCurrent(
        origin,
        originAdmission,
        originMember,
        candidate.socket,
        candidate.admission,
        capture ? this.#member(capture, candidate.admission) : candidate.admission,
        { message: { envelope, userId: originAdmission.userId }, type: 'TRANSIENT' }
      )
    }
  }

  #sendIfCurrent(
    origin: WebSocket,
    originAdmission: Admission,
    originMember: Pick<Admission, 'membershipEpoch' | 'role' | 'userId'>,
    socket: WebSocket,
    expected: Admission,
    member: Pick<Admission, 'membershipEpoch' | 'role' | 'userId'> | undefined,
    message: { message: LiveSessionTransientBroadcastDto; type: 'TRANSIENT' }
  ): void {
    if (
      this.#presentationChanging ||
      !this.#matchesCurrent(origin, originAdmission, originMember) ||
      !this.#matchesCurrent(socket, expected, member)
    )
      return
    send(socket, message)
  }

  #matchesCurrent(
    socket: WebSocket,
    expected: Admission,
    member: Pick<Admission, 'membershipEpoch' | 'role' | 'userId'> | undefined
  ): boolean {
    const current = this.#liveAdmission(socket)
    if (!current) {
      this.#challenge(socket)
      return false
    }
    return (
      member !== undefined &&
      current.generation === expected.generation &&
      current.role === member.role &&
      current.membershipEpoch === member.membershipEpoch &&
      current.userId === member.userId
    )
  }

  #member(capture: LiveSessionTransientCapture, admission: Admission) {
    return capture.origin.userId === admission.userId
      ? capture.origin
      : capture.recipients.find((member) => member.userId === admission.userId)
  }

  #liveAdmission(socket: WebSocket): Admission | null {
    const current = this.#admissions.get(socket)
    if (!current || !this.#isLive(current)) {
      this.#admissions.delete(socket)
      return null
    }
    return current
  }

  #isLive(admission: Admission): boolean {
    return Date.now() < admission.deadline
  }

  #recipientUserIds(): string[] {
    return [
      ...new Set(
        [...this.#admissions.values()]
          .filter((admission) => this.#isLive(admission))
          .map((admission) => admission.userId)
      )
    ]
  }

  #movementIndex(scene: CampaignSceneStateDto): SceneBarrierIndex {
    const cached = this.#movementIndexes.get(scene.id)
    if (cached?.barriers === scene.barriers) return cached.index
    const index = new SceneBarrierIndex(scene.barriers)
    this.#movementIndexes.set(scene.id, { barriers: scene.barriers, index })
    return index
  }

  #invalidate(socket: WebSocket): number {
    const generation = (this.#generations.get(socket) ?? 0) + 1
    this.#generations.set(socket, generation)
    this.#admissions.delete(socket)
    this.#authenticating.delete(socket)
    this.#queuedPointers.delete(socket)
    return generation
  }

  #challenge(socket: WebSocket, expectedGeneration?: number): void {
    if (expectedGeneration !== undefined && this.#generations.get(socket) !== expectedGeneration)
      return
    // Traffic arriving while admission is being verified must not cancel that verification.
    const pending = this.#authenticating.get(socket)
    if (
      expectedGeneration === undefined &&
      !this.#admissions.has(socket) &&
      pending &&
      pending.generation === this.#generations.get(socket) &&
      Date.now() < pending.deadline
    )
      return
    this.#invalidate(socket)
    send(socket, { type: 'AUTHENTICATION_REQUIRED' })
  }

  #closeIfCurrent(socket: WebSocket, expectedGeneration: number, reason: string): void {
    if (this.#generations.get(socket) !== expectedGeneration) return
    this.#invalidate(socket)
    const value = attachment(socket)
    if (value) this.#transients.forget(value.socketId)
    if (socket.readyState === WebSocket.OPEN) socket.close(1008, reason)
  }

  async #presentScene(input: LiveSessionPresentationControlInput) {
    if (this.#activation) await this.#activation
    this.#presentationChanging = true
    this.#cacheGeneration += 1
    this.#cache = null
    this.#movementIndexes.clear()
    try {
      await this.#flushOutbox()
      const current = this.#journal.readCurrent()
      if (
        current &&
        (current.authorityEpoch !== input.operation.epoch || current.status !== 'ACTIVE')
      )
        throw new Error('Live Session authority changed.')
      if (current && current.sequence !== current.publishedSequence)
        throw new Error('Live Session publication is incomplete.')
      return await callLiveSessionRoute(this.env, null, 'present', {
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        actorUserId: input.operation.actorUserId,
        epoch: input.operation.epoch,
        input: input.operation.input,
        expectedSequence: current?.sequence ?? 0,
        expectedStateChecksum: current?.stateChecksum ?? null
      })
    } finally {
      this.#cacheGeneration += 1
      this.#cache = null
      this.#presentationChanging = false
      for (const socket of this.ctx.getWebSockets()) this.#challenge(socket)
    }
  }

  async #closeRoom(campaignId: string, sessionId: string): Promise<number> {
    const current = this.#journal.readCurrent()
    if (!current || current.status === 'RELEASED') return this.#closeSockets({ type: 'CLOSE_ROOM' })

    const fence = {
      authorityEpoch: current.authorityEpoch,
      finalSequence: current.drainFinalSequence ?? current.sequence,
      finalStateChecksum: current.drainFinalChecksum ?? current.stateChecksum
    }
    this.#journal.beginDrain(fence)
    const closed = this.#closeSockets({ type: 'CLOSE_ROOM' })
    const input = {
      campaignId,
      sessionId,
      epoch: fence.authorityEpoch,
      finalSequence: fence.finalSequence,
      finalStateChecksum: fence.finalStateChecksum
    }
    let drainError: unknown
    try {
      const authority = await callLiveSessionRoute(this.env, null, 'beginDrain', input)
      if (
        authority.epoch !== input.epoch ||
        authority.phase !== 'DRAINING' ||
        authority.finalSequence !== input.finalSequence ||
        authority.finalStateChecksum !== input.finalStateChecksum
      )
        throw new Error('Live Session drain result is inconsistent.')
    } catch (error) {
      drainError = error
    }
    await this.#flushOutbox()
    try {
      await callLiveSessionRoute(this.env, null, 'release', input)
    } catch (error) {
      throw drainError ?? error
    }
    this.#journal.release(fence)
    return closed
  }

  #closeSockets(
    operation:
      | { type: 'CLOSE_ROOM' }
      | { membershipEpoch: string; type: 'EVICT_USER'; userId: string }
  ): number {
    let closed = 0
    for (const socket of this.ctx.getWebSockets()) {
      const value = attachment(socket)
      if (
        operation.type === 'EVICT_USER' &&
        (!value ||
          value.userId !== operation.userId ||
          value.membershipEpoch !== operation.membershipEpoch)
      )
        continue
      this.#invalidate(socket)
      if (value) this.#transients.forget(value.socketId)
      if (socket.readyState === WebSocket.OPEN)
        socket.close(
          1008,
          operation.type === 'CLOSE_ROOM' ? 'Live Session ended.' : 'Campaign access ended.'
        )
      closed += 1
    }
    this.#cache = null
    this.#cacheGeneration += 1
    this.#movementIndexes.clear()
    return closed
  }

  #json(value: string): unknown {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
}
