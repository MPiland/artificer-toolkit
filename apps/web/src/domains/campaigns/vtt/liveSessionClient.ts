import {
  LIVE_SESSION_PATH_PREFIX,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionCommandRejectionCodeDto,
  type LiveSessionCorrectionDto,
  type LiveSessionRecipientDeltaDto,
  type LiveSessionRecipientStateDto,
  type LiveSessionTransientBroadcastDto,
  type LiveSessionWebSocketServerMessageDto,
  type LiveSessionWebSocketClientMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { DomainRejectionReasonDto } from '@artificer-toolkit/schema/api/domainRejections'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { LiveSessionTicketDto } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import type { SceneTransientEnvelopeDto } from '@artificer-toolkit/schema/api/vttScenes'
import { applySceneDelta, VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt'

export type LiveSessionConnectionStatus =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DISCONNECTED'

export interface LiveSessionConnection {
  close: () => void
  sendCommand: (command: LiveSessionCommandDto) => boolean
  submitCommand: (command: LiveSessionCommandDto) => Promise<LiveSessionCommandCommit>
  sendTransient: (envelope: SceneTransientEnvelopeDto) => boolean
  synchronizeScene: (sceneId: string, version: number, expectedPresentationVersion: number) => void
}

export type LiveSessionCommandCommit = Extract<
  LiveSessionWebSocketServerMessageDto,
  { type: 'COMMAND_COMMITTED' }
>

export interface LiveSessionDurableState {
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
  { type: 'AUTHENTICATE' | 'COMMAND' | 'RESUME' | 'SYNCHRONIZE_SCENE' | 'TRANSIENT' }
>
type SceneSynchronizationMessage = Extract<LiveSessionClientMessage, { type: 'SYNCHRONIZE_SCENE' }>

interface LiveSessionConnectionOptions {
  createSocket?: (url: string, protocols: string[]) => LiveSessionSocket
  getAccessToken: () => Promise<string>
  getTicket: () => Promise<LiveSessionTicketDto>
  onError: (error: Error) => void
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

const reconnectDelay = (attempt: number) => Math.min(1_000 * 2 ** attempt, 30_000)
const webSocketOpenState = 1
/** Each preview stream sends at most 10 samples a second (ADR 0035 Amendment 15); pings, two. */
const previewIntervalMs = 100

/** A preview stream as the room keys it: per kind, per dragged token and per fog owner. */
function previewStreamKey(envelope: SceneTransientEnvelopeDto): string {
  if (envelope.kind === 'TOKEN_DRAG_PREVIEW') return `${envelope.kind}:${envelope.tokenId}`
  if (envelope.kind === 'FOG_AREA_PREVIEW')
    return `${envelope.kind}:${envelope.ownerUserId ?? 'SHARED_PARTY'}`
  return envelope.kind
}

function applyRecipientDelta(
  state: LiveSessionRecipientStateDto,
  delta: Exclude<LiveSessionRecipientDeltaDto, { scope: 'ENCOUNTER' }> | null
): LiveSessionRecipientStateDto | null {
  // A binding changes no Scene state; members read it through their Convex subscription.
  if (delta === null || delta.scope === 'ENCOUNTER_BINDING') return state
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
  let requestedScene: SceneSynchronizationMessage | null = null
  let synchronizedScene: SceneSynchronizationMessage | null = null
  const previewSentAt = new Map<string, number>()

  const send = (message: LiveSessionClientMessage): boolean => {
    if (socket?.readyState !== webSocketOpenState) return false
    socket.send(JSON.stringify(message))
    return true
  }

  const emitDurableState = () =>
    options.onDurableState?.({ commandReady, recipientState, sequence })

  const requestResume = () => {
    if (sequence !== null) send({ lastAppliedSequence: sequence, type: 'RESUME' })
  }

  const synchronizeRequestedScene = () => {
    if (
      !ready ||
      !requestedScene ||
      (requestedScene.sceneId === synchronizedScene?.sceneId &&
        requestedScene.version === synchronizedScene.version &&
        requestedScene.expectedPresentationVersion ===
          synchronizedScene.expectedPresentationVersion)
    ) {
      return
    }
    if (send(requestedScene)) synchronizedScene = requestedScene
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
      synchronizedScene = null
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
          (() => {
            try {
              return JSON.parse(event.data) as unknown
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
          synchronizeRequestedScene()
          requestResume()
          options.onStatus('CONNECTED')
        } else if (message.type === 'AUTHENTICATION_REQUIRED') {
          ready = false
          commandReady = false
          emitDurableState()
          synchronizedScene = null
          for (const pending of pendingCommands.values()) pending.lastSentSequence = null
          options.onStatus('RECONNECTING')
          sendAuthentication()
        } else if (message.type === 'TRANSIENT') {
          options.onTransient(message.message)
        } else if (message.type === 'STATE_SYNC') {
          sequence = message.sequence
          recipientState = message.state
          commandReady =
            !requestedScene ||
            (message.state.scene?.id === requestedScene.sceneId &&
              message.state.scene.version >= requestedScene.version)
          emitDurableState()
          if (commandReady) {
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
          }
        } else if (message.type === 'COMMAND_COMMITTED') {
          // A movement decision's Scene change reaches its initiator before its Encounter result,
          // so an Encounter command settles only with the Encounter acknowledgement.
          const settle = () => {
            const pending = pendingCommands.get(message.commandId)
            if (pending?.command.scope === 'ENCOUNTER' && message.delta?.scope !== 'ENCOUNTER')
              return
            pending?.resolve(message)
            pendingCommands.delete(message.commandId)
          }
          // Encounter commits persist in Convex and converge through subscriptions; they do not
          // advance the room sequence, so they acknowledge the initiator without touching state.
          if (message.delta?.scope === 'ENCOUNTER') {
            settle()
            return
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
          options.onCommandRejected?.(message)
        }
      })
      nextSocket.addEventListener('close', () => {
        if (nextSocket !== socket) return

        socket = null
        ready = false
        commandReady = false
        emitDurableState()
        synchronizedScene = null
        for (const pending of pendingCommands.values()) pending.lastSentSequence = null
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
      scheduleReconnect()
    }
  }

  void connect(false)

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
      options.onStatus('DISCONNECTED')
    },
    sendCommand(command) {
      if (!commandReady || sequence === null) return false
      return send({ command, expectedSessionSequence: sequence, type: 'COMMAND' })
    },
    submitCommand(command) {
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
    },
    sendTransient(envelope) {
      const key = previewStreamKey(envelope)
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
    synchronizeScene(sceneId, version, expectedPresentationVersion) {
      requestedScene = {
        expectedPresentationVersion,
        sceneId,
        type: 'SYNCHRONIZE_SCENE',
        version
      }
      synchronizeRequestedScene()
    }
  }
}
