import {
  LIVE_SESSION_PATH_PREFIX,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionTicketDto,
  type LiveSessionTransientBroadcastDto,
  type LiveSessionWebSocketClientMessageDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { SceneTransientEnvelopeDto } from '@artificer-toolkit/schema/api/vttScenes'

export type LiveSessionConnectionStatus =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DISCONNECTED'

export type LiveSessionCommittedMessage = Extract<
  LiveSessionWebSocketServerMessageDto,
  { type: 'COMMAND_COMMITTED' }
>

export interface LiveSessionConnection {
  close: () => void
  executeCommand: (command: LiveSessionCommandDto) => Promise<LiveSessionCommittedMessage>
  sendCommand: (command: LiveSessionCommandDto) => boolean
  sendTransient: (envelope: SceneTransientEnvelopeDto) => boolean
}

interface LiveSessionConnectionOptions {
  createSocket?: (url: string, protocols: string[]) => LiveSessionSocket
  getTicket: () => Promise<LiveSessionTicketDto>
  onError: (error: Error) => void
  onMessage: (message: LiveSessionWebSocketServerMessageDto) => void
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

const reconnectDelay = (attempt: number) => Math.min(250 * 2 ** attempt, 5_000)
const webSocketOpenState = 1

function commandId(command: LiveSessionCommandDto): string {
  return command.command.commandId
}

export function resolveLiveSessionWebSocketUrl(baseUrl: string, sessionId: string): string {
  const url = new URL(baseUrl)
  if (url.protocol === 'http:') url.protocol = 'ws:'
  if (url.protocol === 'https:') url.protocol = 'wss:'
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('Live-session URL must use ws, wss, http, or https.')
  }
  url.pathname = `${url.pathname.replace(/\/$/, '')}${LIVE_SESSION_PATH_PREFIX}/${sessionId}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function createLiveSessionConnection(
  options: LiveSessionConnectionOptions
): LiveSessionConnection {
  const createSocket = options.createSocket ?? ((url, protocols) => new WebSocket(url, protocols))
  const pendingCommands = new Map<string, LiveSessionCommandDto>()
  const pendingExecutions = new Map<
    string,
    {
      reject: (error: Error) => void
      resolve: (message: LiveSessionCommittedMessage) => void
    }
  >()
  let attempt = 0
  let generation = 0
  let lastSeenDeliverySequence = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let socket: LiveSessionSocket | null = null
  let stopped = false

  const rejectPendingExecutions = (error: Error) => {
    for (const pendingExecution of pendingExecutions.values()) pendingExecution.reject(error)
    pendingCommands.clear()
    pendingExecutions.clear()
  }

  const send = (message: LiveSessionWebSocketClientMessageDto): boolean => {
    if (socket?.readyState !== webSocketOpenState) return false
    socket.send(JSON.stringify(message))
    return true
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
    const resumeFromSequence = lastSeenDeliverySequence
    try {
      const ticket = await options.getTicket()
      if (stopped || currentGeneration !== generation) return
      const nextSocket = createSocket(options.url, [
        LIVE_SESSION_WEBSOCKET_PROTOCOL,
        `${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket.ticket}`
      ])
      socket = nextSocket
      let resumeSent = false

      nextSocket.addEventListener('open', () => {
        if (nextSocket !== socket || stopped) return
        attempt = 0
        options.onStatus('CONNECTED')
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
          nextSocket.close(1008, 'Invalid live-session message.')
          return
        }
        const message = parsed.data
        if (message.type === 'TRANSIENT') {
          options.onTransient(message.message)
          return
        }
        if (message.type === 'COMMAND_COMMITTED') {
          pendingCommands.delete(message.originCommandId)
          const pendingExecution = pendingExecutions.get(message.originCommandId)
          if (pendingExecution) {
            pendingExecutions.delete(message.originCommandId)
            pendingExecution.resolve(message)
          }
          lastSeenDeliverySequence = Math.max(lastSeenDeliverySequence, message.deliverySequence)
        } else if (message.type === 'COMMAND_REJECTED') {
          if (message.commandId) {
            pendingCommands.delete(message.commandId)
            const pendingExecution = pendingExecutions.get(message.commandId)
            if (pendingExecution) {
              pendingExecutions.delete(message.commandId)
              pendingExecution.reject(new Error(message.message))
            }
          } else if (message.code === 'UNAUTHORIZED') {
            rejectPendingExecutions(new Error(message.message))
          }
        } else if (message.type === 'READY') {
          if (reconnecting && !resumeSent) {
            resumeSent = true
            send({
              lastSeenDeliverySequence: resumeFromSequence,
              pendingCommandIds: [...pendingCommands.keys()],
              type: 'RESUME'
            })
            for (const command of pendingCommands.values()) {
              send({ command, type: 'COMMAND' })
            }
          }
          lastSeenDeliverySequence = Math.max(lastSeenDeliverySequence, message.deliverySequence)
        }
        options.onMessage(message)
      })
      nextSocket.addEventListener('close', () => {
        if (nextSocket !== socket) return
        socket = null
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
      current?.close(1000, 'Live session closed.')
      rejectPendingExecutions(new Error('The live-session connection closed.'))
      options.onStatus('DISCONNECTED')
    },
    executeCommand(command) {
      const id = commandId(command)
      if (pendingCommands.has(id)) {
        return Promise.reject(new Error('This live-session command is already pending.'))
      }
      return new Promise<LiveSessionCommittedMessage>((resolve, reject) => {
        pendingCommands.set(id, command)
        pendingExecutions.set(id, { reject, resolve })
        if (send({ command, type: 'COMMAND' })) return
        pendingCommands.delete(id)
        pendingExecutions.delete(id)
        reject(new Error('Live play is reconnecting. Try that action again in a moment.'))
      })
    },
    sendCommand(command) {
      const id = commandId(command)
      if (pendingCommands.has(id) || !send({ command, type: 'COMMAND' })) return false
      pendingCommands.set(id, command)
      return true
    },
    sendTransient(envelope) {
      return send({ envelope, type: 'TRANSIENT' })
    }
  }
}
