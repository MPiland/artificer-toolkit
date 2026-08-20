import { randomUUID } from 'node:crypto'

import {
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
  type EncounterSceneState,
  type ScenePoint,
  type SceneViewer
} from '@artificer-toolkit/shared/vtt'
import {
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionActiveMembershipDto,
  type LiveSessionCommandDto,
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
  beforeScene: EncounterSceneState | null
  deliverySequence: number
  execution: LiveSessionCommandExecution
}

function sessionKey(options: LiveSessionJoinOptionsDto): string {
  return `${options.campaignId}:${options.sessionId}`
}

function commandFailure(error: unknown, commandId: string | null) {
  const name = error instanceof Error ? error.name : ''
  if (name === 'CampaignAccessError' || name === 'LiveSessionAuthorityError') {
    return {
      code: 'UNAUTHORIZED' as const,
      commandId,
      message: 'This live-session command is not authorized.',
      type: 'COMMAND_REJECTED' as const
    }
  }
  if (name === 'ConcurrencyError' || name === 'EncounterConflictError') {
    return {
      code: 'STALE_VERSION' as const,
      commandId,
      message: 'The aggregate changed before this command was applied.',
      type: 'COMMAND_REJECTED' as const
    }
  }
  const message = error instanceof Error ? error.message.trim() : ''
  return {
    code: 'COMMAND_FAILED' as const,
    commandId,
    message: (message || 'The live-session command failed.').slice(0, 300),
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
  readonly #clients = new Map<string, LiveSessionClient>()
  readonly #commandFingerprints = new Map<string, string>()
  readonly #commandRequesters = new Map<string, Set<string>>()
  readonly #encounterRuleSnapshots = new Map<string, EncounterActorRuleSnapshot>()
  readonly #receipts = new Map<string, LiveSessionReceipt>()
  readonly #sceneStates = new Map<string, EncounterSceneState>()
  readonly #movementIndexes = new Map<
    string,
    { barriers: EncounterSceneState['barriers']; index: SceneBarrierIndex }
  >()
  readonly #transientSequences = new Map<string, Map<string, number>>()
  readonly #transientTokenPaths = new Map<string, Map<string, ScenePoint[]>>()
  readonly #authorityRenewalMs: number
  readonly #reconnectGraceMs: number
  #acceptedSequence = 0
  #authorityClaimed = false
  #authorityHeartbeat: ReturnType<typeof setInterval> | null = null
  #authorityUserId: string | null = null
  #closed = false
  #coordinator: LiveSessionCommandCoordinator<LiveSessionCommandExecution> | null = null
  #deliverySequence = 0
  #encounterCharacterBindings: LiveSessionCoordinatorSnapshotDto['encounterCharacterBindings'] = []
  #expiry: ReturnType<typeof setTimeout> | null = null
  #hydration: Promise<void> | null = null

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

  async add(client: LiveSessionClient): Promise<void> {
    if (this.#closed) throw new Error('The live session has closed.')
    this.#clients.set(client.id, client)
    client.socket.once('close', () => this.#remove(client.id))
    client.socket.on('message', (raw, binary) => this.#receive(client, raw, binary))
    await this.#hydrate(client.auth.userId)
    if (this.#closed || client.socket.readyState !== WebSocket.OPEN) return
    if (this.#expiry) clearTimeout(this.#expiry)
    this.#expiry = null
    this.#sendReady(client)
  }

  async #hydrate(userId: string): Promise<void> {
    this.#hydration ??= (async () => {
      await this.dependencies.claimAuthority(userId, this.options, this.#authorityId)
      this.#authorityClaimed = true
      this.#authorityUserId = userId
      try {
        const {
          aggregateVersions,
          characterRuleSnapshots,
          encounterCharacterBindings,
          encounterRuleSnapshots,
          sceneStates
        } = await this.dependencies.loadSnapshot(userId, this.options)
        if (this.#closed) throw new Error('The live session closed while loading.')
        this.#coordinator = new LiveSessionCommandCoordinator(aggregateVersions)
        for (const { characterId, snapshot } of characterRuleSnapshots) {
          this.#characterRuleSnapshots.set(characterId, snapshot)
        }
        for (const { encounterId, snapshot } of encounterRuleSnapshots) {
          this.#encounterRuleSnapshots.set(encounterId, snapshot)
        }
        this.#encounterCharacterBindings = encounterCharacterBindings
        for (const state of sceneStates) this.#sceneStates.set(state.id, state)
        this.#authorityHeartbeat = setInterval(() => {
          void this.#renewAuthority()
        }, this.#authorityRenewalMs)
        this.#authorityHeartbeat.unref()
      } catch (error) {
        await this.dependencies
          .releaseAuthority(userId, this.options, this.#authorityId)
          .catch(() => {})
        this.#authorityClaimed = false
        throw error
      }
    })()
    await this.#hydration
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
      sceneSnapshots: this.#sceneSnapshots(client),
      sessionId: this.options.sessionId,
      type: 'READY'
    })
  }

  async #renewAuthority(): Promise<void> {
    const candidateUserIds = [
      ...(this.#authorityUserId ? [this.#authorityUserId] : []),
      ...[...this.#clients.values()].map((client) => client.auth.userId)
    ].filter((userId, index, candidates) => candidates.indexOf(userId) === index)
    for (const candidateUserId of candidateUserIds) {
      try {
        const memberships = await this.dependencies.renewAuthority(
          candidateUserId,
          this.options,
          this.#authorityId
        )
        this.#authorityUserId = this.#reauthorizeClients(memberships) ?? candidateUserId
        return
      } catch {
        // A disconnected or removed authority user may be replaced by another admitted member.
      }
    }
    this.#invalidateAuthority()
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

  #resolvedScene(scene: EncounterSceneState): EncounterSceneState {
    return resolveSceneCharacterVision(
      scene,
      this.#encounterCharacterBindings,
      [...this.#characterRuleSnapshots].map(([characterId, snapshot]) =>
        deriveLiveSessionCharacterVision(characterId, snapshot)
      )
    )
  }

  #sceneSnapshots(
    client: LiveSessionClient,
    predicate: (scene: EncounterSceneState) => boolean = () => true
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
    return this.#sceneSnapshots(client, (scene) => encounterIds.has(scene.encounterId))
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
        this.#sendReady(client)
        for (const commandId of parsed.data.pendingCommandIds) {
          const receipt = this.#receipts.get(commandId)
          if (receipt?.actorUserId === client.auth.userId) {
            this.#sendCommitted(client, receipt, true, true)
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
        break
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
      send(client, {
        acceptedSequence: priorReceipt.acceptedSequence,
        commandId: id,
        type: 'COMMAND_ACCEPTED'
      })
      this.#sendCommitted(client, priorReceipt, true, true)
      return
    }
    if (priorFingerprint) {
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
        encounterSnapshot?.encounterVersion === command.command.expectedVersion
          ? encounterSnapshot
          : undefined
      const aggregate =
        command.aggregateKind === 'CHARACTER'
          ? { aggregateKind: 'CHARACTER' as const, aggregateId: command.characterId }
          : command.aggregateKind === 'SCENE'
            ? {
                aggregateKind: 'SCENE' as const,
                aggregateId:
                  command.command.type === 'ATTACH_SCENE' ? null : command.command.sceneId
              }
            : {
                aggregateKind: 'ENCOUNTER' as const,
                aggregateId: command.command.encounterId
              }
      const liveSnapshot = {
        characterVisions: [...this.#characterRuleSnapshots].map(([characterId, snapshot]) =>
          deriveLiveSessionCharacterVision(characterId, snapshot)
        ),
        encounterCharacterBindings: this.#encounterCharacterBindings,
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
        this.#sendCommitted(client, stored, true, true)
        return
      }

      const beforeScene =
        execution.aggregateKind === 'SCENE'
          ? (this.#sceneStates.get(execution.aggregateId) ?? null)
          : null

      if (!coordinated.replayed) {
        if (execution.aggregateKind === 'CHARACTER') {
          if (execution.ruleSnapshot) {
            this.#characterRuleSnapshots.set(execution.aggregateId, execution.ruleSnapshot)
          }
        } else if (execution.aggregateKind === 'ENCOUNTER' && execution.ruleSnapshot) {
          this.#encounterRuleSnapshots.set(execution.aggregateId, execution.ruleSnapshot)
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
      if (coordinated.replayed) {
        this.#sendCommitted(client, receipt, true, true)
      } else {
        const requesters = this.#commandRequesters.get(id) ?? new Set<string>()
        for (const peer of this.#clients.values()) {
          this.#sendCommitted(peer, receipt, false, requesters.has(peer.id))
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

  #movementIndex(scene: EncounterSceneState): SceneBarrierIndex {
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
    includeResponse: boolean
  ): void {
    const base = {
      acceptedSequence: receipt.acceptedSequence,
      aggregateId: receipt.execution.aggregateId,
      deliverySequence: receipt.deliverySequence,
      originCommandId: receipt.execution.commandId,
      replayed,
      type: 'COMMAND_COMMITTED' as const,
      version: receipt.execution.version
    }
    if (receipt.execution.aggregateKind === 'CHARACTER') {
      send(client, {
        ...base,
        aggregateKind: 'CHARACTER',
        response: includeResponse ? receipt.execution.response : null,
        sceneSnapshots: this.#sceneSnapshotsForCharacter(client, receipt.execution.aggregateId)
      })
      return
    }
    if (receipt.execution.aggregateKind === 'ENCOUNTER') {
      send(client, {
        ...base,
        aggregateKind: 'ENCOUNTER',
        response: includeResponse ? receipt.execution.response : null,
        sceneSnapshots: this.#sceneSnapshots(
          client,
          (scene) => scene.encounterId === receipt.execution.aggregateId
        )
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
        !sendSnapshot && receipt.beforeScene && receipt.execution.response
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
    const coordinator = this.#coordinator
    this.#coordinator = null
    for (const client of this.#clients.values()) client.socket.close(1001, 'Session closed.')
    this.#clients.clear()
    await this.#hydration?.catch(() => undefined)
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
      await runtime.add(client)
    } catch (error) {
      await runtime.close()
      throw error
    }
  }

  async dispose(): Promise<void> {
    await Promise.all([...this.#runtimes.values()].map((runtime) => runtime.close()))
    this.#runtimes.clear()
  }
}
