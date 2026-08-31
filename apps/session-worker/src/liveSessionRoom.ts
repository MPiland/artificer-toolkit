import { DurableObject } from 'cloudflare:workers'
import {
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionActiveMembershipDto,
  type LiveSessionAggregateVersionDto,
  type LiveSessionCoordinatorSnapshotDto,
  type LiveSessionEncounterRuleOccurrenceBindingUpdateDto,
  type LiveSessionExecutorCommandResultDto,
  type LiveSessionExecutorResponseDto,
  type LiveSessionExecutorSpatialRefreshDto,
  type LiveSessionRejectedDto,
  type LiveSessionTicketClaimsDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  applySceneEvent,
  extendSceneMovementPath,
  projectSceneDeltaForViewer,
  projectSceneForViewer,
  projectSceneTokenPreviewForViewer,
  isSceneTokenVisibleToViewer,
  resolveSceneCharacterVision,
  SceneBarrierIndex,
  type CampaignSceneState,
  type SceneViewer
} from '@artificer-toolkit/shared/vtt'
import { z } from 'zod'

import {
  deriveLiveSessionConflictKeys,
  deriveLiveSessionSceneVisionContext,
  type LiveSessionConflictKey
} from './conflictKeys.js'
import type { SessionWorkerEnvironment } from './environment.js'
import { callLiveSessionExecutor, LiveSessionExecutorRequestError } from './executorClient.js'
import {
  currentLiveSessionCommandFingerprint,
  isLegacyVisualOnlyDarknessReplayCommand,
  legacyVisualOnlyDarknessLiveCommandFingerprint,
  parsePersistedLiveSessionCommand,
  parsePersistedLiveSessionCoordinatorSnapshot,
  parsePersistedLiveSessionExecutorCommandResult,
  withoutLegacyVisualOnlyDarknessReplayMarker
} from './legacySceneEnvironmentCutover.js'
import { LiveSessionRoomJournal, type LiveSessionJournalCommand } from './roomJournal.js'
import { selectRunnableCommands } from './scheduler.js'
import { verifyLiveSessionTicket } from './ticket.js'

const INTERNAL_TICKET_HEADER = 'x-artificer-live-session-ticket'
const MAX_MESSAGE_BYTES = 256 * 1024
const MAX_AUTHORITATIVE_COMMANDS_IN_FLIGHT = 8
const RECONNECT_GRACE_MS = 20_000
const RETRY_MAX_DELAY_MS = 30_000
const LIVE_SESSION_COMMAND_LEASE_RENEWAL_MS = 10_000
const AUTHORITY_RENEWAL_RETRY_MS = 2_000
const AUTHORITY_LOST_CLOSE_CODE = 1012

interface AuthorityRenewalResult {
  available: boolean
  refreshed: boolean
}

function aggregateVersionsEqual(
  left: readonly LiveSessionAggregateVersionDto[],
  right: readonly LiveSessionAggregateVersionDto[]
): boolean {
  if (left.length !== right.length) return false
  const canonical = (versions: readonly LiveSessionAggregateVersionDto[]) =>
    [...versions].sort((first, second) => {
      const identity = `${first.aggregateKind}:${first.aggregateId}`.localeCompare(
        `${second.aggregateKind}:${second.aggregateId}`
      )
      return identity || first.version - second.version
    })
  const canonicalLeft = canonical(left)
  const canonicalRight = canonical(right)
  return canonicalLeft.every((version, index) => {
    const candidate = canonicalRight[index]
    return (
      candidate?.aggregateKind === version.aggregateKind &&
      candidate.aggregateId === version.aggregateId &&
      candidate.version === version.version
    )
  })
}

function hasNewerAggregateVersion(
  candidate: readonly LiveSessionAggregateVersionDto[],
  current: readonly LiveSessionAggregateVersionDto[]
): boolean {
  const currentVersions = new Map(current.map((version) => [aggregateVersionKey(version), version]))
  return candidate.some(
    (version) =>
      version.version > (currentVersions.get(aggregateVersionKey(version))?.version ?? -1)
  )
}

function hasAggregateVersionRegression(
  candidate: readonly LiveSessionAggregateVersionDto[],
  current: readonly LiveSessionAggregateVersionDto[]
): boolean {
  const currentVersions = new Map(current.map((version) => [aggregateVersionKey(version), version]))
  return candidate.some((version) => {
    const existing = currentVersions.get(aggregateVersionKey(version))
    return existing !== undefined && version.version < existing.version
  })
}

class LiveSessionJoinAuthorityError extends Error {}

const socketAttachmentSchema = z.strictObject({
  campaignId: z.string().uuid(),
  role: z.enum(['OWNER', 'PLAYER']),
  sessionId: z.string().uuid(),
  socketId: z.string().uuid(),
  transientSequences: z.record(z.string(), z.number().int().nonnegative()),
  transientTokenPaths: z
    .record(
      z.string(),
      z
        .array(z.strictObject({ x: z.number().finite(), y: z.number().finite() }))
        .min(1)
        .max(256)
    )
    .default({}),
  userId: z.string().uuid()
})
type SocketAttachment = z.infer<typeof socketAttachmentSchema>

function commandId(command: LiveSessionCommandDto): string {
  return command.command.commandId
}

function aggregateIdentity(command: LiveSessionCommandDto) {
  if (command.aggregateKind === 'CHARACTER') {
    return {
      aggregateId: command.characterId,
      aggregateKind: command.aggregateKind
    }
  }
  if (command.aggregateKind === 'SCENE') {
    return {
      aggregateId: command.command.sceneId,
      aggregateKind: command.aggregateKind
    }
  }
  if (command.aggregateKind === 'SESSION') {
    return { aggregateId: command.command.sessionId, aggregateKind: command.aggregateKind }
  }
  return {
    aggregateId: command.command.encounterId,
    aggregateKind: command.aggregateKind
  }
}

function retryDelay(attempts: number): number {
  return Math.min(1_000 * 2 ** Math.max(0, attempts - 1), RETRY_MAX_DELAY_MS)
}

function rejection(error: unknown, id: string): LiveSessionRejectedDto {
  if (error instanceof LiveSessionExecutorRequestError) {
    const code =
      error.code === 'UNAUTHORIZED'
        ? 'UNAUTHORIZED'
        : error.code === 'CONFLICT'
          ? 'STALE_VERSION'
          : error.code === 'INVALID_REQUEST'
            ? 'INVALID_COMMAND'
            : 'COMMAND_FAILED'
    const message =
      code === 'UNAUTHORIZED'
        ? 'This live-session command is not authorized.'
        : code === 'STALE_VERSION'
          ? 'The aggregate changed before this command was applied.'
          : code === 'INVALID_COMMAND'
            ? 'The live-session command is invalid.'
            : 'The live-session command failed.'
    return { code, commandId: id, message }
  }
  return {
    code: 'COMMAND_FAILED',
    commandId: id,
    message: 'The live-session command failed.'
  }
}

function aggregateVersionKey(version: LiveSessionAggregateVersionDto): string {
  return `${version.aggregateKind}:${version.aggregateId}`
}

function transitionStart(version: LiveSessionAggregateVersionDto): number {
  return version.beforeVersion ?? version.version - 1
}

function changedAggregatesFor(
  execution: LiveSessionExecutorCommandResultDto
): readonly LiveSessionAggregateVersionDto[] {
  const changedAggregates = execution.changedAggregates
  for (let index = 1; index < changedAggregates.length; index += 1) {
    const previous = changedAggregates[index - 1]
    const current = changedAggregates[index]
    if (!previous || !current || aggregateVersionKey(previous) >= aggregateVersionKey(current)) {
      throw new Error('Live-session executor returned unsorted or duplicate changed aggregates.')
    }
  }
  return changedAggregates
}

function versionForAggregate(
  snapshot: LiveSessionCoordinatorSnapshotDto,
  aggregate: LiveSessionAggregateVersionDto,
  execution: LiveSessionExecutorCommandResultDto
): number | null {
  const currentVersion = snapshot.aggregateVersions.find(
    (candidate) =>
      candidate.aggregateKind === aggregate.aggregateKind &&
      candidate.aggregateId === aggregate.aggregateId
  )?.version
  if (currentVersion !== undefined) return currentVersion
  const initialScene =
    aggregate.aggregateKind === 'SCENE' &&
    aggregate.aggregateId === execution.aggregateId &&
    execution.aggregateKind === 'SCENE' &&
    execution.response === null
  const initialSessionPresentation =
    aggregate.aggregateKind === 'SESSION' &&
    aggregate.aggregateId === execution.aggregateId &&
    aggregate.version === 0 &&
    execution.aggregateKind === 'SESSION'
  return initialScene || initialSessionPresentation ? -1 : null
}

function withAggregateVersions(
  snapshot: LiveSessionCoordinatorSnapshotDto,
  changedAggregates: readonly LiveSessionAggregateVersionDto[]
): LiveSessionCoordinatorSnapshotDto {
  const aggregateVersions = snapshot.aggregateVersions.filter(
    (version) =>
      !changedAggregates.some(
        (changed) => aggregateVersionKey(changed) === aggregateVersionKey(version)
      )
  )
  aggregateVersions.push(
    ...changedAggregates.map(({ aggregateKind, aggregateId, version }) => ({
      aggregateKind,
      aggregateId,
      version
    }))
  )
  aggregateVersions.sort((left, right) =>
    aggregateVersionKey(left).localeCompare(aggregateVersionKey(right))
  )
  return { ...snapshot, aggregateVersions }
}

function withSpatialRefresh(
  snapshot: LiveSessionCoordinatorSnapshotDto,
  spatialRefresh: LiveSessionExecutorSpatialRefreshDto
): LiveSessionCoordinatorSnapshotDto {
  const refreshedCharacterIds = new Set(
    spatialRefresh.characterVisions.map((vision) => vision.characterId)
  )
  return {
    ...snapshot,
    characterVisions: [
      ...snapshot.characterVisions.filter(
        (vision) => !refreshedCharacterIds.has(vision.characterId)
      ),
      ...spatialRefresh.characterVisions
    ].sort((left, right) => left.characterId.localeCompare(right.characterId)),
    sceneStates: [
      ...snapshot.sceneStates.filter((scene) => scene.id !== spatialRefresh.sceneState.id),
      spatialRefresh.sceneState
    ]
  }
}

function withOccurrenceBindingUpdate(
  snapshot: LiveSessionCoordinatorSnapshotDto,
  update: LiveSessionEncounterRuleOccurrenceBindingUpdateDto
): LiveSessionCoordinatorSnapshotDto {
  return {
    ...snapshot,
    encounterRuleOccurrenceBindings: [
      ...snapshot.encounterRuleOccurrenceBindings.filter(
        (binding) => binding.encounterId !== update.encounterId
      ),
      ...(update.binding ? [update.binding] : [])
    ]
  }
}

function withEncounterBindingRefresh(
  snapshot: LiveSessionCoordinatorSnapshotDto,
  refresh: NonNullable<
    Extract<LiveSessionExecutorCommandResultDto, { aggregateKind: 'ENCOUNTER' }>['bindingRefresh']
  >
): LiveSessionCoordinatorSnapshotDto {
  return {
    ...snapshot,
    encounterActorTokenBindings: [
      ...snapshot.encounterActorTokenBindings.filter(
        (binding) => binding.encounterId !== refresh.encounterId
      ),
      ...refresh.encounterActorTokenBindings
    ],
    encounterCharacterBindings: [
      ...snapshot.encounterCharacterBindings.filter(
        (binding) => binding.encounterId !== refresh.encounterId
      ),
      ...refresh.encounterCharacterBindings
    ],
    encounterSceneBindings: [
      ...snapshot.encounterSceneBindings.filter(
        (binding) => binding.encounterId !== refresh.encounterId
      ),
      ...(refresh.encounterSceneBinding ? [refresh.encounterSceneBinding] : [])
    ]
  }
}

function viewer(attachment: SocketAttachment): SceneViewer {
  return {
    role: attachment.role === 'OWNER' ? 'GM' : 'PLAYER',
    userId: attachment.userId
  }
}

function parseAttachment(socket: WebSocket): SocketAttachment | null {
  const parsed = socketAttachmentSchema.safeParse(socket.deserializeAttachment())
  return parsed.success ? parsed.data : null
}

function send(socket: WebSocket, message: LiveSessionWebSocketServerMessageDto): void {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(liveSessionWebSocketServerMessageDtoSchema.parse(message)))
}

export class LiveSessionRoom extends DurableObject<SessionWorkerEnvironment> {
  readonly #activeCommandIds = new Set<string>()
  readonly #activeKeys = new Set<LiveSessionConflictKey>()
  readonly #journal: LiveSessionRoomJournal
  readonly #movementIndexes = new Map<
    string,
    { barriers: CampaignSceneState['barriers']; index: SceneBarrierIndex }
  >()
  #authorityId: string
  #authorityRenewal: Promise<AuthorityRenewalResult> | null = null
  #authorityTransition: Promise<void> = Promise.resolve()
  #deliveryInProgress = false
  #drainInProgress = false
  #hydration: Promise<void> | null = null
  #hydratedForConnectionCycle: boolean
  #release: Promise<void> | null = null
  #snapshot: LiveSessionCoordinatorSnapshotDto | null

  constructor(ctx: DurableObjectState, env: SessionWorkerEnvironment) {
    super(ctx, env)
    this.#journal = new LiveSessionRoomJournal(ctx.storage)
    const meta = this.#journal.loadMeta()
    this.#authorityId = meta?.authorityId ?? crypto.randomUUID()
    this.#snapshot = meta?.snapshotJson
      ? parsePersistedLiveSessionCoordinatorSnapshot(JSON.parse(meta.snapshotJson))
      : null
    this.#hydratedForConnectionCycle = this.#hasOpenSockets() && this.#snapshot !== null
    ctx.blockConcurrencyWhile(async () => {
      if ((await ctx.storage.getAlarm()) !== null) return
      if (this.#journal.activeWorkCount() > 0) {
        await ctx.storage.setAlarm(Date.now() + 1)
        return
      }
      await this.#scheduleAlarm()
    })
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade.', { status: 426 })
    }
    const ticket = request.headers.get(INTERNAL_TICKET_HEADER)
    if (!ticket) return new Response('Live-session ticket is missing.', { status: 401 })

    let claims: LiveSessionTicketClaimsDto
    try {
      claims = await verifyLiveSessionTicket(ticket, this.env.LIVE_SESSION_TICKET_SECRET)
    } catch {
      return new Response('Live-session ticket is invalid.', { status: 401 })
    }

    const meta = this.#journal.ensureRoomIdentity({
      authorityId: this.#authorityId,
      campaignId: claims.campaignId,
      sessionId: claims.sessionId
    })
    this.#authorityId = meta.authorityId
    if (!this.#journal.consumeTicket(claims.jti, claims.exp, Math.floor(Date.now() / 1_000))) {
      return new Response('Live-session ticket was already used.', {
        status: 409
      })
    }
    this.#journal.setReleaseAt(null)

    try {
      if (this.#release) await this.#release
      await this.#ensureHydrated(claims)
      await this.#authorizeJoiningClaims(claims)
    } catch (error) {
      this.#journal.removeTicket(claims.jti)
      if (
        error instanceof LiveSessionJoinAuthorityError ||
        (error instanceof LiveSessionExecutorRequestError && error.code === 'UNAUTHORIZED')
      ) {
        return new Response('Live-session ticket authority is no longer current.', { status: 403 })
      }
      return new Response('The live session could not be loaded.', {
        status: 503
      })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    const attachment: SocketAttachment = {
      campaignId: claims.campaignId,
      role: claims.role,
      sessionId: claims.sessionId,
      socketId: crypto.randomUUID(),
      transientSequences: {},
      transientTokenPaths: {},
      userId: claims.sub
    }
    server.serializeAttachment(attachment)
    this.ctx.acceptWebSocket(server)
    this.#sendReady(server, attachment)
    await this.#scheduleAlarm()
    this.ctx.waitUntil(this.#drain())
    return new Response(null, {
      headers: { 'sec-websocket-protocol': 'artificer.live-session.v1' },
      status: 101,
      webSocket: client
    })
  }

  async webSocketMessage(socket: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    const attachment = parseAttachment(socket)
    if (!attachment || typeof rawMessage !== 'string' || rawMessage.length > MAX_MESSAGE_BYTES) {
      socket.close(1008, 'Invalid live-session message.')
      return
    }
    const parsed = liveSessionWebSocketClientMessageDtoSchema.safeParse(
      (() => {
        try {
          return JSON.parse(rawMessage) as unknown
        } catch {
          return null
        }
      })()
    )
    if (!parsed.success) {
      send(socket, {
        code: 'INVALID_COMMAND',
        commandId: null,
        message: 'The live-session message is invalid.',
        type: 'COMMAND_REJECTED'
      })
      return
    }

    switch (parsed.data.type) {
      case 'COMMAND':
        this.#acceptCommand(socket, attachment, parsed.data.command)
        break
      case 'TRANSIENT':
        this.#broadcastTransient(socket, attachment, parsed.data.envelope)
        break
      case 'RESUME':
        await this.#resume(socket, attachment, parsed.data.pendingCommandIds)
        break
    }
  }

  async #resume(
    socket: WebSocket,
    attachment: SocketAttachment,
    pendingCommandIds: readonly string[]
  ): Promise<void> {
    const meta = this.#journal.loadMeta()
    const renewal = meta ? await this.#renewAuthority(meta) : { available: false, refreshed: false }
    if (!renewal.available) {
      await this.#scheduleAlarm()
      return
    }
    if (!renewal.refreshed) this.#sendReady(socket, attachment)
    for (const command of this.#journal.listByIds(pendingCommandIds)) {
      if (command.actorUserId === attachment.userId) this.#sendJournalStatus(socket, command)
    }
  }

  async webSocketClose(): Promise<void> {
    if (this.#hasOpenSockets()) return
    if (this.#journal.loadMeta()?.authorityRenewalAt === null) return
    const releaseAt = Date.now() + RECONNECT_GRACE_MS
    this.#journal.setReleaseAt(releaseAt)
    await this.#scheduleAlarm()
  }

  async alarm(): Promise<void> {
    const meta = this.#journal.loadMeta()
    if (
      meta?.releaseAt !== null &&
      meta?.releaseAt !== undefined &&
      meta.releaseAt <= Date.now() &&
      !this.#hasOpenSockets() &&
      this.#journal.activeWorkCount() === 0
    ) {
      await this.#releaseAuthority(meta)
      await this.#scheduleAlarm()
      return
    }
    if (
      meta?.authorityRenewalAt !== null &&
      meta?.authorityRenewalAt !== undefined &&
      meta.authorityRenewalAt <= Date.now() &&
      (this.#journal.activeWorkCount() === 0 || meta.authorityRenewalBlocked) &&
      this.#shouldMaintainAuthority(meta)
    ) {
      const authorityAvailable = await this.#renewAuthority(meta)
      if (!authorityAvailable.available) {
        await this.#scheduleAlarm()
        return
      }
    }
    await this.#drain()
    await this.#scheduleAlarm()
  }

  async #ensureHydrated(claims: LiveSessionTicketClaimsDto): Promise<void> {
    if (this.#hydratedForConnectionCycle && this.#snapshot) return
    this.#hydration ??= (async () => {
      const base = {
        authorityId: this.#authorityId,
        campaignId: claims.campaignId,
        sessionId: claims.sessionId,
        userId: claims.sub
      }
      await callLiveSessionExecutor(this.env, { ...base, operation: 'CLAIM' })
      const response = await callLiveSessionExecutor(this.env, {
        ...base,
        operation: 'SNAPSHOT'
      })
      if (response.operation !== 'SNAPSHOT') {
        throw new Error('Live-session executor returned the wrong hydration response.')
      }
      if (base.authorityId !== this.#authorityId) {
        throw new Error('Live-session authority changed while the room was loading.')
      }
      const snapshotJson = JSON.stringify(response.snapshot)
      this.#journal.hydrateAuthority({
        renewalAt: Date.now() + LIVE_SESSION_COMMAND_LEASE_RENEWAL_MS,
        snapshotJson,
        userId: claims.sub
      })
      this.#snapshot = response.snapshot
      this.#hydratedForConnectionCycle = true
    })().finally(() => {
      this.#hydration = null
    })
    await this.#hydration
  }

  #sendReady(socket: WebSocket, attachment: SocketAttachment): void {
    if (!this.#snapshot) return
    const meta = this.#journal.loadMeta()
    if (!meta) return
    send(socket, {
      aggregateVersions: this.#snapshot.aggregateVersions,
      campaignId: attachment.campaignId,
      deliverySequence: meta.deliverySequence,
      encounterActorTokenBindings: this.#visibleEncounterActorTokenBindings(attachment),
      encounterSceneBindings: this.#visibleEncounterSceneBindings(attachment),
      sceneSnapshots: this.#sceneSnapshots(attachment),
      sessionId: attachment.sessionId,
      type: 'READY'
    })
  }

  #broadcastReady(): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = parseAttachment(socket)
      if (attachment) this.#sendReady(socket, attachment)
    }
  }

  #resolvedScene(scene: CampaignSceneState): CampaignSceneState {
    const snapshot = this.#snapshot
    return snapshot
      ? resolveSceneCharacterVision(
          scene,
          snapshot.encounterCharacterBindings,
          snapshot.characterVisions
        )
      : scene
  }

  #sceneSnapshots(
    attachment: SocketAttachment,
    predicate: (scene: CampaignSceneState) => boolean = () => true
  ) {
    return (this.#snapshot?.sceneStates ?? []).filter(predicate).map((scene) => ({
      campaignId: attachment.campaignId,
      scene: projectSceneForViewer(this.#resolvedScene(scene), viewer(attachment)),
      sessionId: attachment.sessionId
    }))
  }

  #sceneSnapshotsForCharacter(attachment: SocketAttachment, characterId: string) {
    const encounterIds = new Set(
      (this.#snapshot?.encounterCharacterBindings ?? [])
        .filter((binding) => binding.characterId === characterId)
        .map((binding) => binding.encounterId)
    )
    const sceneIds = new Set(
      (this.#snapshot?.encounterSceneBindings ?? [])
        .filter((binding) => encounterIds.has(binding.encounterId))
        .map((binding) => binding.sceneId)
    )
    return this.#sceneSnapshots(attachment, (scene) => sceneIds.has(scene.id))
  }

  #visibleEncounterSceneBindings(attachment: SocketAttachment) {
    const sceneIds = new Set(this.#sceneSnapshots(attachment).map((snapshot) => snapshot.scene.id))
    return (this.#snapshot?.encounterSceneBindings ?? []).filter((binding) =>
      sceneIds.has(binding.sceneId)
    )
  }

  #visibleEncounterActorTokenBindings(attachment: SocketAttachment) {
    const tokenIds = new Set(
      this.#sceneSnapshots(attachment).flatMap((snapshot) =>
        snapshot.scene.tokens.map((token) => token.id)
      )
    )
    return (this.#snapshot?.encounterActorTokenBindings ?? []).filter((binding) =>
      tokenIds.has(binding.tokenId)
    )
  }

  #acceptCommand(
    socket: WebSocket,
    attachment: SocketAttachment,
    command: LiveSessionCommandDto
  ): void {
    const snapshot = this.#snapshot
    if (!snapshot) {
      send(socket, {
        code: 'COMMAND_FAILED',
        commandId: commandId(command),
        message: 'The live session is still loading.',
        type: 'COMMAND_REJECTED'
      })
      return
    }
    const prior = this.#journal.findCommand(commandId(command))
    if (isLegacyVisualOnlyDarknessReplayCommand(command) && !prior) {
      send(socket, {
        code: 'INVALID_COMMAND',
        commandId: commandId(command),
        message: 'Legacy visual-only darkness input is valid only for an existing command retry.',
        type: 'COMMAND_REJECTED'
      })
      return
    }
    const currentCommand = withoutLegacyVisualOnlyDarknessReplayMarker(command)
    const payloadJson = currentLiveSessionCommandFingerprint(currentCommand)
    const legacyFingerprint = legacyVisualOnlyDarknessLiveCommandFingerprint(currentCommand)
    let conflictKeys: LiveSessionConflictKey[]
    try {
      conflictKeys = deriveLiveSessionConflictKeys(currentCommand, snapshot)
    } catch {
      send(socket, {
        code: 'INVALID_COMMAND',
        commandId: commandId(command),
        message: 'The live-session command cannot resolve its authoritative Scene.',
        type: 'COMMAND_REJECTED'
      })
      return
    }
    const accepted = this.#journal.acceptCommand({
      actorRole: attachment.role,
      actorUserId: attachment.userId,
      commandId: commandId(command),
      conflictKeys,
      fingerprint: payloadJson,
      originSocketId: attachment.socketId,
      payloadJson
    })
    if (
      (accepted.fingerprint !== payloadJson && accepted.fingerprint !== legacyFingerprint) ||
      accepted.actorUserId !== attachment.userId
    ) {
      send(socket, {
        code: 'INVALID_COMMAND',
        commandId: commandId(command),
        message: 'The command ID was already used with different input.',
        type: 'COMMAND_REJECTED'
      })
      return
    }
    send(socket, {
      acceptedSequence: accepted.acceptedSequence,
      commandId: accepted.commandId,
      type: 'COMMAND_ACCEPTED'
    })
    if (accepted.status !== 'PENDING') this.#sendJournalStatus(socket, accepted)
    this.ctx.waitUntil(this.#drain())
  }

  async #drain(): Promise<void> {
    if (this.#drainInProgress) return
    this.#drainInProgress = true
    try {
      await this.#awaitAuthorityTransitions()
      let meta = this.#journal.loadMeta()
      if (
        !this.#snapshot ||
        !meta ||
        meta.authorityRenewalAt === null ||
        meta.authorityRenewalBlocked
      ) {
        return
      }
      if (meta.authorityRenewalAt <= Date.now()) {
        const authorityAvailable = await this.#renewAuthority(meta)
        if (!authorityAvailable.available) return
        meta = this.#journal.loadMeta()
        if (
          !meta ||
          meta.authorityRenewalAt === null ||
          meta.authorityRenewalBlocked ||
          meta.authorityRenewalAt <= Date.now()
        ) {
          return
        }
      }
      const pending = this.#journal.listPending()
      const runnable = selectRunnableCommands(pending, this.#activeKeys, {
        limit: Math.max(0, MAX_AUTHORITATIVE_COMMANDS_IN_FLIGHT - this.#activeCommandIds.size),
        now: Date.now()
      })
      for (const command of runnable) {
        this.#journal.markExecuting(command.commandId)
        this.#activeCommandIds.add(command.commandId)
        for (const key of command.conflictKeys) this.#activeKeys.add(key)
        this.ctx.waitUntil(this.#runCommand(command))
      }
      await this.#deliverCompleted()
    } finally {
      this.#drainInProgress = false
      await this.#scheduleAlarm()
    }
  }

  async #runCommand(command: LiveSessionJournalCommand): Promise<void> {
    const authorityId = this.#authorityId
    try {
      const payload = JSON.parse(command.payloadJson) as unknown
      const parsedCommand = parsePersistedLiveSessionCommand(payload)
      const meta = this.#journal.loadMeta()
      if (!meta) throw new Error('The live-session room has not been initialized.')
      const snapshot = this.#snapshot
      if (!snapshot) throw new Error('The live-session room snapshot has not been loaded.')
      const response = await callLiveSessionExecutor(this.env, {
        authorityId,
        campaignId: meta.campaignId,
        command: parsedCommand,
        operation: 'COMMAND',
        sceneVisionContext: deriveLiveSessionSceneVisionContext(parsedCommand, snapshot),
        sessionId: meta.sessionId,
        userId: command.actorUserId
      })
      if (response.operation !== 'COMMAND') {
        throw new Error('Live-session executor returned the wrong command response.')
      }
      if (authorityId !== this.#authorityId || !this.#snapshot) {
        this.#journal.markPending(command.commandId, 0)
        return
      }
      const expected = aggregateIdentity(parsedCommand)
      if (
        response.execution.commandId !== command.commandId ||
        response.execution.aggregateKind !== expected.aggregateKind ||
        (expected.aggregateId !== null && response.execution.aggregateId !== expected.aggregateId)
      ) {
        throw new Error('Live-session executor returned a different command identity.')
      }
      this.#journal.markCompleted(command.commandId, JSON.stringify(response.execution))
    } catch (error) {
      if (authorityId !== this.#authorityId || !this.#snapshot) {
        this.#journal.markPending(command.commandId, 0)
      } else if (error instanceof LiveSessionExecutorRequestError && error.retryable) {
        this.#journal.markPending(command.commandId, Date.now() + retryDelay(command.attempts + 1))
      } else {
        const message = rejection(error, command.commandId)
        this.#journal.markRejected(command.commandId, JSON.stringify(message))
        this.#sendRejectedToActor(command, message)
      }
    } finally {
      this.#activeCommandIds.delete(command.commandId)
      for (const key of command.conflictKeys) this.#activeKeys.delete(key)
      await this.#deliverCompleted()
      this.ctx.waitUntil(this.#drain())
    }
  }

  async #deliverCompleted(): Promise<void> {
    const startingSnapshot = this.#snapshot
    if (this.#deliveryInProgress || !startingSnapshot) return
    this.#deliveryInProgress = true
    try {
      let currentSnapshot = startingSnapshot
      for (;;) {
        const completed = this.#journal.listCompleted()
        const deliverable = completed.find((command) => {
          if (!command.resultJson) return false
          const execution = parsePersistedLiveSessionExecutorCommandResult(
            JSON.parse(command.resultJson)
          )
          if (execution.replayed) return true
          return changedAggregatesFor(execution).every((changed) => {
            const current = versionForAggregate(currentSnapshot, changed, execution)
            return current !== null && transitionStart(changed) <= current
          })
        })
        if (!deliverable?.resultJson) break
        const execution = parsePersistedLiveSessionExecutorCommandResult(
          JSON.parse(deliverable.resultJson)
        )
        const changedAggregates = changedAggregatesFor(execution)
        const currentVersions = changedAggregates.map((changed) => ({
          changed,
          current: versionForAggregate(currentSnapshot, changed, execution)
        }))
        const rootsAlreadyRepresented =
          currentVersions.length === 0 ||
          currentVersions.every(
            ({ changed, current }) => current !== null && changed.version <= current
          )
        let replayCatchUp = false
        if (execution.replayed && !rootsAlreadyRepresented) {
          currentSnapshot = await this.#synchronizeReplayedExecution(execution, currentSnapshot)
          replayCatchUp = true
        }
        const reconciledVersions = changedAggregates.map((changed) => ({
          changed,
          current: versionForAggregate(currentSnapshot, changed, execution)
        }))
        if (reconciledVersions.some(({ current }) => current === null)) {
          throw new Error('A changed live-session aggregate was not loaded.')
        }
        const alreadyApplied =
          execution.replayed ||
          (reconciledVersions.length > 0 &&
            reconciledVersions.every(({ changed, current }) => changed.version <= (current ?? -1)))
        if (
          !alreadyApplied &&
          reconciledVersions.some(({ changed, current }) => current !== transitionStart(changed))
        ) {
          throw new Error('Live-session aggregate transition start is stale.')
        }
        let beforeScene: CampaignSceneState | null = null
        let afterScene: CampaignSceneState | null = null
        let nextSnapshot: LiveSessionCoordinatorSnapshotDto = currentSnapshot

        if (
          (!alreadyApplied || (execution.replayed && !replayCatchUp)) &&
          'occurrenceBindingUpdate' in execution &&
          execution.occurrenceBindingUpdate
        ) {
          nextSnapshot = withOccurrenceBindingUpdate(
            nextSnapshot,
            execution.occurrenceBindingUpdate
          )
        }

        if (!alreadyApplied) {
          nextSnapshot = withAggregateVersions(nextSnapshot, changedAggregates)
          const primaryChanged = changedAggregates.some(
            (changed) =>
              changed.aggregateKind === execution.aggregateKind &&
              changed.aggregateId === execution.aggregateId
          )
          if (primaryChanged && execution.aggregateKind === 'CHARACTER') {
            nextSnapshot = {
              ...nextSnapshot,
              characterVisions: [
                ...nextSnapshot.characterVisions.filter(
                  (vision) => vision.characterId !== execution.aggregateId
                ),
                execution.characterVision
              ].sort((left, right) => left.characterId.localeCompare(right.characterId))
            }
          } else if (primaryChanged && execution.aggregateKind === 'SCENE') {
            beforeScene =
              nextSnapshot.sceneStates.find((scene) => scene.id === execution.aggregateId) ?? null
            if (execution.response === null || execution.response.delta === null) {
              afterScene = execution.state
            } else {
              if (!beforeScene) throw new Error('The committed live scene was not loaded.')
              afterScene = applySceneEvent(beforeScene, {
                actorUserId: deliverable.actorUserId,
                commandId: execution.commandId,
                delta: execution.response.delta,
                sceneId: execution.aggregateId,
                version: execution.version
              })
            }
            nextSnapshot = {
              ...nextSnapshot,
              sceneStates: [
                ...nextSnapshot.sceneStates.filter((scene) => scene.id !== execution.aggregateId),
                afterScene
              ]
            }
          }
          if ('spatialRefresh' in execution && execution.spatialRefresh) {
            nextSnapshot = withSpatialRefresh(nextSnapshot, execution.spatialRefresh)
            if (
              execution.aggregateKind === 'SCENE' &&
              execution.spatialRefresh.sceneState.id === execution.aggregateId
            ) {
              afterScene = execution.spatialRefresh.sceneState
            }
          }
          if (execution.aggregateKind === 'ENCOUNTER' && execution.bindingRefresh) {
            nextSnapshot = withEncounterBindingRefresh(nextSnapshot, execution.bindingRefresh)
          }
          if (execution.aggregateKind === 'SESSION') {
            nextSnapshot = {
              ...nextSnapshot,
              sceneStates: execution.sceneState ? [execution.sceneState] : []
            }
          }
        }

        const deliverySequence = (this.#journal.loadMeta()?.deliverySequence ?? 0) + 1
        this.#journal.commitDelivery(
          deliverable.commandId,
          deliverySequence,
          JSON.stringify(nextSnapshot)
        )
        this.#snapshot = nextSnapshot
        currentSnapshot = nextSnapshot
        this.#broadcastCommitted(
          deliverable,
          execution,
          deliverySequence,
          alreadyApplied,
          replayCatchUp,
          beforeScene,
          afterScene
        )
      }
    } finally {
      this.#deliveryInProgress = false
    }
  }

  async #synchronizeReplayedExecution(
    execution: LiveSessionExecutorCommandResultDto,
    currentSnapshot: LiveSessionCoordinatorSnapshotDto
  ): Promise<LiveSessionCoordinatorSnapshotDto> {
    return this.#withAuthorityTransition(async () => {
      const meta = this.#journal.loadMeta()
      if (!meta?.authorityUserId) {
        throw new Error('The live-session room has no current authority for replay recovery.')
      }
      const renewal = await callLiveSessionExecutor(this.env, {
        authorityId: this.#authorityId,
        campaignId: meta.campaignId,
        operation: 'RENEW',
        sessionId: meta.sessionId,
        userId: meta.authorityUserId
      })
      if (renewal.operation !== 'RENEW') {
        throw new Error('Live-session executor returned the wrong replay renewal response.')
      }
      const authorityUserId = this.#reauthorizeSockets(renewal.memberships) ?? meta.authorityUserId
      const snapshotResponse = await callLiveSessionExecutor(this.env, {
        authorityId: this.#authorityId,
        campaignId: meta.campaignId,
        operation: 'SNAPSHOT',
        sessionId: meta.sessionId,
        userId: authorityUserId
      })
      if (snapshotResponse.operation !== 'SNAPSHOT') {
        throw new Error('Live-session executor returned the wrong replay snapshot response.')
      }
      if (
        hasAggregateVersionRegression(
          snapshotResponse.snapshot.aggregateVersions,
          currentSnapshot.aggregateVersions
        )
      ) {
        throw new Error('The replay snapshot regressed a loaded live-session aggregate.')
      }
      for (const changed of changedAggregatesFor(execution)) {
        const current = versionForAggregate(snapshotResponse.snapshot, changed, execution)
        if (current === null || current < changed.version) {
          throw new Error('The replay snapshot did not include the recorded aggregate version.')
        }
      }
      this.#journal.hydrateAuthority({
        renewalAt: Date.now() + LIVE_SESSION_COMMAND_LEASE_RENEWAL_MS,
        snapshotJson: JSON.stringify(snapshotResponse.snapshot),
        userId: authorityUserId
      })
      this.#snapshot = snapshotResponse.snapshot
      this.#movementIndexes.clear()
      return snapshotResponse.snapshot
    })
  }

  #encounterCommittedResponse(
    execution: Extract<LiveSessionExecutorCommandResultDto, { aggregateKind: 'ENCOUNTER' }>,
    attachment: SocketAttachment,
    isRequester: boolean,
    isFresh: boolean
  ) {
    if (attachment.role === 'OWNER') return execution.response
    return isRequester && isFresh ? execution.response : null
  }

  #broadcastCommitted(
    command: LiveSessionJournalCommand,
    execution: LiveSessionExecutorCommandResultDto,
    deliverySequence: number,
    alreadyApplied: boolean,
    replayCatchUp: boolean,
    beforeScene: CampaignSceneState | null,
    afterScene: CampaignSceneState | null
  ): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = parseAttachment(socket)
      if (!attachment) continue
      const isRequester = attachment.userId === command.actorUserId
      if (alreadyApplied && !replayCatchUp && !isRequester) continue
      const base = {
        acceptedSequence: command.acceptedSequence,
        aggregateId: execution.aggregateId,
        changedAggregates: execution.changedAggregates,
        deliverySequence,
        originCommandId: execution.commandId,
        replayed: execution.replayed || alreadyApplied,
        version: execution.version
      }
      const hostTiming = isRequester ? { hostTiming: execution.hostTiming } : {}
      if (execution.aggregateKind === 'CHARACTER') {
        send(socket, {
          ...base,
          ...hostTiming,
          aggregateKind: 'CHARACTER',
          response:
            attachment.role === 'OWNER' || (isRequester && !alreadyApplied)
              ? execution.response
              : null,
          sceneSnapshots: this.#sceneSnapshotsForCharacter(attachment, execution.aggregateId),
          type: 'COMMAND_COMMITTED'
        })
      } else if (execution.aggregateKind === 'ENCOUNTER') {
        const sceneId = this.#snapshot?.encounterSceneBindings.find(
          (binding) => binding.encounterId === execution.aggregateId
        )?.sceneId
        send(socket, {
          ...base,
          ...hostTiming,
          aggregateKind: 'ENCOUNTER',
          encounterActorTokenBindings: this.#visibleEncounterActorTokenBindings(attachment),
          encounterSceneBindings: this.#visibleEncounterSceneBindings(attachment),
          response: this.#encounterCommittedResponse(
            execution,
            attachment,
            isRequester,
            !alreadyApplied
          ),
          sceneSnapshots: sceneId
            ? this.#sceneSnapshots(attachment, (scene) => scene.id === sceneId)
            : [],
          type: 'COMMAND_COMMITTED'
        })
      } else if (execution.aggregateKind === 'SESSION') {
        send(socket, {
          ...base,
          ...hostTiming,
          aggregateKind: 'SESSION',
          response: execution.response,
          sceneSnapshots: this.#sceneSnapshots(attachment),
          type: 'COMMAND_COMMITTED'
        })
      } else {
        const resolvedBefore = beforeScene ? this.#resolvedScene(beforeScene) : null
        const resolvedAfter = afterScene ? this.#resolvedScene(afterScene) : null
        const currentScene = this.#snapshot?.sceneStates.find(
          (scene) => scene.id === execution.aggregateId
        )
        const sendSnapshot =
          attachment.role !== 'OWNER' ||
          execution.response === null ||
          execution.response.delta === null ||
          alreadyApplied
        const delta =
          !sendSnapshot && resolvedBefore && resolvedAfter && execution.response?.delta
            ? projectSceneDeltaForViewer(
                resolvedBefore,
                resolvedAfter,
                viewer(attachment),
                execution.response.delta
              )
            : null
        send(socket, {
          ...base,
          ...hostTiming,
          aggregateKind: 'SCENE',
          delta,
          snapshot:
            sendSnapshot && currentScene
              ? {
                  campaignId: attachment.campaignId,
                  scene: projectSceneForViewer(
                    this.#resolvedScene(currentScene),
                    viewer(attachment)
                  ),
                  sessionId: attachment.sessionId
                }
              : null,
          type: 'COMMAND_COMMITTED'
        })
      }
    }
  }

  #sendJournalStatus(socket: WebSocket, command: LiveSessionJournalCommand): void {
    if (command.status === 'REJECTED' && command.rejectionJson) {
      send(socket, {
        ...(JSON.parse(command.rejectionJson) as LiveSessionRejectedDto),
        type: 'COMMAND_REJECTED'
      })
      return
    }
    if (command.status !== 'COMMITTED' || !command.resultJson || !command.deliverySequence) return
    const execution = parsePersistedLiveSessionExecutorCommandResult(JSON.parse(command.resultJson))
    const base = {
      acceptedSequence: command.acceptedSequence,
      aggregateId: execution.aggregateId,
      changedAggregates: execution.changedAggregates,
      deliverySequence: command.deliverySequence,
      originCommandId: execution.commandId,
      replayed: true,
      version: execution.version
    }
    const hostTiming = { hostTiming: execution.hostTiming }
    if (execution.aggregateKind === 'CHARACTER') {
      const attachment = parseAttachment(socket)
      send(socket, {
        ...base,
        ...hostTiming,
        aggregateKind: 'CHARACTER',
        response: attachment?.role === 'OWNER' ? execution.response : null,
        sceneSnapshots: attachment
          ? this.#sceneSnapshotsForCharacter(attachment, execution.aggregateId)
          : [],
        type: 'COMMAND_COMMITTED'
      })
    } else if (execution.aggregateKind === 'ENCOUNTER') {
      const attachment = parseAttachment(socket)
      send(socket, {
        ...base,
        ...hostTiming,
        aggregateKind: 'ENCOUNTER',
        encounterActorTokenBindings: attachment
          ? this.#visibleEncounterActorTokenBindings(attachment)
          : [],
        encounterSceneBindings: attachment ? this.#visibleEncounterSceneBindings(attachment) : [],
        response: attachment
          ? this.#encounterCommittedResponse(execution, attachment, true, false)
          : null,
        sceneSnapshots: attachment
          ? (() => {
              const sceneId = this.#snapshot?.encounterSceneBindings.find(
                (binding) => binding.encounterId === execution.aggregateId
              )?.sceneId
              return sceneId
                ? this.#sceneSnapshots(attachment, (scene) => scene.id === sceneId)
                : []
            })()
          : [],
        type: 'COMMAND_COMMITTED'
      })
    } else if (execution.aggregateKind === 'SESSION') {
      const attachment = parseAttachment(socket)
      send(socket, {
        ...base,
        ...hostTiming,
        aggregateKind: 'SESSION',
        response: execution.response,
        sceneSnapshots: attachment ? this.#sceneSnapshots(attachment) : [],
        type: 'COMMAND_COMMITTED'
      })
    } else {
      const attachment = parseAttachment(socket)
      const currentScene = this.#snapshot?.sceneStates.find(
        (scene) => scene.id === execution.aggregateId
      )
      send(socket, {
        ...base,
        ...hostTiming,
        aggregateKind: 'SCENE',
        delta: null,
        snapshot:
          attachment && currentScene
            ? {
                campaignId: attachment.campaignId,
                scene: projectSceneForViewer(this.#resolvedScene(currentScene), viewer(attachment)),
                sessionId: attachment.sessionId
              }
            : null,
        type: 'COMMAND_COMMITTED'
      })
    }
  }

  #sendRejectedToActor(command: LiveSessionJournalCommand, message: LiveSessionRejectedDto): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = parseAttachment(socket)
      if (attachment?.userId === command.actorUserId) {
        send(socket, { ...message, type: 'COMMAND_REJECTED' })
      }
    }
  }

  #broadcastTransient(
    origin: WebSocket,
    attachment: SocketAttachment,
    envelope: Extract<
      ReturnType<typeof liveSessionWebSocketClientMessageDtoSchema.parse>,
      { type: 'TRANSIENT' }
    >['envelope']
  ): void {
    const scene = this.#snapshot?.sceneStates.find((candidate) => candidate.id === envelope.sceneId)
    if (!scene || scene.version !== envelope.baselineVersion) return
    const streamKey =
      envelope.kind === 'TOKEN_DRAG_PREVIEW'
        ? `${envelope.kind}:${envelope.tokenId}`
        : envelope.kind === 'FOG_AREA_PREVIEW'
          ? `${envelope.kind}:${envelope.ownerUserId ?? 'SHARED_PARTY'}`
          : envelope.kind
    const previous = attachment.transientSequences[streamKey]
    if (previous !== undefined && envelope.sequence <= previous) return
    if (envelope.kind === 'TOKEN_DRAG_PREVIEW') {
      if (envelope.previewUserId && attachment.role !== 'OWNER') return
      const resolvedScene = this.#resolvedScene(scene)
      const token = resolvedScene.tokens.find((candidate) => candidate.id === envelope.tokenId)
      if (!token || token.locked) return
      if (
        attachment.role !== 'OWNER' &&
        (token.hidden || !token.controlledByUserIds.includes(attachment.userId))
      ) {
        return
      }
      const pathKey = `${envelope.sceneId}:${envelope.baselineVersion}:${envelope.tokenId}`
      const currentPath = attachment.transientTokenPaths[pathKey] ?? [token.position]
      const nextPath =
        envelope.position.x < 0 ||
        envelope.position.y < 0 ||
        envelope.position.x > scene.map.width ||
        envelope.position.y > scene.map.height
          ? currentPath
          : extendSceneMovementPath(
              resolvedScene,
              currentPath,
              envelope.position,
              this.#movementIndex(resolvedScene)
            )
      const accepted =
        nextPath.at(-1)?.x === envelope.position.x && nextPath.at(-1)?.y === envelope.position.y
      const nextAttachment = {
        ...attachment,
        transientSequences: {
          ...attachment.transientSequences,
          [streamKey]: envelope.sequence
        },
        transientTokenPaths: {
          ...attachment.transientTokenPaths,
          [pathKey]: nextPath
        }
      }
      origin.serializeAttachment(nextAttachment)
      if (!accepted) {
        send(origin, {
          message: {
            envelope,
            tokenDragResolution: { accepted: false, path: currentPath },
            userId: attachment.userId,
            visionLayers: []
          },
          type: 'TRANSIENT'
        })
        return
      }
      const previewScene = {
        ...resolvedScene,
        tokens: resolvedScene.tokens.map((candidate) =>
          candidate.id === token.id ? { ...candidate, position: envelope.position } : candidate
        )
      }
      for (const socket of this.ctx.getWebSockets()) {
        const recipient = parseAttachment(socket)
        const recipientViewer: SceneViewer | null =
          socket === origin && recipient?.role === 'OWNER' && envelope.previewUserId
            ? { role: 'PLAYER', userId: envelope.previewUserId }
            : recipient
              ? viewer(recipient)
              : null
        if (
          !recipient ||
          !recipientViewer ||
          !isSceneTokenVisibleToViewer(previewScene, recipientViewer, envelope.tokenId)
        ) {
          continue
        }
        const preview = projectSceneTokenPreviewForViewer(previewScene, {
          path: nextPath,
          tokenId: token.id,
          viewer: recipientViewer
        })
        send(socket, {
          message: {
            envelope: socket === origin ? envelope : { ...envelope, previewUserId: undefined },
            tokenDragResolution: socket === origin ? { accepted: true, path: nextPath } : undefined,
            userId: attachment.userId,
            visionLayers: preview.visionLayers,
            visionReveal: preview.reveal
          },
          type: 'TRANSIENT'
        })
      }
      return
    }
    if (
      envelope.kind === 'FOG_AREA_PREVIEW' &&
      (attachment.role !== 'OWNER' ||
        (scene.fogMode === 'SHARED_PARTY' && envelope.ownerUserId !== null) ||
        (scene.fogMode === 'PER_PLAYER' && envelope.ownerUserId === null))
    ) {
      return
    }
    const nextAttachment = {
      ...attachment,
      transientSequences: {
        ...attachment.transientSequences,
        [streamKey]: envelope.sequence
      }
    }
    origin.serializeAttachment(nextAttachment)
    const message = {
      message: { envelope, userId: attachment.userId },
      type: 'TRANSIENT' as const
    }
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === origin) continue
      const recipient = parseAttachment(socket)
      if (
        !recipient ||
        (envelope.kind === 'FOG_AREA_PREVIEW' &&
          envelope.ownerUserId !== null &&
          recipient.role !== 'OWNER' &&
          recipient.userId !== envelope.ownerUserId)
      ) {
        continue
      }
      send(socket, message)
    }
  }

  #shouldMaintainAuthority(meta: { releaseAt: number | null }): boolean {
    return (
      this.#hasOpenSockets() ||
      this.#journal.activeWorkCount() > 0 ||
      (meta.releaseAt !== null && meta.releaseAt > Date.now())
    )
  }

  #hasOpenSockets(): boolean {
    return this.ctx.getWebSockets().some((socket) => socket.readyState === WebSocket.OPEN)
  }

  #movementIndex(scene: CampaignSceneState): SceneBarrierIndex {
    const cached = this.#movementIndexes.get(scene.id)
    if (cached?.barriers === scene.barriers) return cached.index
    const index = new SceneBarrierIndex(scene.barriers)
    this.#movementIndexes.set(scene.id, { barriers: scene.barriers, index })
    return index
  }

  async #renewAuthority(meta: NonNullable<ReturnType<LiveSessionRoomJournal['loadMeta']>>) {
    if (this.#authorityRenewal) return this.#authorityRenewal
    const renewal = this.#withAuthorityTransition(() => this.#renewAuthorityInternal(meta))
    this.#authorityRenewal = renewal
    try {
      return await renewal
    } finally {
      if (this.#authorityRenewal === renewal) this.#authorityRenewal = null
    }
  }

  async #withAuthorityTransition<T>(operation: () => Promise<T>): Promise<T> {
    const preceding = this.#authorityTransition
    let release!: () => void
    const transition = new Promise<void>((resolve) => {
      release = resolve
    })
    this.#authorityTransition = transition
    await preceding
    try {
      return await operation()
    } finally {
      release()
    }
  }

  async #awaitAuthorityTransitions(): Promise<void> {
    for (;;) {
      const transition = this.#authorityTransition
      await transition
      if (transition === this.#authorityTransition) return
    }
  }

  async #renewAuthorityInternal(meta: NonNullable<ReturnType<LiveSessionRoomJournal['loadMeta']>>) {
    if (!meta.authorityUserId) {
      this.#failAuthorityClosed()
      return { available: false, refreshed: false }
    }
    const candidateUserIds = [
      meta.authorityUserId,
      ...this.ctx.getWebSockets().flatMap((socket) => {
        const attachment = parseAttachment(socket)
        return attachment ? [attachment.userId] : []
      })
    ].filter((userId, index, candidates) => candidates.indexOf(userId) === index)
    for (const candidateUserId of candidateUserIds) {
      try {
        const response = await callLiveSessionExecutor(this.env, {
          authorityId: this.#authorityId,
          campaignId: meta.campaignId,
          operation: 'RENEW',
          sessionId: meta.sessionId,
          userId: candidateUserId
        })
        if (response.operation !== 'RENEW') {
          throw new Error('Live-session executor returned the wrong renewal response.')
        }
        return await this.#applyAuthorityRenewal(meta, candidateUserId, response)
      } catch (error) {
        if (error instanceof LiveSessionExecutorRequestError && error.retryable) {
          this.#journal.setAuthorityRenewal(Date.now() + AUTHORITY_RENEWAL_RETRY_MS, true)
          return { available: false, refreshed: false }
        }
        if (error instanceof LiveSessionExecutorRequestError && error.code === 'UNAUTHORIZED') {
          continue
        }
        this.#failAuthorityClosed()
        return { available: false, refreshed: false }
      }
    }
    this.#failAuthorityClosed()
    return { available: false, refreshed: false }
  }

  async #authorizeJoiningClaims(claims: LiveSessionTicketClaimsDto): Promise<void> {
    await this.#withAuthorityTransition(async () => {
      const meta = this.#journal.loadMeta()
      if (!meta) throw new LiveSessionJoinAuthorityError()
      const response = await callLiveSessionExecutor(this.env, {
        authorityId: this.#authorityId,
        campaignId: meta.campaignId,
        operation: 'RENEW',
        sessionId: meta.sessionId,
        userId: claims.sub
      })
      if (response.operation !== 'RENEW') {
        throw new Error('Live-session executor returned the wrong renewal response.')
      }
      const membership = response.memberships.find(({ userId }) => userId === claims.sub)
      if (membership?.role !== claims.role) throw new LiveSessionJoinAuthorityError()
      await this.#applyAuthorityRenewal(meta, claims.sub, response)
    })
  }

  async #applyAuthorityRenewal(
    meta: NonNullable<ReturnType<LiveSessionRoomJournal['loadMeta']>>,
    candidateUserId: string,
    response: Extract<LiveSessionExecutorResponseDto, { operation: 'RENEW' }>
  ): Promise<AuthorityRenewalResult> {
    const connectedAuthorityUserId = this.#reauthorizeSockets(response.memberships)
    const authorityUserId = connectedAuthorityUserId ?? candidateUserId
    const renewalAt = Date.now() + LIVE_SESSION_COMMAND_LEASE_RENEWAL_MS
    const currentAggregateVersions = this.#snapshot?.aggregateVersions ?? []
    if (
      aggregateVersionsEqual(currentAggregateVersions, response.aggregateVersions) ||
      !hasNewerAggregateVersion(response.aggregateVersions, currentAggregateVersions)
    ) {
      this.#journal.setRenewedAuthority(authorityUserId, renewalAt)
      return { available: true, refreshed: false }
    }
    const snapshotResponse = await callLiveSessionExecutor(this.env, {
      authorityId: this.#authorityId,
      campaignId: meta.campaignId,
      operation: 'SNAPSHOT',
      sessionId: meta.sessionId,
      userId: authorityUserId
    })
    if (snapshotResponse.operation !== 'SNAPSHOT') {
      throw new Error('Live-session executor returned the wrong refresh response.')
    }
    if (
      hasAggregateVersionRegression(
        snapshotResponse.snapshot.aggregateVersions,
        currentAggregateVersions
      )
    ) {
      this.#journal.setRenewedAuthority(authorityUserId, renewalAt)
      return { available: true, refreshed: false }
    }
    const snapshotJson = JSON.stringify(snapshotResponse.snapshot)
    this.#journal.hydrateAuthority({
      renewalAt,
      snapshotJson,
      userId: authorityUserId
    })
    this.#snapshot = snapshotResponse.snapshot
    this.#movementIndexes.clear()
    this.#broadcastReady()
    return { available: true, refreshed: true }
  }

  #reauthorizeSockets(memberships: readonly LiveSessionActiveMembershipDto[]): string | null {
    const roles = new Map(memberships.map(({ role, userId }) => [userId, role]))
    let connectedAuthorityUserId: string | null = null
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = parseAttachment(socket)
      if (!attachment) continue
      if (roles.get(attachment.userId) === attachment.role) {
        connectedAuthorityUserId ??= attachment.userId
        continue
      }
      send(socket, {
        code: 'UNAUTHORIZED',
        commandId: null,
        message: 'Campaign membership changed. Reconnect with a new ticket.',
        type: 'COMMAND_REJECTED'
      })
      socket.close(1008, 'Campaign membership changed.')
    }
    return connectedAuthorityUserId
  }

  async #releaseAuthority(
    meta: NonNullable<ReturnType<LiveSessionRoomJournal['loadMeta']>>
  ): Promise<void> {
    this.#release ??= (async () => {
      try {
        await callLiveSessionExecutor(this.env, {
          authorityId: this.#authorityId,
          campaignId: meta.campaignId,
          operation: 'RELEASE',
          sessionId: meta.sessionId,
          userId: meta.authorityUserId ?? '00000000-0000-0000-0000-000000000000'
        })
      } catch {
        // The lease expires without renewal even when the best-effort release cannot reach the executor.
      } finally {
        this.#journal.setReleaseAt(null)
        this.#journal.setAuthorityRenewal(null)
        this.#hydratedForConnectionCycle = false
      }
    })().finally(() => {
      this.#release = null
    })
    await this.#release
  }

  #failAuthorityClosed(): void {
    const nextAuthorityId = crypto.randomUUID()
    this.#journal.resetAuthority(nextAuthorityId)
    this.#authorityId = nextAuthorityId
    this.#snapshot = null
    this.#hydratedForConnectionCycle = false
    for (const socket of this.ctx.getWebSockets()) {
      socket.close(
        AUTHORITY_LOST_CLOSE_CODE,
        'Live-session authority changed. Reconnect with a new ticket.'
      )
    }
  }

  async #scheduleAlarm(): Promise<void> {
    const meta = this.#journal.loadMeta()
    const now = Date.now()
    const activeWorkCount = this.#journal.activeWorkCount()
    const releaseAt = activeWorkCount === 0 ? (meta?.releaseAt ?? null) : null
    const renewalAt =
      meta?.authorityRenewalAt !== null &&
      meta?.authorityRenewalAt !== undefined &&
      (activeWorkCount === 0 || meta.authorityRenewalBlocked) &&
      this.#shouldMaintainAuthority(meta)
        ? meta.authorityRenewalAt
        : null
    const retryAt =
      meta !== null &&
      meta.authorityRenewalAt !== null &&
      !meta.authorityRenewalBlocked &&
      this.#snapshot !== null
        ? this.#journal.nextRetryAt(now)
        : null
    const times = [retryAt, releaseAt, renewalAt].filter((value): value is number => value !== null)
    const scheduled = await this.ctx.storage.getAlarm()
    if (times.length === 0) {
      if (scheduled !== null) await this.ctx.storage.deleteAlarm()
      return
    }
    const next = Math.max(now + 1, Math.min(...times))
    if (scheduled !== next) await this.ctx.storage.setAlarm(next)
  }
}
