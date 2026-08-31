import { randomUUID } from 'node:crypto'

import {
  classifyLiveSessionCommandError,
  deriveLiveSessionCharacterVision,
  LIVE_SESSION_COMMAND_LEASE_RENEWAL_MS,
  type LiveSessionCommandExecution
} from '@artificer-toolkit/functions/services'
import type { CharacterSheetCommittedRuleSnapshot } from '@artificer-toolkit/functions/services/character'
import type { EncounterActorRuleSnapshot } from '@artificer-toolkit/functions/services/encounter'
import {
  extendSceneMovementPath,
  isSceneTokenVisibleToViewer,
  projectSceneDeltaForViewer,
  projectSceneForViewer,
  projectSceneTokenPreviewForViewer,
  resolveSceneCharacterVision,
  SceneBarrierIndex,
  type CampaignSceneState,
  type ScenePoint,
  type SceneCharacterVision,
  type SceneViewer
} from '@artificer-toolkit/shared/vtt'
import {
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionActiveMembershipDto,
  type LiveSessionCommandDto,
  type LiveSessionAggregateVersionDto,
  type LiveSessionCoordinatorSnapshotDto,
  type LiveSessionJoinOptionsDto,
  type LiveSessionTicketClaimsDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { sceneTransientEnvelopeDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { WebSocket, type RawData } from 'ws'

import type { LiveSessionRoomDependencies } from './dependencies.js'
import { LiveSessionCommandCoordinator } from './liveSessionCommandCoordinator.js'
import {
  deriveLiveSessionConflictKeys,
  deriveLiveSessionSceneVisionContext
} from './liveSessionConflictKeys.js'

export const LIVE_SESSION_RECONNECT_GRACE_MS = 20_000

const MAX_MESSAGE_BYTES = 256 * 1024
const MAX_RECEIPTS = 10_000

export interface LiveSessionRuntimeOptions {
  authorityRenewalMs?: number
  reconnectGraceMs?: number
}

export interface LiveSessionAuth {
  role: 'OWNER' | 'PLAYER'
  userId: string
  options: LiveSessionJoinOptionsDto
}

export interface LiveSessionClient {
  auth: LiveSessionAuth
  id: string
  socket: WebSocket
}

interface LiveSessionReceipt {
  acceptedSequence: number
  actorUserId: string
  beforeScene: CampaignSceneState | null
  deliverySequence: number
  execution: LiveSessionCommandExecution
}

function sessionKey(options: LiveSessionJoinOptionsDto): string {
  return `${options.campaignId}:${options.sessionId}`
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

function aggregateVersionsCover(
  current: readonly LiveSessionAggregateVersionDto[],
  required: readonly LiveSessionAggregateVersionDto[]
): boolean {
  const currentByAggregate = new Map(
    current.map((version) => [`${version.aggregateKind}:${version.aggregateId}`, version.version])
  )
  return required.every(
    (version) =>
      (currentByAggregate.get(`${version.aggregateKind}:${version.aggregateId}`) ?? -1) >=
      version.version
  )
}

function commandFailure(error: unknown, commandId: string | null) {
  const code = classifyLiveSessionCommandError(error)
  if (code === 'UNAUTHORIZED') {
    return {
      code: 'UNAUTHORIZED' as const,
      commandId,
      message: 'This live-session command is not authorized.',
      type: 'COMMAND_REJECTED' as const
    }
  }
  if (code === 'STALE_VERSION') {
    return {
      code: 'STALE_VERSION' as const,
      commandId,
      message: 'The aggregate changed before this command was applied.',
      type: 'COMMAND_REJECTED' as const
    }
  }
  if (code === 'INVALID_COMMAND') {
    return {
      code,
      commandId,
      message: 'The live-session command is invalid.',
      type: 'COMMAND_REJECTED' as const
    }
  }
  return {
    code: 'COMMAND_FAILED' as const,
    commandId,
    message: 'The live-session command failed.',
    type: 'COMMAND_REJECTED' as const
  }
}

export function liveSessionAuthFromTicket(claims: LiveSessionTicketClaimsDto): LiveSessionAuth {
  return {
    options: { campaignId: claims.campaignId, sessionId: claims.sessionId },
    role: claims.role,
    userId: claims.sub
  }
}

function send(client: LiveSessionClient, message: LiveSessionWebSocketServerMessageDto): void {
  if (client.socket.readyState !== WebSocket.OPEN) return
  client.socket.send(JSON.stringify(liveSessionWebSocketServerMessageDtoSchema.parse(message)))
}

function rawText(raw: RawData, binary: boolean): string | null {
  if (binary) return null
  const text = raw.toString()
  return Buffer.byteLength(text, 'utf8') <= MAX_MESSAGE_BYTES ? text : null
}

class LiveSessionRuntime {
  readonly #acceptedSequences = new Map<string, number>()
  readonly #acceptedUserIds = new Map<string, string>()
  readonly #authorityId = randomUUID()
  readonly #characterRuleSnapshots = new Map<string, CharacterSheetCommittedRuleSnapshot>()
  readonly #characterVisions = new Map<string, SceneCharacterVision>()
  readonly #clients = new Map<string, LiveSessionClient>()
  readonly #commandFingerprints = new Map<string, string>()
  readonly #commandRequesters = new Map<string, Set<string>>()
  readonly #encounterRuleSnapshots = new Map<string, EncounterActorRuleSnapshot>()
  readonly #receipts = new Map<string, LiveSessionReceipt>()
  readonly #sceneStates = new Map<string, CampaignSceneState>()
  readonly #movementIndexes = new Map<
    string,
    { barriers: CampaignSceneState['barriers']; index: SceneBarrierIndex }
  >()
  readonly #transientSequences = new Map<string, Map<string, number>>()
  readonly #transientTokenPaths = new Map<string, Map<string, ScenePoint[]>>()
  readonly #authorityRenewalMs: number
  readonly #reconnectGraceMs: number
  #acceptedSequence = 0
  #admissionsInFlight = 0
  #admittedClient = false
  #authorityClaimed = false
  #authorityHeartbeat: ReturnType<typeof setInterval> | null = null
  #authorityRenewal: Promise<{ available: boolean; refreshed: boolean }> | null = null
  #authorityTransition: Promise<void> = Promise.resolve()
  #authorityUserId: string | null = null
  #closed = false
  #coordinator: LiveSessionCommandCoordinator<LiveSessionCommandExecution> | null = null
  #deliverySequence = 0
  #encounterActorTokenBindings: LiveSessionCoordinatorSnapshotDto['encounterActorTokenBindings'] =
    []
  #encounterCharacterBindings: LiveSessionCoordinatorSnapshotDto['encounterCharacterBindings'] = []
  #encounterRuleOccurrenceBindings: LiveSessionCoordinatorSnapshotDto['encounterRuleOccurrenceBindings'] =
    []
  #encounterSceneBindings: LiveSessionCoordinatorSnapshotDto['encounterSceneBindings'] = []
  #expiry: ReturnType<typeof setTimeout> | null = null
  #hydration: Promise<void> = Promise.resolve()

  constructor(
    readonly options: LiveSessionJoinOptionsDto,
    readonly dependencies: LiveSessionRoomDependencies,
    readonly onClosed: () => void,
    runtimeOptions: LiveSessionRuntimeOptions = {}
  ) {
    this.#authorityRenewalMs =
      runtimeOptions.authorityRenewalMs ?? LIVE_SESSION_COMMAND_LEASE_RENEWAL_MS
    this.#reconnectGraceMs = runtimeOptions.reconnectGraceMs ?? LIVE_SESSION_RECONNECT_GRACE_MS
  }

  async add(client: LiveSessionClient): Promise<boolean> {
    this.#admissionsInFlight += 1
    try {
      if (this.#closed) throw new Error('The live session has closed.')
      await this.#hydrate(client.auth.userId)
      await this.#authorizeJoiningClient(client)
      if (this.#closed) throw new Error('The live session closed during admission.')
      if (client.socket.readyState !== WebSocket.OPEN) return false
      this.#clients.set(client.id, client)
      this.#admittedClient = true
      client.socket.once('close', () => this.#remove(client.id))
      client.socket.on('message', (raw, binary) => this.#receive(client, raw, binary))
      if (this.#expiry) clearTimeout(this.#expiry)
      this.#expiry = null
      this.#sendReady(client)
      return true
    } finally {
      this.#admissionsInFlight -= 1
    }
  }

  async #authorizeJoiningClient(client: LiveSessionClient): Promise<void> {
    await this.#withAuthorityTransition(async () => {
      if (this.#closed) throw new Error('The live session closed during admission.')
      const renewal = await this.dependencies.renewAuthority(
        client.auth.userId,
        this.options,
        this.#authorityId
      )
      const membership = renewal.memberships.find(({ userId }) => userId === client.auth.userId)
      if (membership?.role !== client.auth.role) {
        throw new Error('Live-session ticket authority is no longer current.')
      }
      await this.#applyAuthorityRenewal(client.auth.userId, renewal)
    })
  }

  async closeIfAdmissionAbandoned(): Promise<boolean> {
    if (this.#admittedClient || this.#admissionsInFlight > 0 || this.#clients.size > 0) return false
    await this.close()
    return true
  }

  async #hydrate(userId: string): Promise<void> {
    const preceding = this.#hydration
    const hydration = (async () => {
      await preceding.catch(() => undefined)
      if (this.#closed) throw new Error('The live session closed while loading.')
      if (this.#authorityClaimed && this.#coordinator) return
      await this.dependencies.claimAuthority(userId, this.options, this.#authorityId)
      this.#authorityClaimed = true
      this.#authorityUserId = userId
      try {
        const snapshot = await this.dependencies.loadSnapshot(userId, this.options)
        if (this.#closed) throw new Error('The live session closed while loading.')
        this.#applySnapshot(snapshot)
        this.#authorityHeartbeat = setInterval(() => {
          void this.#renewAuthority()
        }, this.#authorityRenewalMs)
        this.#authorityHeartbeat.unref()
      } catch (error) {
        await this.dependencies
          .releaseAuthority(userId, this.options, this.#authorityId)
          .catch(() => {})
        this.#authorityClaimed = false
        this.#authorityUserId = null
        throw error
      }
    })()
    this.#hydration = hydration
    await hydration
  }

  #remove(clientId: string): void {
    this.#clients.delete(clientId)
    this.#transientSequences.delete(clientId)
    this.#transientTokenPaths.delete(clientId)
    for (const requesters of this.#commandRequesters.values()) requesters.delete(clientId)
    if (this.#clients.size > 0 || this.#closed || this.#expiry) return
    this.#expiry = setTimeout(() => void this.close(), this.#reconnectGraceMs)
    this.#expiry.unref()
  }

  #sendReady(client: LiveSessionClient): void {
    const coordinator = this.#coordinator
    if (!coordinator) return
    send(client, {
      aggregateVersions: coordinator.aggregateVersions,
      campaignId: this.options.campaignId,
      deliverySequence: this.#deliverySequence,
      encounterActorTokenBindings: this.#visibleEncounterActorTokenBindings(client),
      encounterSceneBindings: this.#visibleEncounterSceneBindings(client),
      sceneSnapshots: this.#sceneSnapshots(client),
      sessionId: this.options.sessionId,
      type: 'READY'
    })
  }

  #broadcastReady(): void {
    for (const client of this.#clients.values()) this.#sendReady(client)
  }

  #applySnapshot(snapshot: Awaited<ReturnType<LiveSessionRoomDependencies['loadSnapshot']>>): void {
    this.#coordinator = new LiveSessionCommandCoordinator(snapshot.aggregateVersions)
    this.#characterRuleSnapshots.clear()
    this.#characterVisions.clear()
    this.#encounterRuleSnapshots.clear()
    this.#sceneStates.clear()
    this.#movementIndexes.clear()
    for (const { characterId, snapshot: ruleSnapshot } of snapshot.characterRuleSnapshots) {
      this.#characterRuleSnapshots.set(characterId, ruleSnapshot)
      this.#characterVisions.set(
        characterId,
        deriveLiveSessionCharacterVision(characterId, ruleSnapshot)
      )
    }
    for (const { encounterId, snapshot: ruleSnapshot } of snapshot.encounterRuleSnapshots) {
      this.#encounterRuleSnapshots.set(encounterId, ruleSnapshot)
    }
    this.#encounterCharacterBindings = snapshot.encounterCharacterBindings
    this.#encounterActorTokenBindings = snapshot.encounterActorTokenBindings
    this.#encounterRuleOccurrenceBindings = snapshot.encounterRuleOccurrenceBindings ?? []
    this.#encounterSceneBindings = snapshot.encounterSceneBindings
    for (const state of snapshot.sceneStates) this.#sceneStates.set(state.id, state)
  }

  async #renewAuthority(): Promise<{ available: boolean; refreshed: boolean }> {
    if (this.#authorityRenewal) return this.#authorityRenewal
    const renewal = this.#withAuthorityTransition(() => this.#renewAuthorityInternal())
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

  async #renewAuthorityInternal(): Promise<{ available: boolean; refreshed: boolean }> {
    const candidateUserIds = [
      ...(this.#authorityUserId ? [this.#authorityUserId] : []),
      ...[...this.#clients.values()].map((client) => client.auth.userId)
    ].filter((userId, index, candidates) => candidates.indexOf(userId) === index)
    for (const candidateUserId of candidateUserIds) {
      try {
        const renewal = await this.dependencies.renewAuthority(
          candidateUserId,
          this.options,
          this.#authorityId
        )
        return await this.#applyAuthorityRenewal(candidateUserId, renewal)
      } catch {
        // A disconnected or removed authority user may be replaced by another admitted member.
      }
    }
    this.#invalidateAuthority()
    return { available: false, refreshed: false }
  }

  async #applyAuthorityRenewal(
    candidateUserId: string,
    renewal: Awaited<ReturnType<LiveSessionRoomDependencies['renewAuthority']>>
  ): Promise<{ available: true; refreshed: boolean }> {
    const authorityUserId = this.#reauthorizeClients(renewal.memberships) ?? candidateUserId
    this.#authorityUserId = authorityUserId
    const currentVersions = this.#coordinator?.aggregateVersions ?? []
    if (aggregateVersionsEqual(currentVersions, renewal.aggregateVersions)) {
      return { available: true, refreshed: false }
    }
    await this.#coordinator?.drain()
    const snapshot = await this.dependencies.loadSnapshot(authorityUserId, this.options)
    if (this.#closed) return { available: true, refreshed: true }
    this.#applySnapshot(snapshot)
    this.#broadcastReady()
    return { available: true, refreshed: true }
  }

  #reauthorizeClients(memberships: readonly LiveSessionActiveMembershipDto[]): string | null {
    const roles = new Map(memberships.map(({ role, userId }) => [userId, role]))
    let connectedAuthorityUserId: string | null = null
    for (const client of this.#clients.values()) {
      if (roles.get(client.auth.userId) === client.auth.role) {
        connectedAuthorityUserId ??= client.auth.userId
        continue
      }
      send(client, {
        code: 'UNAUTHORIZED',
        commandId: null,
        message: 'Campaign membership changed. Reconnect with a new ticket.',
        type: 'COMMAND_REJECTED'
      })
      client.socket.close(1008, 'Campaign membership changed.')
    }
    return connectedAuthorityUserId
  }

  #resolvedScene(scene: CampaignSceneState): CampaignSceneState {
    return resolveSceneCharacterVision(scene, this.#encounterCharacterBindings, [
      ...this.#characterVisions.values()
    ])
  }

  #sceneSnapshots(
    client: LiveSessionClient,
    predicate: (scene: CampaignSceneState) => boolean = () => true
  ) {
    return [...this.#sceneStates.values()].filter(predicate).map((scene) => ({
      campaignId: this.options.campaignId,
      scene: projectSceneForViewer(this.#resolvedScene(scene), this.#viewer(client)),
      sessionId: this.options.sessionId
    }))
  }

  #sceneSnapshotsForCharacter(client: LiveSessionClient, characterId: string) {
    const encounterIds = new Set(
      this.#encounterCharacterBindings
        .filter((binding) => binding.characterId === characterId)
        .map((binding) => binding.encounterId)
    )
    const sceneIds = new Set(
      this.#encounterSceneBindings
        .filter((binding) => encounterIds.has(binding.encounterId))
        .map((binding) => binding.sceneId)
    )
    return this.#sceneSnapshots(client, (scene) => sceneIds.has(scene.id))
  }

  #visibleEncounterSceneBindings(client: LiveSessionClient) {
    const sceneIds = new Set(this.#sceneSnapshots(client).map((snapshot) => snapshot.scene.id))
    return this.#encounterSceneBindings.filter((binding) => sceneIds.has(binding.sceneId))
  }

  #visibleEncounterActorTokenBindings(client: LiveSessionClient) {
    const tokenIds = new Set(
      this.#sceneSnapshots(client).flatMap((snapshot) =>
        snapshot.scene.tokens.map((token) => token.id)
      )
    )
    return this.#encounterActorTokenBindings.filter((binding) => tokenIds.has(binding.tokenId))
  }

  #viewer(client: LiveSessionClient): SceneViewer {
    return {
      role: client.auth.role === 'OWNER' ? 'GM' : 'PLAYER',
      userId: client.auth.userId
    }
  }

  #receive(client: LiveSessionClient, raw: RawData, binary: boolean): void {
    const text = rawText(raw, binary)
    if (text === null) {
      client.socket.close(1008, 'Invalid live-session message.')
      return
    }
    const parsed = liveSessionWebSocketClientMessageDtoSchema.safeParse(
      (() => {
        try {
          return JSON.parse(text) as unknown
        } catch {
          return null
        }
      })()
    )
    if (!parsed.success) {
      send(client, {
        code: 'INVALID_COMMAND',
        commandId: null,
        message: 'The live-session message is invalid.',
        type: 'COMMAND_REJECTED'
      })
      return
    }
    switch (parsed.data.type) {
      case 'COMMAND':
        void this.#execute(client, parsed.data.command)
        break
      case 'TRANSIENT':
        this.#broadcastTransient(client, parsed.data.envelope)
        break
      case 'RESUME':
        void this.#resume(client, parsed.data.pendingCommandIds)
        break
    }
  }

  async #resume(client: LiveSessionClient, pendingCommandIds: readonly string[]): Promise<void> {
    const renewal = await this.#renewAuthority()
    if (!renewal.available || this.#closed) return
    if (!renewal.refreshed) this.#sendReady(client)
    for (const commandId of pendingCommandIds) {
      const receipt = this.#receipts.get(commandId)
      if (receipt?.actorUserId === client.auth.userId) {
        this.#sendCommitted(client, receipt, true, true, false)
      } else {
        const acceptedSequence = this.#acceptedSequences.get(commandId)
        if (
          acceptedSequence !== undefined &&
          this.#acceptedUserIds.get(commandId) === client.auth.userId
        ) {
          send(client, { acceptedSequence, commandId, type: 'COMMAND_ACCEPTED' })
        }
      }
    }
  }

  #broadcastTransient(client: LiveSessionClient, rawEnvelope: unknown): void {
    const parsed = sceneTransientEnvelopeDtoSchema.safeParse(rawEnvelope)
    if (!parsed.success || this.#closed) return
    const envelope = parsed.data
    const scene = this.#sceneStates.get(envelope.sceneId)
    if (!scene || envelope.baselineVersion !== scene.version) return
    const streamKey =
      envelope.kind === 'TOKEN_DRAG_PREVIEW'
        ? `${envelope.kind}:${envelope.tokenId}`
        : envelope.kind === 'FOG_AREA_PREVIEW'
          ? `${envelope.kind}:${envelope.ownerUserId ?? 'SHARED_PARTY'}`
          : envelope.kind
    const sequences = this.#transientSequences.get(client.id) ?? new Map<string, number>()
    const priorSequence = sequences.get(streamKey)
    if (priorSequence !== undefined && envelope.sequence <= priorSequence) return
    if (envelope.kind === 'TOKEN_DRAG_PREVIEW') {
      if (envelope.previewUserId && client.auth.role !== 'OWNER') return
      const resolvedScene = this.#resolvedScene(scene)
      const token = resolvedScene.tokens.find((candidate) => candidate.id === envelope.tokenId)
      if (
        !token ||
        token.locked ||
        (client.auth.role !== 'OWNER' &&
          (token.hidden || !token.controlledByUserIds.includes(client.auth.userId)))
      ) {
        return
      }
      const paths = this.#transientTokenPaths.get(client.id) ?? new Map()
      const pathKey = `${envelope.sceneId}:${envelope.baselineVersion}:${envelope.tokenId}`
      const currentPath = paths.get(pathKey) ?? [token.position]
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
      sequences.set(streamKey, envelope.sequence)
      this.#transientSequences.set(client.id, sequences)
      paths.set(pathKey, nextPath)
      this.#transientTokenPaths.set(client.id, paths)
      if (!accepted) {
        send(client, {
          message: {
            envelope,
            tokenDragResolution: { accepted: false, path: currentPath },
            userId: client.auth.userId,
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
      for (const peer of this.#clients.values()) {
        const peerViewer: SceneViewer =
          peer.id === client.id && peer.auth.role === 'OWNER' && envelope.previewUserId
            ? { role: 'PLAYER', userId: envelope.previewUserId }
            : this.#viewer(peer)
        if (!isSceneTokenVisibleToViewer(previewScene, peerViewer, token.id)) continue
        const preview = projectSceneTokenPreviewForViewer(previewScene, {
          path: nextPath,
          tokenId: token.id,
          viewer: peerViewer
        })
        send(peer, {
          message: {
            envelope: peer.id === client.id ? envelope : { ...envelope, previewUserId: undefined },
            tokenDragResolution:
              peer.id === client.id ? { accepted: true, path: nextPath } : undefined,
            userId: client.auth.userId,
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
      (client.auth.role !== 'OWNER' ||
        (scene.fogMode === 'SHARED_PARTY' && envelope.ownerUserId !== null) ||
        (scene.fogMode === 'PER_PLAYER' && envelope.ownerUserId === null))
    ) {
      return
    }
    sequences.set(streamKey, envelope.sequence)
    this.#transientSequences.set(client.id, sequences)
    const message = { envelope, userId: client.auth.userId }
    for (const peer of this.#clients.values()) {
      if (
        peer.id !== client.id &&
        (envelope.kind !== 'FOG_AREA_PREVIEW' ||
          envelope.ownerUserId === null ||
          peer.auth.role === 'OWNER' ||
          peer.auth.userId === envelope.ownerUserId)
      ) {
        send(peer, { message, type: 'TRANSIENT' })
      }
    }
  }

  async #execute(client: LiveSessionClient, command: LiveSessionCommandDto): Promise<void> {
    if (this.#closed) return
    await this.#awaitAuthorityTransitions()
    const coordinator = this.#coordinator
    const id = command.command.commandId
    if (!coordinator) {
      send(client, commandFailure(new Error('The live session is still loading.'), id))
      return
    }

    const fingerprint = JSON.stringify(command)
    const priorFingerprint = this.#commandFingerprints.get(id)
    if (priorFingerprint && priorFingerprint !== fingerprint) {
      send(client, commandFailure(new Error('The command ID was reused with different input.'), id))
      return
    }
    const priorReceipt = this.#receipts.get(id)
    if (priorReceipt) {
      if (priorReceipt.actorUserId !== client.auth.userId) {
        send(client, {
          code: 'UNAUTHORIZED',
          commandId: id,
          message: 'The command receipt belongs to another user.',
          type: 'COMMAND_REJECTED'
        })
        return
      }
      send(client, {
        acceptedSequence: priorReceipt.acceptedSequence,
        commandId: id,
        type: 'COMMAND_ACCEPTED'
      })
      this.#sendCommitted(client, priorReceipt, true, true, false)
      return
    }
    if (priorFingerprint) {
      if (this.#acceptedUserIds.get(id) !== client.auth.userId) {
        send(client, {
          code: 'UNAUTHORIZED',
          commandId: id,
          message: 'The pending command belongs to another user.',
          type: 'COMMAND_REJECTED'
        })
        return
      }
      this.#commandRequesters.get(id)?.add(client.id)
      const acceptedSequence = this.#acceptedSequences.get(id)
      if (acceptedSequence !== undefined) {
        send(client, { acceptedSequence, commandId: id, type: 'COMMAND_ACCEPTED' })
      }
      return
    }

    const acceptedSequence = ++this.#acceptedSequence
    this.#acceptedSequences.set(id, acceptedSequence)
    this.#acceptedUserIds.set(id, client.auth.userId)
    this.#commandFingerprints.set(id, fingerprint)
    this.#commandRequesters.set(id, new Set([client.id]))
    send(client, { acceptedSequence, commandId: id, type: 'COMMAND_ACCEPTED' })

    try {
      const characterSnapshot =
        command.aggregateKind === 'CHARACTER'
          ? this.#characterRuleSnapshots.get(command.characterId)
          : undefined
      const committedRuleSnapshot =
        command.aggregateKind === 'CHARACTER' &&
        characterSnapshot?.streamVersion === command.command.expectedVersion
          ? characterSnapshot
          : undefined
      const encounterSnapshot =
        command.aggregateKind === 'ENCOUNTER'
          ? this.#encounterRuleSnapshots.get(command.command.encounterId)
          : undefined
      const committedEncounterRuleSnapshot =
        command.aggregateKind === 'ENCOUNTER' &&
        'expectedVersion' in command.command &&
        encounterSnapshot?.encounterVersion === command.command.expectedVersion
          ? encounterSnapshot
          : undefined
      const aggregate =
        command.aggregateKind === 'CHARACTER'
          ? { aggregateKind: 'CHARACTER' as const, aggregateId: command.characterId }
          : command.aggregateKind === 'SESSION'
            ? { aggregateKind: 'SESSION' as const, aggregateId: command.command.sessionId }
            : command.aggregateKind === 'SCENE'
              ? {
                  aggregateKind: 'SCENE' as const,
                  aggregateId: command.command.sceneId
                }
              : {
                  aggregateKind: 'ENCOUNTER' as const,
                  aggregateId: command.command.encounterId
                }
      const liveSnapshot = {
        characterVisions: [...this.#characterVisions.values()],
        encounterActorTokenBindings: this.#encounterActorTokenBindings,
        encounterCharacterBindings: this.#encounterCharacterBindings,
        encounterRuleOccurrenceBindings: this.#encounterRuleOccurrenceBindings,
        encounterSceneBindings: this.#encounterSceneBindings,
        sceneStates: [...this.#sceneStates.values()]
      }
      const coordinated = await coordinator.enqueue(
        aggregate,
        deriveLiveSessionConflictKeys(command, liveSnapshot),
        () =>
          this.dependencies.execute(
            client.auth.userId,
            this.options,
            command,
            this.#authorityId,
            deriveLiveSessionSceneVisionContext(command, liveSnapshot),
            committedRuleSnapshot,
            committedEncounterRuleSnapshot
          )
      )
      const execution = coordinated.execution
      const stored = this.#receipts.get(id)
      if (coordinated.replayed && stored) {
        this.#sendCommitted(client, stored, true, true, false)
        return
      }

      if (coordinated.refreshRequired) {
        await this.#refreshAfterPersistedReplay(client, coordinator, execution.changedAggregates)
        if (this.#closed) return
      }

      const beforeScene =
        execution.aggregateKind === 'SCENE'
          ? (this.#sceneStates.get(execution.aggregateId) ?? null)
          : null

      if (
        !coordinated.refreshRequired &&
        'occurrenceBindingUpdate' in execution &&
        execution.occurrenceBindingUpdate
      ) {
        this.#encounterRuleOccurrenceBindings = this.#encounterRuleOccurrenceBindings.filter(
          (binding) => binding.encounterId !== execution.occurrenceBindingUpdate!.encounterId
        )
        if (execution.occurrenceBindingUpdate.binding) {
          this.#encounterRuleOccurrenceBindings.push(execution.occurrenceBindingUpdate.binding)
        }
      }

      if (!coordinated.replayed) {
        if ('spatialRefresh' in execution && execution.spatialRefresh) {
          for (const { characterId, snapshot } of execution.spatialRefresh.characterRuleSnapshots) {
            this.#characterRuleSnapshots.set(characterId, snapshot)
          }
          for (const vision of execution.spatialRefresh.characterVisions) {
            this.#characterVisions.set(vision.characterId, vision)
          }
          if (execution.spatialRefresh.encounterRuleSnapshot) {
            const encounterId =
              execution.aggregateKind === 'ENCOUNTER'
                ? execution.aggregateId
                : this.#encounterSceneBindings.find(
                    (binding) => binding.sceneId === execution.spatialRefresh!.sceneState.id
                  )?.encounterId
            if (!encounterId) throw new Error('Spatial refresh requires its Encounter binding.')
            this.#encounterRuleSnapshots.set(
              encounterId,
              execution.spatialRefresh.encounterRuleSnapshot
            )
          }
          this.#sceneStates.set(
            execution.spatialRefresh.sceneState.id,
            execution.spatialRefresh.sceneState
          )
        }
        if (execution.aggregateKind === 'CHARACTER') {
          if (execution.ruleSnapshot) {
            this.#characterRuleSnapshots.set(execution.aggregateId, execution.ruleSnapshot)
            this.#characterVisions.set(
              execution.aggregateId,
              deriveLiveSessionCharacterVision(execution.aggregateId, execution.ruleSnapshot)
            )
          } else {
            this.#characterRuleSnapshots.delete(execution.aggregateId)
            this.#characterVisions.set(execution.aggregateId, execution.characterVision)
          }
        } else if (execution.aggregateKind === 'ENCOUNTER' && execution.ruleSnapshot) {
          this.#encounterRuleSnapshots.set(execution.aggregateId, execution.ruleSnapshot)
        }
        if (execution.aggregateKind === 'ENCOUNTER' && execution.bindingRefresh) {
          const refresh = execution.bindingRefresh
          this.#encounterActorTokenBindings = [
            ...this.#encounterActorTokenBindings.filter(
              (binding) => binding.encounterId !== refresh.encounterId
            ),
            ...refresh.encounterActorTokenBindings
          ]
          this.#encounterCharacterBindings = [
            ...this.#encounterCharacterBindings.filter(
              (binding) => binding.encounterId !== refresh.encounterId
            ),
            ...refresh.encounterCharacterBindings
          ]
          this.#encounterSceneBindings = [
            ...this.#encounterSceneBindings.filter(
              (binding) => binding.encounterId !== refresh.encounterId
            ),
            ...(refresh.encounterSceneBinding ? [refresh.encounterSceneBinding] : [])
          ]
        }
        if (execution.aggregateKind === 'SESSION') {
          this.#sceneStates.clear()
          if (execution.sceneState)
            this.#sceneStates.set(execution.sceneState.id, execution.sceneState)
        }
        if (execution.aggregateKind === 'SCENE') {
          this.#sceneStates.set(execution.aggregateId, execution.state)
        }
      }

      const receipt: LiveSessionReceipt = {
        acceptedSequence,
        actorUserId: client.auth.userId,
        beforeScene: coordinated.replayed ? null : beforeScene,
        deliverySequence: ++this.#deliverySequence,
        execution
      }
      this.#rememberReceipt(id, receipt)
      if (coordinated.replayed && !coordinated.refreshRequired) {
        this.#sendCommitted(client, receipt, true, true, false)
      } else {
        const requesters = this.#commandRequesters.get(id) ?? new Set<string>()
        for (const peer of this.#clients.values()) {
          const isRequester = requesters.has(peer.id)
          this.#sendCommitted(
            peer,
            receipt,
            coordinated.replayed,
            isRequester,
            !coordinated.replayed && isRequester && peer.auth.userId === client.auth.userId
          )
        }
      }
    } catch (error) {
      this.#acceptedSequences.delete(id)
      this.#acceptedUserIds.delete(id)
      this.#commandFingerprints.delete(id)
      const rejection = commandFailure(error, id)
      const requesters = this.#commandRequesters.get(id) ?? new Set([client.id])
      for (const requesterId of requesters) {
        const requester = this.#clients.get(requesterId)
        if (requester) send(requester, rejection)
      }
    } finally {
      this.#commandRequesters.delete(id)
    }
  }

  async #refreshAfterPersistedReplay(
    client: LiveSessionClient,
    coordinator: LiveSessionCommandCoordinator<LiveSessionCommandExecution>,
    requiredVersions: readonly LiveSessionAggregateVersionDto[]
  ): Promise<void> {
    await this.#withAuthorityTransition(async () => {
      await coordinator.drain()
      const renewal = await this.dependencies.renewAuthority(
        client.auth.userId,
        this.options,
        this.#authorityId
      )
      const authorityUserId = this.#reauthorizeClients(renewal.memberships) ?? client.auth.userId
      const snapshot = await this.dependencies.loadSnapshot(authorityUserId, this.options)
      if (
        !aggregateVersionsCover(snapshot.aggregateVersions, coordinator.aggregateVersions) ||
        !aggregateVersionsCover(snapshot.aggregateVersions, requiredVersions)
      ) {
        throw new Error('The authoritative live-session snapshot is behind the persisted replay.')
      }
      if (this.#closed) return
      this.#authorityUserId = authorityUserId
      this.#applySnapshot(snapshot)
    })
  }

  #movementIndex(scene: CampaignSceneState): SceneBarrierIndex {
    const cached = this.#movementIndexes.get(scene.id)
    if (cached?.barriers === scene.barriers) return cached.index
    const index = new SceneBarrierIndex(scene.barriers)
    this.#movementIndexes.set(scene.id, { barriers: scene.barriers, index })
    return index
  }

  #sendCommitted(
    client: LiveSessionClient,
    receipt: LiveSessionReceipt,
    replayed: boolean,
    includeResponse: boolean,
    currentAuthorityVerified: boolean
  ): void {
    const base = {
      acceptedSequence: receipt.acceptedSequence,
      aggregateId: receipt.execution.aggregateId,
      deliverySequence: receipt.deliverySequence,
      originCommandId: receipt.execution.commandId,
      replayed,
      changedAggregates: receipt.execution.changedAggregates,
      type: 'COMMAND_COMMITTED' as const,
      version: receipt.execution.version
    }
    if (receipt.execution.aggregateKind === 'CHARACTER') {
      send(client, {
        ...base,
        aggregateKind: 'CHARACTER',
        response:
          client.auth.role === 'OWNER' || (includeResponse && currentAuthorityVerified)
            ? receipt.execution.response
            : null,
        sceneSnapshots: this.#sceneSnapshotsForCharacter(client, receipt.execution.aggregateId)
      })
      return
    }
    if (receipt.execution.aggregateKind === 'ENCOUNTER') {
      const sceneId = this.#encounterSceneBindings.find(
        (binding) => binding.encounterId === receipt.execution.aggregateId
      )?.sceneId
      send(client, {
        ...base,
        aggregateKind: 'ENCOUNTER',
        encounterActorTokenBindings: this.#visibleEncounterActorTokenBindings(client),
        encounterSceneBindings: this.#visibleEncounterSceneBindings(client),
        response:
          client.auth.role === 'OWNER' || (includeResponse && currentAuthorityVerified)
            ? receipt.execution.response
            : null,
        sceneSnapshots: sceneId ? this.#sceneSnapshots(client, (scene) => scene.id === sceneId) : []
      })
      return
    }
    if (receipt.execution.aggregateKind === 'SESSION') {
      send(client, {
        ...base,
        aggregateKind: 'SESSION',
        response: receipt.execution.response,
        sceneSnapshots: this.#sceneSnapshots(client)
      })
      return
    }
    const currentScene = this.#sceneStates.get(receipt.execution.aggregateId)
    const sendSnapshot =
      client.auth.role !== 'OWNER' || receipt.execution.response === null || replayed
    send(client, {
      ...base,
      aggregateKind: 'SCENE',
      delta:
        !sendSnapshot &&
        receipt.beforeScene &&
        receipt.execution.response &&
        receipt.execution.response.delta
          ? projectSceneDeltaForViewer(
              this.#resolvedScene(receipt.beforeScene),
              this.#resolvedScene(receipt.execution.state),
              this.#viewer(client),
              receipt.execution.response.delta
            )
          : null,
      snapshot:
        sendSnapshot && currentScene
          ? {
              campaignId: client.auth.options.campaignId,
              scene: projectSceneForViewer(this.#resolvedScene(currentScene), this.#viewer(client)),
              sessionId: client.auth.options.sessionId
            }
          : null
    })
  }

  #rememberReceipt(commandId: string, receipt: LiveSessionReceipt): void {
    if (this.#receipts.size >= MAX_RECEIPTS) {
      const oldest = this.#receipts.keys().next().value
      if (oldest) {
        this.#acceptedSequences.delete(oldest)
        this.#acceptedUserIds.delete(oldest)
        this.#commandFingerprints.delete(oldest)
        this.#receipts.delete(oldest)
      }
    }
    this.#receipts.set(commandId, receipt)
  }

  #invalidateAuthority(): void {
    for (const client of this.#clients.values()) {
      client.socket.close(1012, 'Live-session authority expired.')
    }
    void this.close()
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    if (this.#expiry) clearTimeout(this.#expiry)
    if (this.#authorityHeartbeat) clearInterval(this.#authorityHeartbeat)
    this.#expiry = null
    this.#authorityHeartbeat = null
    for (const client of this.#clients.values()) client.socket.close(1001, 'Session closed.')
    this.#clients.clear()
    await this.#hydration.catch(() => undefined)
    await this.#awaitAuthorityTransitions()
    const coordinator = this.#coordinator
    this.#coordinator = null
    await coordinator?.drain()
    if (this.#authorityClaimed && this.#authorityUserId) {
      await this.dependencies
        .releaseAuthority(this.#authorityUserId, this.options, this.#authorityId)
        .catch(() => {})
    }
    this.#authorityClaimed = false
    this.onClosed()
  }
}

export class LiveSessionRuntimeManager {
  readonly #runtimes = new Map<string, LiveSessionRuntime>()

  constructor(
    readonly dependencies: LiveSessionRoomDependencies,
    readonly options: LiveSessionRuntimeOptions = {}
  ) {}

  async join(client: LiveSessionClient): Promise<void> {
    const options = client.auth.options
    const key = sessionKey(options)
    let runtime = this.#runtimes.get(key)
    if (!runtime) {
      runtime = new LiveSessionRuntime(
        options,
        this.dependencies,
        () => {
          if (this.#runtimes.get(key) === runtime) this.#runtimes.delete(key)
        },
        this.options
      )
      this.#runtimes.set(key, runtime)
    }
    try {
      const admitted = await runtime.add(client)
      if (!admitted) await runtime.closeIfAdmissionAbandoned()
    } catch (error) {
      await runtime.closeIfAdmissionAbandoned()
      throw error
    }
  }

  async dispose(): Promise<void> {
    await Promise.all([...this.#runtimes.values()].map((runtime) => runtime.close()))
    this.#runtimes.clear()
  }
}
