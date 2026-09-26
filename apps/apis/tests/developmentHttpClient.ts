import { ConvexHttpClient, type HttpMutationOptions } from 'convex/browser'
import {
  getFunctionName,
  type ArgsAndOptions,
  type FunctionReference,
  type FunctionReturnType
} from 'convex/server'
import { ConvexError } from 'convex/values'
import type { DomainRejectionErrorData } from '@artificer-toolkit/schema/api/domainRejections'
import {
  encounterExecuteInputSchema,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionTicketDto } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import {
  LIVE_SESSION_PATH_PREFIX,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketClientMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { api } from '../convex/_generated/api.js'
import { executeEncounterCommand } from './developmentClient'

type RoomSocket = Pick<WebSocket, 'addEventListener' | 'close' | 'send'>
type RoomSocketInit = { headers: { origin: string }; protocols: string[] }
export type OpenRoomSocket = (url: string, init: RoomSocketInit) => RoomSocket
export type EncounterCommandRoom = {
  execute: (command: EncounterCommandInputDto) => Promise<EncounterCommandResultDto>
  close: () => void
}

const commandTimeoutMs = 120_000
// Closing an idle room lets a finished driver exit; the next command joins with a fresh ticket.
const idleCloseMs = 5_000
// The local web origin the Worker admits; the drivers authenticate with the same origin.
const liveSessionOrigin = 'http://localhost:3000'
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])

// Node's WebSocket (undici) accepts request headers in its init object. The DOM typing this project
// compiles against does not declare that overload, and the Worker admits only allowed Origins.
const openNodeSocket: OpenRoomSocket = (url, init) =>
  new (WebSocket as unknown as new (url: string, init: RoomSocketInit) => WebSocket)(url, init)

/**
 * One authenticated Session room connection that sends Encounter commands exactly as the browser
 * does: ticket subprotocol, AUTHENTICATE, then COMMAND after TRANSIENT_READY and STATE_SYNC.
 */
export function openEncounterCommandRoom(options: {
  url: string
  origin: string
  issueTicket: () => Promise<LiveSessionTicketDto>
  accessToken: () => string | null
  onClosed: () => void
  openSocket?: OpenRoomSocket
}): EncounterCommandRoom {
  const pending = new Map<
    string,
    {
      command: EncounterCommandInputDto
      sent: boolean
      resolve: (result: EncounterCommandResultDto) => void
      reject: (error: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  let socket: RoomSocket | null = null
  let admitted = false
  let sequence: number | null = null
  let failure: Error | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const send = (message: LiveSessionWebSocketClientMessageDto) =>
    socket?.send(JSON.stringify(message))

  const fail = (error: Error) => {
    if (failure) return
    failure = error
    if (idleTimer) clearTimeout(idleTimer)
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    pending.clear()
    socket?.close(1000, 'Development driver closed the Session room.')
    options.onClosed()
  }

  const close = () => fail(new Error('The Session room connection is closed.'))

  const take = (commandId: string) => {
    const entry = pending.get(commandId)
    if (!entry) return null
    pending.delete(commandId)
    clearTimeout(entry.timer)
    if (pending.size === 0 && !failure) idleTimer = setTimeout(close, idleCloseMs)
    return entry
  }

  const authenticate = () => {
    const accessToken = options.accessToken()
    if (!accessToken)
      return fail(new Error('Unauthenticated: the Session room needs a signed-in client.'))
    send({ accessToken, type: 'AUTHENTICATE' })
  }

  const flush = () => {
    if (!admitted || sequence === null) return
    for (const entry of pending.values()) {
      if (entry.sent) continue
      send({
        command: { command: entry.command, scope: 'ENCOUNTER' },
        expectedSessionSequence: sequence,
        type: 'COMMAND'
      })
      entry.sent = true
    }
  }

  const receive = (event: MessageEvent) => {
    let raw: unknown = null
    try {
      raw = typeof event.data === 'string' ? JSON.parse(event.data) : null
    } catch {
      raw = null
    }
    const parsed = liveSessionWebSocketServerMessageDtoSchema.safeParse(raw)
    if (!parsed.success) return fail(new Error('The Session room sent an invalid message.'))
    const message = parsed.data
    if (message.type === 'AUTHENTICATION_REQUIRED') {
      // A command in flight when admission changes is dropped by the room; resend it after the next
      // STATE_SYNC. Its command ID makes a repeat an exact replay.
      admitted = false
      for (const entry of pending.values()) entry.sent = false
      authenticate()
    } else if (message.type === 'TRANSIENT_READY') {
      admitted = true
    } else if (message.type === 'STATE_SYNC') {
      sequence = message.sequence
      flush()
    } else if (message.type === 'COMMAND_COMMITTED') {
      sequence = Math.max(sequence ?? message.sequence, message.sequence)
      const entry = take(message.commandId)
      if (message.delta?.scope === 'ENCOUNTER') entry?.resolve(message.delta.result)
      else
        entry?.reject(
          new Error('The Session room acknowledged the Encounter command without a result.')
        )
    } else if (message.type === 'COMMAND_REJECTED') {
      // A domain rejection surfaces as the same ConvexError data a direct Convex call throws.
      take(message.commandId)?.reject(
        message.reason
          ? new ConvexError({
              code: 'DOMAIN_REJECTED',
              reason: message.reason,
              message: message.message
            } satisfies DomainRejectionErrorData)
          : new Error(`${message.code}: ${message.message}`)
      )
    }
  }

  void (async () => {
    const ticket = await options.issueTicket()
    if (failure) return
    const opened = (options.openSocket ?? openNodeSocket)(options.url, {
      headers: { origin: options.origin },
      protocols: [
        LIVE_SESSION_WEBSOCKET_PROTOCOL,
        `${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket.ticket}`
      ]
    })
    socket = opened
    opened.addEventListener('open', authenticate)
    opened.addEventListener('message', receive)
    opened.addEventListener('close', (event) =>
      fail(new Error(`The Session room closed the connection (${event.code} ${event.reason}).`))
    )
  })().catch((error: unknown) =>
    fail(error instanceof Error ? error : new Error('Could not join the Session room.'))
  )

  return {
    close,
    execute(command) {
      if (failure) return Promise.reject(failure)
      if (pending.has(command.commandId))
        return Promise.reject(
          new Error('This Encounter command is already pending on this client.')
        )
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = null
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          take(command.commandId)
          reject(new Error(`The Session room did not answer ${command.type} in time.`))
        }, commandTimeoutMs)
        pending.set(command.commandId, { command, sent: false, resolve, reject, timer })
        flush()
      })
    }
  }
}

/**
 * The real-backend adapter for `DevelopmentClient`. Encounter command references are internal
 * in Convex, so this client sends them through the Campaign's Session room like the browser; every
 * other function goes to Convex over HTTP. The in-process convex-test adapter calls them directly.
 */
export class DevelopmentHttpClient extends ConvexHttpClient {
  #accessToken: string | null = null
  readonly #rooms = new Map<string, EncounterCommandRoom>()
  readonly #encounterCampaigns = new Map<string, string>()

  // No `auth` option: the base constructor would call setAuth before this class's fields exist.
  constructor(address: string, options?: { logger?: boolean }) {
    super(address, options)
  }

  override setAuth(value: string) {
    super.setAuth(value)
    this.#accessToken = value
  }

  override clearAuth() {
    super.clearAuth()
    this.#accessToken = null
  }

  override mutation<Mutation extends FunctionReference<'mutation'>>(
    mutation: Mutation,
    ...args: ArgsAndOptions<Mutation, HttpMutationOptions>
  ): Promise<FunctionReturnType<Mutation>> {
    if (getFunctionName(mutation) !== getFunctionName(executeEncounterCommand))
      return super.mutation(mutation, ...args)
    return this.#executeEncounterCommand(args[0]) as Promise<FunctionReturnType<Mutation>>
  }

  async #executeEncounterCommand(input: unknown): Promise<EncounterCommandResultDto> {
    const { command } = encounterExecuteInputSchema.parse(input)
    let campaignId = this.#encounterCampaigns.get(command.encounterId)
    if (!campaignId) {
      campaignId = (
        await this.query(api.encounters.projectionReads.get, { encounterId: command.encounterId })
      ).campaignId
      this.#encounterCampaigns.set(command.encounterId, campaignId)
    }
    return this.#room(campaignId).execute(command)
  }

  #room(campaignId: string): EncounterCommandRoom {
    const existing = this.#rooms.get(campaignId)
    if (existing) return existing
    const url = new URL(process.env.VITE_LIVE_SESSION_WEBSOCKET_URL ?? 'ws://127.0.0.1:8787')
    if (url.protocol === 'http:') url.protocol = 'ws:'
    if (url.protocol === 'https:') url.protocol = 'wss:'
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:')
      throw new Error('The Session room URL must use ws, wss, http or https.')
    if (loopbackHosts.has(new URL(this.url).hostname) && !loopbackHosts.has(url.hostname))
      throw new Error('A local Convex target requires a loopback Session room.')
    url.pathname = `${url.pathname.replace(/\/$/, '')}${LIVE_SESSION_PATH_PREFIX}/${campaignId}`
    const room = openEncounterCommandRoom({
      url: url.toString(),
      origin: liveSessionOrigin,
      issueTicket: () => super.action(api.liveSessions.tickets.issue, { campaignId }),
      accessToken: () => this.#accessToken,
      onClosed: () => {
        if (this.#rooms.get(campaignId) === room) this.#rooms.delete(campaignId)
      }
    })
    this.#rooms.set(campaignId, room)
    return room
  }
}
