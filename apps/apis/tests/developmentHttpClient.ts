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
  type LiveSessionWebSocketClientMessageDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  sceneFogPatchInputSchema,
  type SceneFogPatchInput,
  type SceneFogPublishCommandInput,
  type SceneFogSaveProgress
} from '@artificer-toolkit/schema/api/sceneFog'
import {
  encounterActorTokenBindingCommandInputDtoSchema,
  type EncounterActorTokenBindingCommandInputDto,
  type SceneCommandInputDto,
  type SceneCommandResultDto,
  type SceneTransientEnvelopeDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { api } from '../convex/_generated/api.js'
import { executeEncounterCommand } from './developmentClient'
import { bindToken } from './developmentEncounterLifecycle'

type RoomCommand = EncounterCommandInputDto | EncounterActorTokenBindingCommandInputDto
type RoomSocket = Pick<WebSocket, 'addEventListener' | 'close' | 'send'>
type RoomSocketInit = { headers: { origin: string }; protocols: string[] }
type SceneFogStagingMessage = Extract<
  LiveSessionWebSocketClientMessageDto,
  { type: 'SCENE_FOG_APPEND' | 'SCENE_FOG_BEGIN' }
>
type SceneFogPatchCommand = Extract<SceneCommandInputDto, { type: 'PATCH_SCENE_FOG' }>
export type OpenRoomSocket = (url: string, init: RoomSocketInit) => RoomSocket
/** The presented Scene a Scene command needs the room to hold, as the tabletop synchronizes it. */
export type RoomScenePresentation = { expectedPresentationVersion: number }
/** The Scene the room must hold, synchronized, before it accepts a command that reads it. */
type RoomSceneSynchronization = RoomScenePresentation & {
  sceneId: string
  expectedSceneVersion: number
}
/**
 * A committed Scene command and the session sequence it carried, which an exact retry repeats. The
 * result is null when this member cannot see the change and the room sends only the version bump.
 */
export type RoomSceneCommit = {
  result: SceneCommandResultDto | null
  version: number
  expectedSessionSequence: number
}
export type CommandRoom = {
  executeEncounter: (
    command: RoomCommand,
    synchronization?: RoomSceneSynchronization
  ) => Promise<EncounterCommandResultDto>
  executeScene: (
    command: SceneCommandInputDto | SceneFogPublishCommandInput,
    presentation: RoomScenePresentation,
    replayOfSequence?: number
  ) => Promise<RoomSceneCommit>
  /** Stages a fog patch over the socket and publishes it, as the browser does (D79). */
  executeSceneFog: (
    command: SceneFogPatchCommand,
    presentation: RoomScenePresentation
  ) => Promise<RoomSceneCommit>
  /** Resolves once the room has admitted this member and sent its first STATE_SYNC. */
  whenReady: () => Promise<void>
  /** The Scene as the room last reported it to this socket, or null before it is synchronized. */
  scene: () => { id: string; version: number } | null
  /** Holds the Encounter session subscription, re-sent after the room asks to authenticate again. */
  subscribeEncounterSession: (timeline: boolean) => void
  /** Sends one transient (a token drag preview), as the tabletop does during a drag. */
  sendTransient: (envelope: SceneTransientEnvelopeDto) => void
  close: () => void
}

/** A frame the room sent one member, stamped on arrival (`performance.now()`) before it is parsed. */
export type RoomFrame = {
  campaignId: string
  message: LiveSessionWebSocketServerMessageDto
  receivedAt: number
}

/** A room refusal that is not a domain rejection, with the room's code (for example STALE_STATE). */
export class RoomCommandRejectedError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(`${code}: ${message}`)
  }
}

type PendingCommand = {
  sent: boolean
  timer: ReturnType<typeof setTimeout>
  reject: (error: Error) => void
} & (
  | {
      scope: 'ENCOUNTER'
      command: RoomCommand
      synchronization: RoomSceneSynchronization | null
      resolve: (result: EncounterCommandResultDto) => void
    }
  | {
      scope: 'SCENE'
      command: SceneCommandInputDto | SceneFogPublishCommandInput
      presentation: RoomScenePresentation
      // An exact retry repeats the original session sequence, which the room's receipt covers.
      replayOfSequence: number | null
      sentSequence: number | null
      resolve: (commit: RoomSceneCommit) => void
    }
  | {
      // A fog staging step answers with SCENE_FOG_PROGRESS and needs the room's Scene synchronized.
      scope: 'FOG'
      command: Pick<SceneFogPatchInput, 'sceneId' | 'commandId' | 'expectedSceneVersion'> & {
        type: SceneFogStagingMessage['type']
      }
      message: SceneFogStagingMessage
      presentation: RoomScenePresentation
      resolve: (progress: SceneFogSaveProgress) => void
    }
)

const commandTimeoutMs = 120_000
// Closing an idle room lets a finished driver exit; the next command joins with a fresh ticket.
const idleCloseMs = 5_000
// The local web origin the Worker admits; the drivers authenticate with the same origin.
const liveSessionOrigin = 'http://localhost:3000'
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])

/**
 * The Session Worker's base URL (http or https), for the room sockets and the development-only
 * meter and barrier routes. A local Convex target requires a loopback Worker.
 */
function liveSessionWorkerUrl(convexUrl: string): URL {
  const url = new URL(process.env.VITE_LIVE_SESSION_WEBSOCKET_URL ?? 'ws://127.0.0.1:8787')
  if (url.protocol === 'ws:') url.protocol = 'http:'
  if (url.protocol === 'wss:') url.protocol = 'https:'
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('The Session room URL must use ws, wss, http or https.')
  if (loopbackHosts.has(new URL(convexUrl).hostname) && !loopbackHosts.has(url.hostname))
    throw new Error('A local Convex target requires a loopback Session room.')
  return url
}

// Node's WebSocket (undici) accepts request headers in its init object. The DOM typing this project
// compiles against does not declare that overload, and the Worker admits only allowed Origins.
const openNodeSocket: OpenRoomSocket = (url, init) =>
  new (WebSocket as unknown as new (url: string, init: RoomSocketInit) => WebSocket)(url, init)

/**
 * One authenticated Session room connection that sends commands exactly as the browser does:
 * ticket subprotocol, AUTHENTICATE, then COMMAND after TRANSIENT_READY and STATE_SYNC. A Scene
 * command first synchronizes the room's presented Scene (SYNCHRONIZE_SCENE) at the command's
 * expected Scene version. With `holdOpen`, an idle room stays connected until `close`.
 */
export function openCommandRoom(options: {
  url: string
  origin: string
  issueTicket: () => Promise<LiveSessionTicketDto>
  accessToken: () => string | null
  onClosed: () => void
  holdOpen?: boolean
  openSocket?: OpenRoomSocket
  onMessage?: (message: LiveSessionWebSocketServerMessageDto, receivedAt: number) => void
  /** Each time the room asks this socket to authenticate again, and the failure that ends it. */
  onEvent?: (event: string) => void
}): CommandRoom {
  const pending = new Map<string, PendingCommand>()
  let socket: RoomSocket | null = null
  let admitted = false
  // Admitted and synchronized: set by STATE_SYNC, cleared when the room asks to authenticate again.
  let synchronized = false
  const readyWaiters: { resolve: () => void; reject: (error: Error) => void }[] = []
  let encounterTimeline: boolean | null = null
  let encounterSubscribed = false
  let sequence: number | null = null
  // The room's synchronized Scene as its last STATE_SYNC and committed Scene changes report it.
  let roomScene: { id: string; version: number } | null = null
  let requestedSynchronization: string | null = null
  let failure: Error | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const send = (message: LiveSessionWebSocketClientMessageDto) =>
    socket?.send(JSON.stringify(message))

  const fail = (error: Error) => {
    if (failure) return
    failure = error
    options.onEvent?.(`ended: ${error.message}`)
    if (idleTimer) clearTimeout(idleTimer)
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    pending.clear()
    for (const waiter of readyWaiters.splice(0)) waiter.reject(error)
    socket?.close(1000, 'Development driver closed the Session room.')
    options.onClosed()
  }

  const close = () => fail(new Error('The Session room connection is closed.'))

  const take = (commandId: string) => {
    const entry = pending.get(commandId)
    if (!entry) return null
    pending.delete(commandId)
    clearTimeout(entry.timer)
    if (pending.size === 0 && !failure && !options.holdOpen)
      idleTimer = setTimeout(close, idleCloseMs)
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
      const required =
        entry.scope === 'ENCOUNTER'
          ? entry.synchronization
          : {
              sceneId: entry.command.sceneId,
              expectedSceneVersion: entry.command.expectedSceneVersion,
              expectedPresentationVersion: entry.presentation.expectedPresentationVersion
            }
      if (
        required &&
        (roomScene?.id !== required.sceneId || roomScene.version < required.expectedSceneVersion)
      ) {
        const synchronization = `${required.sceneId}:${required.expectedSceneVersion}:${required.expectedPresentationVersion}`
        if (requestedSynchronization !== synchronization) {
          requestedSynchronization = synchronization
          send({
            type: 'SYNCHRONIZE_SCENE',
            sceneId: required.sceneId,
            version: required.expectedSceneVersion,
            expectedPresentationVersion: required.expectedPresentationVersion
          })
        }
        continue
      }
      if (entry.scope === 'ENCOUNTER') {
        send({
          command: { command: entry.command, scope: 'ENCOUNTER' },
          expectedSessionSequence: sequence,
          type: 'COMMAND'
        })
        entry.sent = true
        continue
      }
      if (entry.scope === 'FOG') {
        send(entry.message)
        entry.sent = true
        continue
      }
      entry.sentSequence = entry.replayOfSequence ?? sequence
      send({
        command: { command: entry.command, scope: 'SCENE' },
        expectedSessionSequence: entry.sentSequence,
        type: 'COMMAND'
      })
      entry.sent = true
    }
  }

  const applyEncounterSubscription = () => {
    if (encounterTimeline === null || encounterSubscribed) return
    send({ timeline: encounterTimeline, type: 'SUBSCRIBE_ENCOUNTER_SESSION' })
    encounterSubscribed = true
  }

  const receive = (event: MessageEvent) => {
    const receivedAt = performance.now()
    let raw: unknown = null
    try {
      raw = typeof event.data === 'string' ? JSON.parse(event.data) : null
    } catch {
      raw = null
    }
    const parsed = liveSessionWebSocketServerMessageDtoSchema.safeParse(raw)
    if (!parsed.success) return fail(new Error('The Session room sent an invalid message.'))
    const message = parsed.data
    options.onMessage?.(message, receivedAt)
    if (message.type === 'AUTHENTICATION_REQUIRED') {
      options.onEvent?.('challenged')
      // A command in flight when admission changes is dropped by the room; resend it after the next
      // STATE_SYNC. Its command ID makes a repeat an exact replay.
      admitted = false
      synchronized = false
      encounterSubscribed = false
      requestedSynchronization = null
      for (const entry of pending.values()) entry.sent = false
      authenticate()
    } else if (message.type === 'TRANSIENT_READY') {
      admitted = true
    } else if (message.type === 'STATE_SYNC') {
      sequence = message.sequence
      roomScene = message.state.scene
        ? { id: message.state.scene.id, version: message.state.scene.version }
        : null
      synchronized = true
      for (const waiter of readyWaiters.splice(0)) waiter.resolve()
      applyEncounterSubscription()
      flush()
    } else if (message.type === 'COMMAND_COMMITTED') {
      const delta = message.delta
      // Encounter commits persist in Convex and never advance the room sequence.
      if (delta?.scope !== 'ENCOUNTER') sequence = Math.max(sequence ?? 0, message.sequence)
      if (delta?.scope === 'SCENE' && roomScene?.id === delta.result.sceneId)
        roomScene = { id: roomScene.id, version: Math.max(roomScene.version, delta.result.version) }
      if (delta?.scope === 'SCENE_VERSION' && roomScene?.id === delta.sceneId)
        roomScene = { id: roomScene.id, version: Math.max(roomScene.version, delta.version) }
      const entry = pending.get(message.commandId)
      // A movement decision's Scene change reaches its initiator before its Encounter result.
      if (entry?.scope === 'ENCOUNTER' && delta?.scope === 'ENCOUNTER') {
        take(message.commandId)
        entry.resolve(delta.result)
      } else if (entry?.scope === 'SCENE') {
        take(message.commandId)
        if (delta?.scope === 'SCENE' && entry.sentSequence !== null)
          entry.resolve({
            result: delta.result,
            version: delta.result.version,
            expectedSessionSequence: entry.sentSequence
          })
        else if (delta?.scope === 'SCENE_VERSION' && entry.sentSequence !== null)
          entry.resolve({
            result: null,
            version: delta.version,
            expectedSessionSequence: entry.sentSequence
          })
        else
          entry.reject(
            new Error('The Session room acknowledged the Scene command without a result.')
          )
      } else if (entry && delta === null)
        take(message.commandId)?.reject(
          new Error('The Session room acknowledged the Encounter command without a result.')
        )
      flush()
    } else if (message.type === 'SCENE_FOG_PROGRESS') {
      const entry = pending.get(message.progress.commandId)
      if (entry?.scope === 'FOG') {
        take(message.progress.commandId)
        entry.resolve(message.progress)
      }
    } else if (message.type === 'COMMAND_REJECTED') {
      sequence = message.currentSequence
      if (message.correction?.state)
        roomScene = { id: message.correction.state.id, version: message.correction.state.version }
      // A domain rejection surfaces as the same ConvexError data a direct Convex call throws.
      take(message.commandId)?.reject(
        message.reason === 'RULE_WARNINGS'
          ? new ConvexError({
              code: 'DOMAIN_REJECTED',
              reason: message.reason,
              message: message.message,
              warnings: message.warnings ?? []
            } satisfies DomainRejectionErrorData)
          : message.reason
            ? new ConvexError({
                code: 'DOMAIN_REJECTED',
                reason: message.reason,
                message: message.message
              } satisfies DomainRejectionErrorData)
            : new RoomCommandRejectedError(message.code, message.message)
      )
      flush()
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

  const refusal = (commandId: string) =>
    failure ??
    (pending.has(commandId) ? new Error('This command is already pending on this client.') : null)
  const expire = (command: { commandId: string; type: string }, reject: (error: Error) => void) =>
    setTimeout(() => {
      take(command.commandId)
      reject(new Error(`The Session room did not answer ${command.type} in time.`))
    }, commandTimeoutMs)
  const track = (entry: PendingCommand) => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = null
    pending.set(entry.command.commandId, entry)
    flush()
  }

  const executeScene = (
    command: SceneCommandInputDto | SceneFogPublishCommandInput,
    presentation: RoomScenePresentation,
    replayOfSequence?: number
  ): Promise<RoomSceneCommit> => {
    const refused = refusal(command.commandId)
    if (refused) return Promise.reject(refused)
    return new Promise((resolve, reject) =>
      track({
        scope: 'SCENE',
        command,
        presentation,
        replayOfSequence: replayOfSequence ?? null,
        sentSequence: null,
        sent: false,
        resolve,
        reject,
        timer: expire(command, reject)
      })
    )
  }
  const stageFog = (
    message: SceneFogStagingMessage,
    { sceneId, commandId, expectedSceneVersion }: SceneFogPatchInput,
    presentation: RoomScenePresentation
  ): Promise<SceneFogSaveProgress> => {
    const refused = refusal(commandId)
    if (refused) return Promise.reject(refused)
    return new Promise((resolve, reject) =>
      track({
        scope: 'FOG',
        command: { type: message.type, sceneId, commandId, expectedSceneVersion },
        message,
        presentation,
        sent: false,
        resolve,
        reject,
        timer: expire({ commandId, type: message.type }, reject)
      })
    )
  }

  return {
    close,
    scene: () => roomScene,
    whenReady: () =>
      failure
        ? Promise.reject(failure)
        : synchronized
          ? Promise.resolve()
          : new Promise<void>((resolve, reject) => readyWaiters.push({ resolve, reject })),
    subscribeEncounterSession(timeline) {
      encounterTimeline = timeline
      encounterSubscribed = false
      if (synchronized) applyEncounterSubscription()
    },
    sendTransient: (envelope) => send({ envelope, type: 'TRANSIENT' }),
    executeEncounter(command, synchronization) {
      const refused = refusal(command.commandId)
      if (refused) return Promise.reject(refused)
      return new Promise((resolve, reject) =>
        track({
          scope: 'ENCOUNTER',
          command,
          synchronization: synchronization ?? null,
          sent: false,
          resolve,
          reject,
          timer: expire(command, reject)
        })
      )
    },
    executeScene,
    async executeSceneFog(command, presentation) {
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
      let progress = await stageFog({ input, type: 'SCENE_FOG_BEGIN' }, input, presentation)
      // One chunk per append always fits the room's frame cap.
      while (
        progress.status === 'RECEIVING' &&
        progress.receivedChunks < command.layer.chunks.length
      ) {
        const offset = progress.receivedChunks
        progress = await stageFog(
          {
            commandId: input.commandId,
            input: {
              chunks: command.layer.chunks.slice(offset, offset + 1),
              offset,
              saveId: progress.saveId
            },
            type: 'SCENE_FOG_APPEND'
          },
          input,
          presentation
        )
      }
      if (progress.status === 'EXPIRED') throw new Error('Scene fog save expired.')
      return executeScene(
        {
          type: 'PUBLISH_SCENE_FOG_PATCH',
          sceneId: input.sceneId,
          commandId: input.commandId,
          expectedSceneVersion: input.expectedSceneVersion,
          saveId: progress.saveId
        },
        presentation
      )
    }
  }
}

/**
 * The real-backend adapter for `DevelopmentClient`. Encounter command references are internal
 * in Convex, so this client sends them through the Campaign's Session room like the browser; every
 * other function goes to Convex over HTTP. The in-process convex-test adapter calls them directly.
 * `executeSceneCommand` sends a live Scene command (token move, door change, move undo) through the
 * room the same way; since D42 and D43 an Encounter-bound move has no other door.
 */
export class DevelopmentHttpClient extends ConvexHttpClient {
  #accessToken: string | null = null
  readonly #holdRooms: boolean
  readonly #rooms = new Map<string, CommandRoom>()
  readonly #encounterCampaigns = new Map<string, string>()
  readonly #sceneCampaigns = new Map<string, string>()
  readonly #frameListeners = new Set<(frame: RoomFrame) => void>()
  readonly #roomEvents = new Map<string, string[]>()

  // No `auth` option: the base constructor would call setAuth before this class's fields exist.
  // `holdRooms` keeps idle rooms connected, as a browser tab does, until `closeRooms`.
  constructor(address: string, options?: { logger?: boolean; holdRooms?: boolean }) {
    super(address, { logger: options?.logger })
    this.#holdRooms = options?.holdRooms ?? false
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
    const name = getFunctionName(mutation)
    // A room-held Encounter refuses Convex-direct commands, including the GM's token bindings.
    if (name === getFunctionName(bindToken))
      return this.#executeTokenBinding(args[0] as { input: unknown }) as Promise<
        FunctionReturnType<Mutation>
      >
    if (name !== getFunctionName(executeEncounterCommand)) return super.mutation(mutation, ...args)
    return this.#executeEncounterCommand(args[0]) as Promise<FunctionReturnType<Mutation>>
  }

  async executeSceneCommand(
    command: SceneCommandInputDto | SceneFogPublishCommandInput,
    presentation: RoomScenePresentation,
    replayOfSequence?: number
  ): Promise<RoomSceneCommit> {
    return (await this.#sceneRoom(command.sceneId)).executeScene(
      command,
      presentation,
      replayOfSequence
    )
  }

  /** Uploads a fog patch to the room in bounded steps and publishes it, as the browser does. */
  async executeSceneFog(
    command: SceneFogPatchCommand,
    presentation: RoomScenePresentation
  ): Promise<RoomSceneCommit> {
    return (await this.#sceneRoom(command.sceneId)).executeSceneFog(command, presentation)
  }

  async #sceneCampaign(sceneId: string): Promise<string> {
    let campaignId = this.#sceneCampaigns.get(sceneId)
    if (!campaignId) {
      campaignId = (await this.query(api.scenes.recipientReads.header, { sceneId })).campaignId
      this.#sceneCampaigns.set(sceneId, campaignId)
    }
    return campaignId
  }

  async #encounterCampaign(encounterId: string): Promise<string> {
    let campaignId = this.#encounterCampaigns.get(encounterId)
    if (!campaignId) {
      campaignId = (await this.query(api.encounters.projectionReads.get, { encounterId }))
        .campaignId
      this.#encounterCampaigns.set(encounterId, campaignId)
    }
    return campaignId
  }

  async #sceneRoom(sceneId: string): Promise<CommandRoom> {
    return this.#room(await this.#sceneCampaign(sceneId))
  }

  /**
   * Looks up an Encounter's and its Scene's Campaign and joins the room, so measured commands pay no
   * lookup, ticket or join. Returns the Campaign ID.
   */
  async warmRoom(input: { encounterId: string; sceneId: string }): Promise<string> {
    const campaignId = await this.#encounterCampaign(input.encounterId)
    if ((await this.#sceneCampaign(input.sceneId)) !== campaignId)
      throw new Error('The Scene and the Encounter belong to different Campaigns.')
    await this.#room(campaignId).whenReady()
    return campaignId
  }

  /** Every frame any of this client's rooms receives; returns the function that stops listening. */
  onRoomFrame(listener: (frame: RoomFrame) => void): () => void {
    this.#frameListeners.add(listener)
    return () => this.#frameListeners.delete(listener)
  }

  /** The Scene this client's room socket last held, from the room's own frames. */
  roomScene(campaignId: string): { id: string; version: number } | null {
    return this.#room(campaignId).scene()
  }

  /** What this client's room sockets for the Campaign were challenged with or ended by, in order. */
  roomEvents(campaignId: string): readonly string[] {
    return this.#roomEvents.get(campaignId) ?? []
  }

  subscribeEncounterSession(campaignId: string, timeline: boolean) {
    this.#room(campaignId).subscribeEncounterSession(timeline)
  }

  sendTransient(campaignId: string, envelope: SceneTransientEnvelopeDto) {
    this.#room(campaignId).sendTransient(envelope)
  }

  /** The Session Worker this client's rooms connect to (http or https). */
  workerUrl(): URL {
    return liveSessionWorkerUrl(this.url)
  }

  closeRooms() {
    for (const room of [...this.#rooms.values()]) room.close()
  }

  async #executeEncounterCommand(input: unknown): Promise<EncounterCommandResultDto> {
    const { command } = encounterExecuteInputSchema.parse(input)
    return this.#room(await this.#encounterCampaign(command.encounterId)).executeEncounter(command)
  }

  async #executeTokenBinding(args: { input: unknown }): Promise<EncounterCommandResultDto> {
    const input = encounterActorTokenBindingCommandInputDtoSchema.parse(args.input)
    const campaignId = await this.#encounterCampaign(input.encounterId)
    // The room reads the binding's Scene from its synchronized presented Scene, as the GM's tabletop holds it.
    const [header, presentation] = await Promise.all([
      this.query(api.scenes.liveReads.header, { sceneId: input.sceneId }),
      this.query(api.scenes.presentations.get, { campaignId })
    ])
    if (!presentation) throw new Error('The Campaign has no presented Scene to bind tokens on.')
    return this.#room(campaignId).executeEncounter(input, {
      sceneId: input.sceneId,
      expectedSceneVersion: header.version,
      expectedPresentationVersion: presentation.version
    })
  }

  #room(campaignId: string): CommandRoom {
    const existing = this.#rooms.get(campaignId)
    if (existing) return existing
    const url = this.workerUrl()
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = `${url.pathname.replace(/\/$/, '')}${LIVE_SESSION_PATH_PREFIX}/${campaignId}`
    const room = openCommandRoom({
      url: url.toString(),
      origin: liveSessionOrigin,
      issueTicket: () => super.action(api.liveSessions.tickets.issue, { campaignId }),
      accessToken: () => this.#accessToken,
      holdOpen: this.#holdRooms,
      onMessage: (message, receivedAt) => {
        for (const listener of this.#frameListeners) listener({ campaignId, message, receivedAt })
      },
      onEvent: (event) => {
        const events = this.#roomEvents.get(campaignId) ?? []
        events.push(`${event} at ${Math.round(performance.now())} ms`)
        this.#roomEvents.set(campaignId, events)
      },
      onClosed: () => {
        if (this.#rooms.get(campaignId) === room) this.#rooms.delete(campaignId)
      }
    })
    this.#rooms.set(campaignId, room)
    return room
  }
}
