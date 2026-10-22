import {
  LIVE_SESSION_PATH_PREFIX,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionCommandRejectionCodeDto,
  type LiveCampaignSummaryDto,
  type LiveSessionCorrectionDto,
  type LiveSessionRecipientDeltaDto,
  type LiveSessionRecipientStateDto,
  type LiveSessionTransientBroadcastDto,
  type LiveSessionWebSocketServerMessageDto,
  type LiveSessionWebSocketClientMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { EncounterReadDto } from '@artificer-toolkit/schema/api/encounterRead'
import type { RollHistoryEntryDto } from '@artificer-toolkit/schema/api/rolls'
import {
  domainRejectionErrorDataSchema,
  type DomainRejectionReasonDto
} from '@artificer-toolkit/schema/api/domainRejections'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { LiveSessionTicketDto } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import type {
  SceneCommandInputDto,
  SceneTransientEnvelopeDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneFogPatchInputSchema,
  type SceneFogSaveProgress
} from '@artificer-toolkit/schema/api/sceneFog'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { ConvexError } from 'convex/values'
import {
  applySceneDelta,
  sceneTransientStreamKey,
  VTT_SCENE_LIMITS
} from '@artificer-toolkit/shared/vtt'

export type LiveSessionConnectionStatus =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DISCONNECTED'

export interface LiveSessionConnection {
  close: () => void
  sendCommand: (command: LiveSessionCommandDto) => boolean
  submitCommand: (command: LiveSessionCommandDto) => Promise<LiveSessionCommandCommit>
  /** Stages a GM fog patch in batches, then publishes it as one journaled Scene command (D79). */
  submitSceneFog: (
    command: Extract<SceneCommandInputDto, { type: 'PATCH_SCENE_FOG' }>
  ) => Promise<LiveSessionCommandCommit>
  sendTransient: (envelope: SceneTransientEnvelopeDto) => boolean
  /** Follows one held Character Sheet (resent on every reconnect); null stops following. */
  subscribeCharacterSheet: (characterId: string | null) => void
  /** Follows the room's Encounter session (resent on every reconnect); null stops following. */
  subscribeEncounterSession: (subscription: { timeline: boolean } | null) => void
  /** Follows the live Campaign summary (resent on every reconnect); false stops following. */
  subscribeCampaignSummary: (subscribed: boolean) => void
  /**
   * Asks the room for a turn read at its current version. Rejects with
   * `LiveSessionReadRejectedError` when the room refuses it, and with a plain error when the
   * socket is not ready or drops first.
   */
  readEncounter: (read: EncounterReadDto) => Promise<LiveSessionEncounterReadReply>
}

export type LiveSessionCommandCommit = Extract<
  LiveSessionWebSocketServerMessageDto,
  { type: 'COMMAND_COMMITTED' }
>

export type LiveSessionCharacterSheetPush = Extract<
  LiveSessionWebSocketServerMessageDto,
  { type: 'CHARACTER_SHEET' }
>

type LiveSessionEncounterSessionPush = Extract<
  LiveSessionWebSocketServerMessageDto,
  { type: 'ENCOUNTER_SESSION' }
>['session']

/** The room's answer to a turn read, with the session version it was read at. */
export type LiveSessionEncounterReadReply = Pick<
  Extract<LiveSessionWebSocketServerMessageDto, { type: 'ENCOUNTER_READ_RESULT' }>,
  'result' | 'version'
>

/** The room refused a turn read; `UNAVAILABLE` means it cannot answer from its own state. */
export class LiveSessionReadRejectedError extends Error {
  constructor(
    message: string,
    readonly code: LiveSessionCommandRejectionCodeDto,
    readonly reason: DomainRejectionReasonDto | null
  ) {
    super(message)
    this.name = 'LiveSessionReadRejectedError'
  }
}

interface LiveSessionDurableState {
  commandReady: boolean
  recipientState: LiveSessionRecipientStateDto | null
  sequence: number | null
}

export interface LiveSessionCommandRejection {
  code: LiveSessionCommandRejectionCodeDto
  commandId: string
  correction?: LiveSessionCorrectionDto
  currentSequence: number
  message: string
  reason: DomainRejectionReasonDto | null
  warnings: EncounterRuleWarningDto[] | null
}

/** A refused live command; callers read the reason and any overridable rule warnings. */
export class LiveSessionCommandRejectedError extends Error {
  constructor(readonly rejection: LiveSessionCommandRejection) {
    super(rejection.message)
    this.name = 'LiveSessionCommandRejectedError'
  }
}

type LiveSessionClientMessage = Extract<
  LiveSessionWebSocketClientMessageDto,
  {
    type:
      | 'AUTHENTICATE'
      | 'COMMAND'
      | 'ENCOUNTER_READ'
      | 'RESUME'
      | 'SCENE_FOG_APPEND'
      | 'SCENE_FOG_BEGIN'
      | 'SUBSCRIBE_CAMPAIGN_SUMMARY'
      | 'SUBSCRIBE_CHARACTER_SHEET'
      | 'SUBSCRIBE_ENCOUNTER_SESSION'
      | 'TRANSIENT'
      | 'UNSUBSCRIBE_CAMPAIGN_SUMMARY'
      | 'UNSUBSCRIBE_CHARACTER_SHEET'
      | 'UNSUBSCRIBE_ENCOUNTER_SESSION'
  }
>
type SceneFogStagingMessage = Extract<
  LiveSessionClientMessage,
  { type: 'SCENE_FOG_APPEND' | 'SCENE_FOG_BEGIN' }
>

interface LiveSessionConnectionOptions {
  createSocket?: (url: string, protocols: string[]) => LiveSessionSocket
  getAccessToken: () => Promise<string>
  getTicket: () => Promise<LiveSessionTicketDto>
  onError: (error: Error) => void
  onCampaignChatEntry?: (entry: CampaignChatEntryDto) => void
  onPrivateRoll?: (roll: RollHistoryEntryDto) => void
  onCampaignSummary?: (summary: LiveCampaignSummaryDto) => void
  onCharacterSheet?: (push: LiveSessionCharacterSheetPush) => void
  onEncounterSession?: (session: LiveSessionEncounterSessionPush) => void
  onCommandRejected?: (rejection: LiveSessionCommandRejection) => void
  onDurableState?: (state: LiveSessionDurableState) => void
  onStatus: (status: LiveSessionConnectionStatus) => void
  onTransient: (message: LiveSessionTransientBroadcastDto) => void
  url: string
}

interface LiveSessionSocket {
  readonly readyState: number
  addEventListener: (type: string, listener: (event: Event) => void) => void
  close: (code?: number, reason?: string) => void
  send: (data: string) => void
}

/** Join refusals no retry can change: the Campaign is gone to this user or is archived. */
const terminalJoinReasons: ReadonlySet<DomainRejectionReasonDto> = new Set([
  'CAMPAIGN_NOT_ACTIVE',
  'CAMPAIGN_NOT_FOUND'
])

function isTerminalJoinRefusal(error: unknown): boolean {
  if (!(error instanceof ConvexError)) return false
  const rejected = domainRejectionErrorDataSchema.safeParse(error.data)
  return rejected.success && terminalJoinReasons.has(rejected.data.reason)
}

const reconnectDelay = (attempt: number) => Math.min(1_000 * 2 ** attempt, 30_000)
const webSocketOpenState = 1
/** Each preview stream sends at most 10 samples a second (ADR 0035 Amendment 15); pings, two. */
const previewIntervalMs = 100
/** Fog chunk characters per append, inside the room's 64 KiB frame; one chunk always fits. */
const fogBatchChars = 48_000
const fogBatchChunks = 8

function applyRecipientDelta(
  state: LiveSessionRecipientStateDto,
  delta: LiveSessionRecipientDeltaDto | null
): LiveSessionRecipientStateDto | null {
  // These receipts share the room sequence; their owning surface consumes their result.
  if (
    delta === null ||
    delta.scope === 'ENCOUNTER_BINDING' ||
    delta.scope === 'ENCOUNTER' ||
    delta.scope === 'CHARACTER_SHEET' ||
    delta.scope === 'CAMPAIGN_CHAT'
  )
    return state
  if (delta.scope === 'SCENE_VERSION') {
    if (state.scene?.id !== delta.sceneId || delta.version !== state.scene.version + 1) return null
    return { ...state, scene: { ...state.scene, version: delta.version } }
  }
  if (delta.result.delta === null) return state
  if (state.scene?.id !== delta.result.sceneId) return null
  return {
    ...state,
    scene: applySceneDelta(state.scene, delta.result.delta, delta.result.version)
  }
}

function applyCorrection(
  state: LiveSessionRecipientStateDto,
  correction: LiveSessionCorrectionDto
): LiveSessionRecipientStateDto {
  return { ...state, scene: correction.state }
}

export function resolveLiveSessionWebSocketUrl(baseUrl: string, campaignId: string): string {
  const url = new URL(baseUrl)
  if (url.protocol === 'http:') url.protocol = 'ws:'
  if (url.protocol === 'https:') url.protocol = 'wss:'
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('Live-session URL must use ws, wss, http, or https.')
  }
  url.pathname = `${url.pathname.replace(/\/$/, '')}${LIVE_SESSION_PATH_PREFIX}/${campaignId}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function createLiveSessionConnection(
  options: LiveSessionConnectionOptions
): LiveSessionConnection {
  const createSocket = options.createSocket ?? ((url, protocols) => new WebSocket(url, protocols))
  let attempt = 0
  let generation = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let socket: LiveSessionSocket | null = null
  let stopped = false
  let ready = false
  let commandReady = false
  let recipientState: LiveSessionRecipientStateDto | null = null
  let sequence: number | null = null
  const pendingCommands = new Map<
    string,
    {
      command: LiveSessionCommandDto
      expectedSessionSequence: number
      lastSentSequence: number | null
      reject: (error: Error) => void
      resolve: (commit: LiveSessionCommandCommit) => void
    }
  >()
  // One staging step per fog command awaits its progress or rejection.
  const pendingFogSteps = new Map<
    string,
    {
      reject: (error: Error) => void
      resolve: (progress: SceneFogSaveProgress) => void
    }
  >()
  const pendingReads = new Map<
    string,
    {
      reject: (error: Error) => void
      resolve: (reply: LiveSessionEncounterReadReply) => void
    }
  >()
  let requestedSheetCharacterId: string | null = null
  let requestedEncounterSession: { timeline: boolean } | null = null
  let requestedCampaignSummary = false
  const previewSentAt = new Map<string, number>()

  const send = (message: LiveSessionClientMessage): boolean => {
    if (socket?.readyState !== webSocketOpenState) return false
    socket.send(JSON.stringify(message))
    return true
  }

  const emitDurableState = () =>
    options.onDurableState?.({ commandReady, recipientState, sequence })

  const rejectFogSteps = (error: Error) => {
    for (const step of pendingFogSteps.values()) step.reject(error)
    pendingFogSteps.clear()
  }

  // A read dies with its socket: the room answers over the socket that asked.
  const rejectReads = (error: Error) => {
    for (const read of pendingReads.values()) read.reject(error)
    pendingReads.clear()
  }

  const stageFog = (message: SceneFogStagingMessage) =>
    new Promise<SceneFogSaveProgress>((resolve, reject) => {
      const commandId =
        message.type === 'SCENE_FOG_BEGIN' ? message.input.commandId : message.commandId
      if (!commandReady) {
        reject(new Error('Live play is not ready for commands.'))
        return
      }
      if (pendingFogSteps.has(commandId)) {
        reject(new Error('This fog change is already uploading.'))
        return
      }
      pendingFogSteps.set(commandId, { reject, resolve })
      if (!send(message)) {
        pendingFogSteps.delete(commandId)
        reject(new Error('Live play is not connected.'))
      }
    })

  const requestResume = () => {
    if (sequence !== null) send({ lastAppliedSequence: sequence, type: 'RESUME' })
  }

  const requestSheet = () => {
    if (ready && requestedSheetCharacterId !== null)
      send({ characterId: requestedSheetCharacterId, type: 'SUBSCRIBE_CHARACTER_SHEET' })
  }

  const requestEncounterSession = () => {
    if (ready && requestedEncounterSession !== null)
      send({
        ...requestedEncounterSession,
        type: 'SUBSCRIBE_ENCOUNTER_SESSION'
      })
  }

  const requestCampaignSummary = () => {
    if (ready && requestedCampaignSummary) send({ type: 'SUBSCRIBE_CAMPAIGN_SUMMARY' })
  }

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return
    const delay = reconnectDelay(attempt)
    attempt += 1
    options.onStatus('RECONNECTING')
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void connect(true)
    }, delay)
  }

  const connect = async (reconnecting: boolean) => {
    const currentGeneration = ++generation
    options.onStatus(reconnecting ? 'RECONNECTING' : 'CONNECTING')
    try {
      const ticket = await options.getTicket()
      if (stopped || currentGeneration !== generation) return
      const nextSocket = createSocket(options.url, [
        LIVE_SESSION_WEBSOCKET_PROTOCOL,
        `${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket.ticket}`
      ])
      socket = nextSocket
      ready = false
      commandReady = false
      emitDurableState()
      let authentication: Promise<void> | null = null

      const sendAuthentication = () => {
        if (authentication) return
        const currentAuthentication = (async () => {
          const token = await options.getAccessToken()
          if (
            stopped ||
            currentGeneration !== generation ||
            nextSocket !== socket ||
            nextSocket.readyState !== webSocketOpenState
          ) {
            return
          }
          if (!token.trim()) throw new Error('Unable to authenticate live play.')
          send({ accessToken: token, type: 'AUTHENTICATE' })
        })()
        authentication = currentAuthentication
        void currentAuthentication
          .catch(() => {
            if (stopped || currentGeneration !== generation || nextSocket !== socket) return
            options.onError(new Error('Unable to authenticate live play.'))
            nextSocket.close(4001, 'Live-session authentication failed.')
          })
          .finally(() => {
            if (authentication === currentAuthentication) authentication = null
          })
      }

      nextSocket.addEventListener('open', () => {
        if (nextSocket !== socket || stopped) return
        sendAuthentication()
      })
      nextSocket.addEventListener('message', (event) => {
        if (
          nextSocket !== socket ||
          !(event instanceof MessageEvent) ||
          typeof event.data !== 'string'
        ) {
          return
        }
        const parsed = liveSessionWebSocketServerMessageDtoSchema.safeParse(
          ((): unknown => {
            try {
              return JSON.parse(event.data)
            } catch {
              return null
            }
          })()
        )
        if (!parsed.success) {
          options.onError(new Error('The live-session host returned an invalid message.'))
          nextSocket.close(4002, 'Invalid live-session message.')
          return
        }
        const message = parsed.data
        if (message.type === 'TRANSIENT_READY') {
          attempt = 0
          ready = true
          requestSheet()
          requestEncounterSession()
          requestCampaignSummary()
          requestResume()
          options.onStatus('CONNECTED')
        } else if (message.type === 'AUTHENTICATION_REQUIRED') {
          ready = false
          commandReady = false
          emitDurableState()
          rejectReads(new Error('Live play must authenticate again.'))
          for (const pending of pendingCommands.values()) pending.lastSentSequence = null
          options.onStatus('RECONNECTING')
          sendAuthentication()
        } else if (message.type === 'TRANSIENT') {
          options.onTransient(message.message)
        } else if (message.type === 'SCENE_FOG_PROGRESS') {
          pendingFogSteps.get(message.progress.commandId)?.resolve(message.progress)
          pendingFogSteps.delete(message.progress.commandId)
        } else if (message.type === 'CHARACTER_SHEET') {
          if (message.characterId.toLowerCase() === requestedSheetCharacterId?.toLowerCase())
            options.onCharacterSheet?.(message)
        } else if (message.type === 'CAMPAIGN_SUMMARY') {
          if (requestedCampaignSummary) options.onCampaignSummary?.(message.summary)
        } else if (message.type === 'ENCOUNTER_SESSION') {
          if (requestedEncounterSession) options.onEncounterSession?.(message.session)
        } else if (message.type === 'ENCOUNTER_READ_RESULT') {
          pendingReads
            .get(message.requestId)
            ?.resolve({ result: message.result, version: message.version })
          pendingReads.delete(message.requestId)
        } else if (message.type === 'ENCOUNTER_READ_REJECTED') {
          pendingReads
            .get(message.requestId)
            ?.reject(
              new LiveSessionReadRejectedError(message.message, message.code, message.reason)
            )
          pendingReads.delete(message.requestId)
        } else if (message.type === 'STATE_SYNC') {
          sequence = message.sequence
          recipientState = message.state
          commandReady = true
          emitDurableState()
          for (const pending of pendingCommands.values()) {
            if (pending.lastSentSequence === message.sequence) continue
            if (
              send({
                command: pending.command,
                expectedSessionSequence: pending.expectedSessionSequence,
                type: 'COMMAND'
              })
            )
              pending.lastSentSequence = message.sequence
          }
        } else if (message.type === 'COMMAND_COMMITTED') {
          // Geometry notifications and private-history-free fanout advance the shared sequence,
          // but the command's own result must arrive before its submitting surface settles.
          const settle = () => {
            if (message.delta?.scope === 'CAMPAIGN_CHAT') {
              if (message.delta.entry) options.onCampaignChatEntry?.(message.delta.entry)
              if (message.delta.privateRoll) options.onPrivateRoll?.(message.delta.privateRoll)
            }
            const pending = pendingCommands.get(message.commandId)
            if (
              (pending?.command.scope === 'ENCOUNTER' ||
                pending?.command.scope === 'CHARACTER_SHEET' ||
                pending?.command.scope === 'CAMPAIGN_CHAT') &&
              message.delta?.scope !== pending.command.scope
            )
              return
            pending?.resolve(message)
            pendingCommands.delete(message.commandId)
          }
          if (sequence === null || recipientState === null) {
            commandReady = false
            emitDurableState()
            requestResume()
            return
          }
          if (message.sequence <= sequence) {
            settle()
            return
          }
          if (message.sequence !== sequence + 1) {
            commandReady = false
            emitDurableState()
            options.onError(new Error('Live play received commands out of order.'))
            requestResume()
            return
          }
          const nextState = applyRecipientDelta(recipientState, message.delta)
          if (nextState === null) {
            commandReady = false
            emitDurableState()
            options.onError(new Error('Live play could not apply the next command.'))
            requestResume()
            return
          }
          recipientState = nextState
          sequence = message.sequence
          settle()
          emitDurableState()
        } else if (message.type === 'COMMAND_REJECTED') {
          if (recipientState && message.correction) {
            const correctedState = applyCorrection(recipientState, message.correction)
            if (correctedState) {
              recipientState = correctedState
              emitDurableState()
            } else {
              commandReady = false
              emitDurableState()
              options.onError(new Error('Live play received a correction for another recipient.'))
              requestResume()
            }
          }
          pendingCommands
            .get(message.commandId)
            ?.reject(new LiveSessionCommandRejectedError(message))
          pendingCommands.delete(message.commandId)
          pendingFogSteps
            .get(message.commandId)
            ?.reject(new LiveSessionCommandRejectedError(message))
          pendingFogSteps.delete(message.commandId)
          options.onCommandRejected?.(message)
        }
      })
      nextSocket.addEventListener('close', () => {
        if (nextSocket !== socket) return

        socket = null
        ready = false
        commandReady = false
        emitDurableState()
        for (const pending of pendingCommands.values()) pending.lastSentSequence = null
        // Staged batches survive in the room; a retried upload resumes from its begin.
        rejectFogSteps(new Error('Live play disconnected during a fog change.'))
        rejectReads(new Error('Live play disconnected during a read.'))
        if (stopped) {
          options.onStatus('DISCONNECTED')
          return
        }
        scheduleReconnect()
      })
      nextSocket.addEventListener('error', () => {
        if (nextSocket === socket) options.onError(new Error('The live-session connection failed.'))
      })
    } catch (error) {
      if (stopped || currentGeneration !== generation) return
      options.onError(
        error instanceof Error ? error : new Error('Unable to join the live session.')
      )
      if (isTerminalJoinRefusal(error)) {
        options.onStatus('DISCONNECTED')
        return
      }
      scheduleReconnect()
    }
  }

  void connect(false)

  const submitCommand = (command: LiveSessionCommandDto) => {
    const commandId = command.command.commandId
    if (pendingCommands.has(commandId)) {
      return Promise.reject(new Error('This live command is already pending.'))
    }
    return new Promise<LiveSessionCommandCommit>((resolve, reject) => {
      if (!commandReady || sequence === null) {
        reject(new Error('Live play is not ready for commands.'))
        return
      }
      const pending = {
        command,
        expectedSessionSequence: sequence,
        lastSentSequence: null as number | null,
        reject,
        resolve
      }
      pendingCommands.set(commandId, pending)
      if (send({ command, expectedSessionSequence: sequence, type: 'COMMAND' })) {
        pending.lastSentSequence = sequence
      } else {
        pendingCommands.delete(commandId)
        reject(new Error('Live play is not connected.'))
      }
    })
  }

  return {
    close() {
      stopped = true
      generation += 1
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = null
      const current = socket
      socket = null
      commandReady = false
      emitDurableState()

      current?.close(1000, 'Live session closed.')
      for (const pending of pendingCommands.values()) {
        pending.reject(new Error('Live session closed.'))
      }
      pendingCommands.clear()
      rejectFogSteps(new Error('Live session closed.'))
      rejectReads(new Error('Live session closed.'))
      options.onStatus('DISCONNECTED')
    },
    sendCommand(command) {
      if (!commandReady || sequence === null) return false
      return send({ command, expectedSessionSequence: sequence, type: 'COMMAND' })
    },
    submitCommand,
    async submitSceneFog(command) {
      const input = sceneFogPatchInputSchema.parse({
        type: command.type,
        sceneId: command.sceneId,
        commandId: command.commandId,
        expectedSceneVersion: command.expectedSceneVersion,
        layer: {
          ownerUserId: command.layer.ownerUserId,
          width: command.layer.width,
          height: command.layer.height
        },
        chunkManifest: command.layer.chunks.map((chunk) => ({
          index: chunk.index,
          checksum: checksumCanonicalJson(chunk)
        }))
      })
      const { chunks } = command.layer
      let progress = await stageFog({ input, type: 'SCENE_FOG_BEGIN' })
      while (progress.status === 'RECEIVING' && progress.receivedChunks < chunks.length) {
        const offset = progress.receivedChunks
        let end = offset + 1
        let chars = chunks[offset]!.data.length
        while (
          end < chunks.length &&
          end - offset < fogBatchChunks &&
          chars + chunks[end]!.data.length <= fogBatchChars
        ) {
          chars += chunks[end]!.data.length
          end += 1
        }
        progress = await stageFog({
          commandId: input.commandId,
          input: { chunks: chunks.slice(offset, end), offset, saveId: progress.saveId },
          type: 'SCENE_FOG_APPEND'
        })
      }
      if (progress.status === 'EXPIRED') throw new Error('Scene fog save expired.')
      return submitCommand({
        command: {
          commandId: input.commandId,
          expectedSceneVersion: input.expectedSceneVersion,
          saveId: progress.saveId,
          sceneId: input.sceneId,
          type: 'PUBLISH_SCENE_FOG_PATCH'
        },
        scope: 'SCENE'
      })
    },
    sendTransient(envelope) {
      const key = sceneTransientStreamKey(envelope)
      const now = performance.now()
      if (
        !ready ||
        now - (previewSentAt.get(key) ?? Number.NEGATIVE_INFINITY) <
          (envelope.kind === 'PING' ? VTT_SCENE_LIMITS.pingIntervalMs : previewIntervalMs) ||
        !send({ envelope, type: 'TRANSIENT' })
      )
        return false
      previewSentAt.set(key, now)
      return true
    },
    subscribeCharacterSheet(characterId) {
      if (characterId === requestedSheetCharacterId) return
      requestedSheetCharacterId = characterId
      if (characterId === null) send({ type: 'UNSUBSCRIBE_CHARACTER_SHEET' })
      else requestSheet()
    },
    subscribeEncounterSession(subscription) {
      if (subscription?.timeline === requestedEncounterSession?.timeline) return
      requestedEncounterSession = subscription
      if (subscription === null) send({ type: 'UNSUBSCRIBE_ENCOUNTER_SESSION' })
      else requestEncounterSession()
    },
    subscribeCampaignSummary(subscribed) {
      if (subscribed === requestedCampaignSummary) return
      requestedCampaignSummary = subscribed
      if (subscribed) requestCampaignSummary()
      else send({ type: 'UNSUBSCRIBE_CAMPAIGN_SUMMARY' })
    },
    readEncounter(read) {
      return new Promise<LiveSessionEncounterReadReply>((resolve, reject) => {
        const requestId = crypto.randomUUID()
        pendingReads.set(requestId, { reject, resolve })
        if (!ready || !send({ read, requestId, type: 'ENCOUNTER_READ' })) {
          pendingReads.delete(requestId)
          reject(new Error('Live play is not connected.'))
        }
      })
    }
  }
}
