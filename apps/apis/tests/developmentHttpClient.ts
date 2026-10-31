import { ConvexHttpClient, type HttpMutationOptions } from 'convex/browser'
import {
  getFunctionName,
  type ArgsAndOptions,
  type FunctionReference,
  type FunctionReference_future,
  type FunctionReturnType,
  type OptionalRestArgs
} from 'convex/server'
import { ConvexError } from 'convex/values'
import type { DomainRejectionErrorData } from '@artificer-toolkit/schema/api/domainRejections'
import type {
  GetEncounterActionChoicesInputDto,
  GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { GetEncounterActionTargetModifiersInputDto } from '@artificer-toolkit/schema/api/encounterActionTargetModifiers'
import {
  encounterExecuteInputSchema,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto,
  type EncounterTimelineDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterReadDto,
  EncounterReadResultDto
} from '@artificer-toolkit/schema/api/encounterRead'
import type { CharacterSheetCommandResponseDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import {
  LIVE_SESSION_TRY_AGAIN_MESSAGE,
  type LiveSessionCommandDto
} from '@artificer-toolkit/schema/api/liveSessionCommands'
import type { LiveSessionTicketDto } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import {
  LIVE_SESSION_PATH_PREFIX,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionWebSocketServerMessageDtoSchema,
  type EncounterSessionFrameDto,
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
  type BindEncounterToPresentedSceneInputDto,
  type BindEncounterToPresentedSceneResultDto,
  type EncounterActorTokenBindingCommandInputDto,
  type SceneCommandInputDto,
  type SceneCommandResultDto,
  type SceneTransientEnvelopeDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SOCKET_MESSAGE_BUDGETS } from '../../session-worker/src/roomLimits'
import { api } from '../convex/_generated/api.js'
import { executeEncounterCommand } from './developmentClient'
import { bindScene, bindToken } from './developmentEncounterLifecycle'

type RoomCommand = EncounterCommandInputDto | EncounterActorTokenBindingCommandInputDto
export type RoomSheetCommand = Extract<LiveSessionCommandDto, { scope: 'CHARACTER_SHEET' }>
type RoomSocket = Pick<WebSocket, 'addEventListener' | 'close' | 'send'>
type RoomSocketInit = { headers: { origin: string }; protocols: string[] }
type SceneFogStagingMessage = Extract<
  LiveSessionWebSocketClientMessageDto,
  { type: 'SCENE_FOG_APPEND' | 'SCENE_FOG_BEGIN' }
>
type SceneFogPatchCommand = Extract<SceneCommandInputDto, { type: 'PATCH_SCENE_FOG' }>
export type OpenRoomSocket = (url: string, init: RoomSocketInit) => RoomSocket
/** The presented Scene the room must report, at this version or later, before a command that reads it is sent. */
type RoomSceneRequirement = { sceneId: string; expectedSceneVersion: number }
/** Reads the Scene Convex presents now. A command that binds to it asks again when the room moves to another Scene. */
type PresentedSceneReader = () => Promise<RoomSceneRequirement>
type PresentedSceneWait = {
  read: PresentedSceneReader
  requirement: RoomSceneRequirement | null
  // The Scene id the room reported (null before its first STATE_SYNC) when `read` last ran.
  askedAtRoomScene: string | null | undefined
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
    presentedScene?: PresentedSceneReader
  ) => Promise<EncounterCommandResultDto>
  /** Sends one live Character Sheet command, as the Sheet does while the room holds the Character. */
  executeCharacterSheet: (command: RoomSheetCommand) => Promise<CharacterSheetCommandResponseDto>
  /** Binds the Encounter to the room's presented Scene, as the GM's tabletop does (D47). */
  executeEncounterBinding: (
    command: BindEncounterToPresentedSceneInputDto,
    presentedScene: PresentedSceneReader
  ) => Promise<BindEncounterToPresentedSceneResultDto>
  executeScene: (
    command: SceneCommandInputDto | SceneFogPublishCommandInput,
    replayOfSequence?: number
  ) => Promise<RoomSceneCommit>
  /** Stages a fog patch over the socket and publishes it, as the browser does (D79). */
  executeSceneFog: (command: SceneFogPatchCommand) => Promise<RoomSceneCommit>
  /** Asks one turn read the room answers from its own Encounter state (A35-S6e), as the tabletop does. */
  readEncounter: (read: EncounterReadDto) => Promise<EncounterReadResultDto>
  /** Subscribes to the Encounter session and resolves with the frame the room answers with, as it holds the Run now. */
  readEncounterSession: () => Promise<EncounterSessionFrameDto>
  /** Resolves once the room has admitted this member and sent its first STATE_SYNC. */
  whenReady: () => Promise<void>
  /** The Scene as the room last reported it to this socket, or null before the room has sent one. */
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

/** A domain rejection surfaces as the same ConvexError data a direct Convex call throws. */
function roomRejection(
  message: Extract<
    LiveSessionWebSocketServerMessageDto,
    { type: 'COMMAND_REJECTED' | 'ENCOUNTER_READ_REJECTED' }
  >
): Error {
  if (message.reason === 'RULE_WARNINGS')
    return new ConvexError({
      code: 'DOMAIN_REJECTED',
      reason: message.reason,
      message: message.message,
      warnings: message.type === 'COMMAND_REJECTED' ? (message.warnings ?? []) : []
    } satisfies DomainRejectionErrorData)
  return message.reason
    ? new ConvexError({
        code: 'DOMAIN_REJECTED',
        reason: message.reason,
        message: message.message
      } satisfies DomainRejectionErrorData)
    : new RoomCommandRejectedError(message.code, message.message)
}

/** A refusal the room gives as the read's answer; any other failure reads Convex, as the tabletop does. */
function isAuthoritativeRefusal(error: unknown): boolean {
  return (
    error instanceof ConvexError ||
    (error instanceof RoomCommandRejectedError && error.code === 'FORBIDDEN')
  )
}

type PendingCommand = {
  sent: boolean
  timer: ReturnType<typeof setTimeout>
  reject: (error: Error) => void
} & (
  | {
      scope: 'ENCOUNTER'
      command: RoomCommand
      presentedScene: PresentedSceneWait | null
      resolve: (result: EncounterCommandResultDto) => void
    }
  | {
      scope: 'ENCOUNTER_BINDING'
      command: BindEncounterToPresentedSceneInputDto
      presentedScene: PresentedSceneWait
      resolve: (result: BindEncounterToPresentedSceneResultDto) => void
    }
  | {
      scope: 'CHARACTER_SHEET'
      command: RoomSheetCommand['command']
      characterId: string
      encounterId: string
      resolve: (result: CharacterSheetCommandResponseDto) => void
    }
  | {
      scope: 'SCENE'
      command: SceneCommandInputDto | SceneFogPublishCommandInput
      // An exact retry repeats the original session sequence, which the room's receipt covers.
      replayOfSequence: number | null
      sentSequence: number | null
      resolve: (commit: RoomSceneCommit) => void
    }
  | {
      // A fog staging step answers with SCENE_FOG_PROGRESS and needs the room's Scene to be the command's.
      scope: 'FOG'
      command: Pick<SceneFogPatchInput, 'sceneId' | 'commandId' | 'expectedSceneVersion'> & {
        type: SceneFogStagingMessage['type']
      }
      message: SceneFogStagingMessage
      resolve: (progress: SceneFogSaveProgress) => void
    }
)

type PendingRead<Value> = {
  timer: ReturnType<typeof setTimeout>
  resolve: (value: Value) => void
  reject: (error: Error) => void
}

// The close reason the room gives a member it evicts (`#closeSockets`).
const roomAccessEndedReason = 'Campaign access ended.'

const waitForPresentedScene = (read: PresentedSceneReader): PresentedSceneWait => ({
  read,
  requirement: null,
  askedAtRoomScene: undefined
})

const commandTimeoutMs = 120_000
// A room that answers "try again" (an outside change landed mid-command) is asked once more.
const roomRetryLimit = 2
// Closing an idle room lets a finished driver exit; the next command joins with a fresh ticket.
const idleCloseMs = 5_000
// The local web origin the Worker admits; the drivers authenticate with the same origin.
const liveSessionOrigin = 'http://localhost:3000'
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
// Convex hides an Encounter's Run from a player until its checkpoint (D87), so only a GM-side client
// can look up an Encounter's Campaign. Every client in the process shares what the GM resolved, so
// a player's or anonymous client reaches the room and gets the room's own answer.
const encounterCampaigns = new Map<string, string>()

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
 * command waits until the room's own STATE_SYNC (or a commit) reports the command's Scene at its
 * expected version; the room builds its presented Scene on admission. With `holdOpen`, an idle room stays connected until `close`.
 */
export function openCommandRoom(options: {
  url: string
  origin: string
  issueTicket: () => Promise<LiveSessionTicketDto>
  /** Called for every challenge, so a held socket answers with a fresh token as the browser does. */
  accessToken: () => Promise<string | null>
  onClosed: () => void
  holdOpen?: boolean
  openSocket?: OpenRoomSocket
  onMessage?: (message: LiveSessionWebSocketServerMessageDto, receivedAt: number) => void
  /** Each time the room asks this socket to authenticate again, and the failure that ends it. */
  onEvent?: (event: string) => void
}): CommandRoom {
  const pending = new Map<string, PendingCommand>()
  const pendingReads = new Map<string, PendingRead<EncounterReadResultDto>>()
  const sessionReads = new Set<PendingRead<EncounterSessionFrameDto>>()
  let socket: RoomSocket | null = null
  let admitted = false
  // Admitted and synced: set by STATE_SYNC, cleared when the room asks to authenticate again.
  let synced = false
  const readyWaiters: { resolve: () => void; reject: (error: Error) => void }[] = []
  let encounterTimeline: boolean | null = null
  let encounterSubscribed = false
  let sequence: number | null = null
  // The room's presented Scene as its last STATE_SYNC and committed Scene changes report it.
  let roomScene: { id: string; version: number } | null = null
  let failure: Error | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  // The room closes a socket that exceeds its COMMAND budget, so sends keep one token below it.
  const commandBudget = SOCKET_MESSAGE_BUDGETS.COMMAND
  let commandTokens = commandBudget.capacity - 1
  let commandTokensAt = Date.now()
  let commandRetry: ReturnType<typeof setTimeout> | null = null
  const retried = new Map<string, number>()
  let rejoins = 0

  const send = (message: LiveSessionWebSocketClientMessageDto) =>
    socket?.send(JSON.stringify(message))

  const fail = (error: Error) => {
    if (failure) return
    failure = error
    options.onEvent?.(`ended: ${error.message}`)
    if (idleTimer) clearTimeout(idleTimer)
    if (commandRetry) clearTimeout(commandRetry)
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    pending.clear()
    for (const read of pendingReads.values()) {
      clearTimeout(read.timer)
      read.reject(error)
    }
    pendingReads.clear()
    for (const read of sessionReads) {
      clearTimeout(read.timer)
      read.reject(error)
    }
    sessionReads.clear()
    for (const waiter of readyWaiters.splice(0)) waiter.reject(error)
    socket?.close(1000, 'Development driver closed the Session room.')
    options.onClosed()
  }

  const close = () => fail(new Error('The Session room connection is closed.'))

  const closeWhenIdle = () => {
    if (
      pending.size === 0 &&
      pendingReads.size === 0 &&
      sessionReads.size === 0 &&
      readyWaiters.length === 0 &&
      !failure &&
      !options.holdOpen
    ) {
      // Each settled call and pushed frame re-arms the timer; an earlier timer left running would
      // still close the room under a call that started after it.
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(close, idleCloseMs)
    }
  }

  const take = (commandId: string) => {
    const entry = pending.get(commandId)
    if (!entry) return null
    pending.delete(commandId)
    clearTimeout(entry.timer)
    closeWhenIdle()
    return entry
  }

  const takeRead = (requestId: string) => {
    const entry = pendingReads.get(requestId)
    if (!entry) return null
    pendingReads.delete(requestId)
    clearTimeout(entry.timer)
    closeWhenIdle()
    return entry
  }

  const authenticate = async () => {
    const accessToken = await options.accessToken().catch(() => null)
    if (failure) return
    if (!accessToken)
      return fail(new Error('Unauthenticated: the Session room needs a signed-in client.'))
    send({ accessToken, type: 'AUTHENTICATE' })
  }

  const takeCommandToken = () => {
    const now = Date.now()
    commandTokens = Math.min(
      commandBudget.capacity - 1,
      commandTokens + ((now - commandTokensAt) / 1000) * commandBudget.refillPerSecond
    )
    commandTokensAt = now
    if (commandTokens >= 1) {
      commandTokens -= 1
      return true
    }
    commandRetry ??= setTimeout(
      () => {
        commandRetry = null
        flush()
      },
      ((1 - commandTokens) / commandBudget.refillPerSecond) * 1000
    )
    return false
  }

  const askPresentedScene = (command: { commandId: string }, presented: PresentedSceneWait) => {
    presented.askedAtRoomScene = roomScene?.id ?? null
    void presented.read().then(
      (requirement) => {
        presented.requirement = requirement
        flush()
      },
      (error: unknown) =>
        take(command.commandId)?.reject(error instanceof Error ? error : new Error(String(error)))
    )
  }

  const flush = () => {
    if (failure || !admitted || sequence === null) return
    for (const entry of pending.values()) {
      if (entry.sent) continue
      const presented =
        entry.scope === 'ENCOUNTER' || entry.scope === 'ENCOUNTER_BINDING'
          ? entry.presentedScene
          : null
      const required =
        entry.scope === 'ENCOUNTER' || entry.scope === 'ENCOUNTER_BINDING'
          ? (entry.presentedScene?.requirement ?? null)
          : entry.scope === 'CHARACTER_SHEET'
            ? null
            : {
                sceneId: entry.command.sceneId,
                expectedSceneVersion: entry.command.expectedSceneVersion
              }
      // The room alone moves its Scene; the next STATE_SYNC or commit that reaches it flushes again.
      const held =
        !!required &&
        roomScene?.id === required.sceneId &&
        roomScene.version >= required.expectedSceneVersion
      if ((presented || required) && !held) {
        // A presentation that raced this command can leave the room on a Scene the requirement is
        // not for. Ask Convex again once per Scene the room reports.
        if (presented && presented.askedAtRoomScene !== (roomScene?.id ?? null))
          askPresentedScene(entry.command, presented)
        continue
      }
      if (entry.scope !== 'FOG' && !takeCommandToken()) return
      if (entry.scope === 'ENCOUNTER') {
        send({
          command: { command: entry.command, scope: 'ENCOUNTER' },
          expectedSessionSequence: sequence,
          type: 'COMMAND'
        })
        entry.sent = true
        continue
      }
      if (entry.scope === 'ENCOUNTER_BINDING') {
        send({
          command: { command: entry.command, scope: 'ENCOUNTER_BINDING' },
          expectedSessionSequence: sequence,
          type: 'COMMAND'
        })
        entry.sent = true
        continue
      }
      if (entry.scope === 'CHARACTER_SHEET') {
        send({
          command: {
            characterId: entry.characterId,
            command: entry.command,
            encounterId: entry.encounterId,
            scope: 'CHARACTER_SHEET'
          },
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
      synced = false
      encounterSubscribed = false
      for (const entry of pending.values()) entry.sent = false
      void authenticate()
    } else if (message.type === 'TRANSIENT_READY') {
      admitted = true
    } else if (message.type === 'STATE_SYNC') {
      sequence = message.sequence
      roomScene = message.state.scene
        ? { id: message.state.scene.id, version: message.state.scene.version }
        : null
      synced = true
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
      } else if (entry?.scope === 'ENCOUNTER_BINDING' && delta?.scope === 'ENCOUNTER_BINDING') {
        take(message.commandId)
        entry.resolve(delta.result)
      } else if (entry?.scope === 'CHARACTER_SHEET' && delta?.scope === 'CHARACTER_SHEET') {
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
      const entry = pending.get(message.commandId)
      const retries = (retried.get(message.commandId) ?? 0) + 1
      if (
        entry &&
        (entry.scope === 'ENCOUNTER' || entry.scope === 'ENCOUNTER_BINDING') &&
        message.code === 'UNAVAILABLE' &&
        message.message === LIVE_SESSION_TRY_AGAIN_MESSAGE &&
        retries <= roomRetryLimit
      ) {
        // The room wrote nothing, and its journal covers an exact resend of the same command.
        retried.set(message.commandId, retries)
        entry.sent = false
      } else take(message.commandId)?.reject(roomRejection(message))
      flush()
    } else if (message.type === 'ENCOUNTER_SESSION') {
      for (const read of sessionReads) {
        clearTimeout(read.timer)
        read.resolve(message.session)
      }
      sessionReads.clear()
      closeWhenIdle()
    } else if (message.type === 'ENCOUNTER_READ_RESULT') {
      takeRead(message.requestId)?.resolve(message.result)
    } else if (message.type === 'ENCOUNTER_READ_REJECTED') {
      takeRead(message.requestId)?.reject(roomRejection(message))
    }
  }

  const join = async (attempt: number): Promise<void> => {
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
    opened.addEventListener('close', (event) => {
      // Activation waits on transient inputs such as a pending content snapshot build, so like the
      // browser client an unadmitted socket retries it with backoff.
      if (
        !admitted &&
        event.code === 1008 &&
        event.reason === 'Live-session activation failed.' &&
        attempt < 5
      ) {
        options.onEvent?.(`activation retry ${attempt + 1}`)
        setTimeout(() => void join(attempt + 1).catch(joinFailed), 250 * 2 ** attempt)
        return
      }
      // The room evicts a member whose Campaign access changed (an ownership transfer). Like the
      // browser, rejoin with a fresh ticket and resend what waits: its command ID makes a repeat an
      // exact replay, and the room plans it for the access the member holds now.
      if (
        admitted &&
        event.code === 1008 &&
        event.reason === roomAccessEndedReason &&
        pending.size > 0 &&
        rejoins < roomRetryLimit
      ) {
        rejoins += 1
        options.onEvent?.(`rejoin ${rejoins}`)
        admitted = false
        synced = false
        encounterSubscribed = false
        for (const entry of pending.values()) entry.sent = false
        void join(0).catch(joinFailed)
        return
      }
      fail(new Error(`The Session room closed the connection (${event.code} ${event.reason}).`))
    })
  }
  const joinFailed = (error: unknown) =>
    fail(error instanceof Error ? error : new Error('Could not join the Session room.'))
  void join(0).catch(joinFailed)

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
    replayOfSequence?: number
  ): Promise<RoomSceneCommit> => {
    const refused = refusal(command.commandId)
    if (refused) return Promise.reject(refused)
    return new Promise((resolve, reject) =>
      track({
        scope: 'SCENE',
        command,
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
    { sceneId, commandId, expectedSceneVersion }: SceneFogPatchInput
  ): Promise<SceneFogSaveProgress> => {
    const refused = refusal(commandId)
    if (refused) return Promise.reject(refused)
    return new Promise((resolve, reject) =>
      track({
        scope: 'FOG',
        command: { type: message.type, sceneId, commandId, expectedSceneVersion },
        message,
        sent: false,
        resolve,
        reject,
        timer: expire({ commandId, type: message.type }, reject)
      })
    )
  }

  const whenReady = () => {
    if (failure) return Promise.reject(failure)
    if (synced) return Promise.resolve()
    // A caller waiting out a re-authentication still uses the room, so the idle close must not end it.
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = null
    return new Promise<void>((resolve, reject) => readyWaiters.push({ resolve, reject }))
  }

  const readEncounter = async (read: EncounterReadDto): Promise<EncounterReadResultDto> => {
    await whenReady()
    const requestId = crypto.randomUUID()
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = null
    const answer = new Promise<EncounterReadResultDto>((resolve, reject) =>
      pendingReads.set(requestId, {
        resolve,
        reject,
        timer: setTimeout(
          () =>
            takeRead(requestId)?.reject(
              new Error('The Session room did not answer ENCOUNTER_READ in time.')
            ),
          commandTimeoutMs
        )
      })
    )
    send({ read, requestId, type: 'ENCOUNTER_READ' })
    return answer
  }

  const readEncounterSession = async (): Promise<EncounterSessionFrameDto> => {
    await whenReady()
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = null
    const answer = new Promise<EncounterSessionFrameDto>((resolve, reject) => {
      const read: PendingRead<EncounterSessionFrameDto> = {
        resolve,
        reject,
        timer: setTimeout(() => {
          sessionReads.delete(read)
          closeWhenIdle()
          reject(new Error('The Session room did not send the Encounter session in time.'))
        }, commandTimeoutMs)
      }
      sessionReads.add(read)
    })
    // A subscription replaces the previous one, and the room answers it with the session it holds now.
    encounterTimeline ??= false
    encounterSubscribed = true
    send({ timeline: encounterTimeline, type: 'SUBSCRIBE_ENCOUNTER_SESSION' })
    return answer
  }

  return {
    close,
    scene: () => roomScene,
    whenReady,
    readEncounter,
    readEncounterSession,
    subscribeEncounterSession(timeline) {
      encounterTimeline = timeline
      encounterSubscribed = false
      if (synced) applyEncounterSubscription()
    },
    sendTransient: (envelope) => send({ envelope, type: 'TRANSIENT' }),
    executeEncounter(command, presentedScene) {
      const refused = refusal(command.commandId)
      if (refused) return Promise.reject(refused)
      return new Promise((resolve, reject) =>
        track({
          scope: 'ENCOUNTER',
          command,
          presentedScene: presentedScene ? waitForPresentedScene(presentedScene) : null,
          sent: false,
          resolve,
          reject,
          timer: expire(command, reject)
        })
      )
    },
    executeCharacterSheet({ command, characterId, encounterId }) {
      const refused = refusal(command.commandId)
      if (refused) return Promise.reject(refused)
      return new Promise((resolve, reject) =>
        track({
          scope: 'CHARACTER_SHEET',
          command,
          characterId,
          encounterId,
          sent: false,
          resolve,
          reject,
          timer: expire(command, reject)
        })
      )
    },
    executeEncounterBinding(command, presentedScene) {
      const refused = refusal(command.commandId)
      if (refused) return Promise.reject(refused)
      return new Promise((resolve, reject) =>
        track({
          scope: 'ENCOUNTER_BINDING',
          command,
          presentedScene: waitForPresentedScene(presentedScene),
          sent: false,
          resolve,
          reject,
          timer: expire(command, reject)
        })
      )
    },
    executeScene,
    async executeSceneFog(command) {
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
      let progress = await stageFog({ input, type: 'SCENE_FOG_BEGIN' }, input)
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
          input
        )
      }
      if (progress.status === 'EXPIRED') throw new Error('Scene fog save expired.')
      return executeScene({
        type: 'PUBLISH_SCENE_FOG_PATCH',
        sceneId: input.sceneId,
        commandId: input.commandId,
        expectedSceneVersion: input.expectedSceneVersion,
        saveId: progress.saveId
      })
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
  #fetchToken: (() => Promise<string>) | null = null
  readonly #holdRooms: boolean
  readonly #rooms = new Map<string, CommandRoom>()
  readonly #openedRoomCampaignIds = new Set<string>()
  readonly #sceneCampaigns = new Map<string, string>()
  readonly #frameListeners = new Set<(frame: RoomFrame) => void>()
  readonly #roomEvents = new Map<string, string[]>()

  // No `auth` option: the base constructor would call setAuth before this class's fields exist.
  // `holdRooms` keeps idle rooms connected, as a browser tab does, until `closeRooms`.
  constructor(address: string, options?: { logger?: boolean; holdRooms?: boolean }) {
    super(address, { logger: options?.logger })
    this.#holdRooms = options?.holdRooms ?? false
  }

  /** With `fetchToken`, each Session room challenge is answered with a freshly minted token. */
  override setAuth(value: string, fetchToken?: () => Promise<string>) {
    super.setAuth(value)
    this.#accessToken = value
    this.#fetchToken = fetchToken ?? null
  }

  override clearAuth() {
    super.clearAuth()
    this.#accessToken = null
    this.#fetchToken = null
  }

  override mutation<
    Mutation extends FunctionReference<'mutation'> | FunctionReference_future<'mutation'>
  >(
    mutation: Mutation,
    ...args: ArgsAndOptions<Mutation, HttpMutationOptions>
  ): Promise<FunctionReturnType<Mutation>> {
    const name = getFunctionName(mutation)
    // A room-held Encounter refuses Convex-direct commands, including the GM's token bindings.
    if (name === getFunctionName(bindToken))
      return this.#executeTokenBinding(args[0] as { input: unknown }) as Promise<
        FunctionReturnType<Mutation>
      >
    // The GM's tabletop always binds through the room (D47), so every binding does.
    if (name === getFunctionName(bindScene))
      return this.#bindSceneThroughRoom(
        args[0] as BindEncounterToPresentedSceneInputDto
      ) as Promise<FunctionReturnType<Mutation>>
    if (name !== getFunctionName(executeEncounterCommand)) return super.mutation(mutation, ...args)
    return this.#executeEncounterCommand(args[0]) as Promise<FunctionReturnType<Mutation>>
  }

  override async query<
    Query extends FunctionReference<'query'> | FunctionReference_future<'query'>
  >(query: Query, ...args: OptionalRestArgs<Query>): Promise<FunctionReturnType<Query>> {
    const held = await this.#readHeldRun(getFunctionName(query), args[0])
    return held === undefined ? super.query(query, ...args) : (held as FunctionReturnType<Query>)
  }

  /** Sends a live Character Sheet command through the room that holds the Character's Run. */
  async executeCharacterSheet(
    command: RoomSheetCommand
  ): Promise<CharacterSheetCommandResponseDto> {
    return this.#room(await this.#encounterCampaign(command.encounterId)).executeCharacterSheet(
      command
    )
  }

  async executeSceneCommand(
    command: SceneCommandInputDto | SceneFogPublishCommandInput,
    replayOfSequence?: number
  ): Promise<RoomSceneCommit> {
    return (await this.#sceneRoom(command.sceneId)).executeScene(command, replayOfSequence)
  }

  /** Uploads a fog patch to the room in bounded steps and publishes it, as the browser does. */
  async executeSceneFog(command: SceneFogPatchCommand): Promise<RoomSceneCommit> {
    return (await this.#sceneRoom(command.sceneId)).executeSceneFog(command)
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
    let campaignId = encounterCampaigns.get(encounterId)
    if (!campaignId) {
      campaignId = (await this.query(api.encounters.projectionReads.get, { encounterId }))
        .campaignId
      encounterCampaigns.set(encounterId, campaignId)
    }
    return campaignId
  }

  async #sceneRoom(sceneId: string): Promise<CommandRoom> {
    return this.#room(await this.#sceneCampaign(sceneId))
  }

  /**
   * Looks up the Campaign of the Scene the Encounter is bound to and joins the room, so measured
   * commands pay no lookup, ticket or join. Convex shows players the Run only after a checkpoint, so
   * the Encounter's Campaign is taken from its bound Scene. Returns the Campaign ID.
   */
  async warmRoom(input: { encounterId: string; sceneId: string }): Promise<string> {
    const campaignId = await this.#sceneCampaign(input.sceneId)
    encounterCampaigns.set(input.encounterId, campaignId)
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

  /** The Run's timeline as the room pushes it to this member; null while the room holds no Run. */
  async encounterTimeline(campaignId: string): Promise<EncounterTimelineDto | null> {
    const session = await this.encounterSession(campaignId, true)
    return session.held ? session.timeline : null
  }

  /** The Encounter session the room sends this member after it subscribes, as the room holds the Run now. */
  async encounterSession(campaignId: string, timeline: boolean): Promise<EncounterSessionFrameDto> {
    const room = this.#room(campaignId)
    room.subscribeEncounterSession(timeline)
    return room.readEncounterSession()
  }

  /** The room's answer to one `ENCOUNTER_READ`; the room's refusal rejects, as for the tabletop. */
  readEncounter(campaignId: string, read: EncounterReadDto): Promise<EncounterReadResultDto> {
    return this.#room(campaignId).readEncounter(read)
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

  /** Every Campaign whose room this client has opened, including rooms since closed. */
  openedRoomCampaignIds(): ReadonlySet<string> {
    return this.#openedRoomCampaignIds
  }

  /**
   * What the room answers a turn read or the pending decision with while it holds the Run (A35-S6e),
   * at its own version, as the tabletop reads them. Undefined when Convex answers instead: the read
   * is not a room read, the room does not hold the Run or cannot answer from its own state.
   */
  async #readHeldRun(name: string, args: unknown): Promise<unknown> {
    if (name === getFunctionName(api.encounters.pendingReads.pendingRuleOccurrence)) {
      const { encounterId } = args as { encounterId: string }
      const session = await this.#room(
        await this.#encounterCampaign(encounterId)
      ).readEncounterSession()
      if (!session.held) return undefined
      if (session.state.encounter?.id === encounterId) return session.state.pending
      return session.preparedPending.find((entry) => entry.encounter.id === encounterId)?.pending
    }
    let read: EncounterReadDto
    if (name === getFunctionName(api.encounters.actionChoices.get)) {
      const { expectedVersion: _expectedVersion, ...input } =
        args as GetEncounterActionChoicesInputDto
      read = { kind: 'ACTION_CHOICES', input }
    } else if (name === getFunctionName(api.encounters.actionChoices.optional)) {
      const { expectedVersion: _expectedVersion, ...input } =
        args as GetEncounterOptionalActionChoicesInputDto
      read = { kind: 'OPTIONAL_ACTION_CHOICES', input }
    } else if (name === getFunctionName(api.encounters.actionTargetModifiers.get)) {
      const { expectedVersion: _expectedVersion, ...input } =
        args as GetEncounterActionTargetModifiersInputDto
      read = { kind: 'ACTION_TARGET_MODIFIERS', input }
    } else return undefined
    const room = this.#room(await this.#encounterCampaign(read.input.encounterId))
    try {
      const reply = await room.readEncounter(read)
      return reply.kind === read.kind ? reply.result : undefined
    } catch (error) {
      // The room's own refusal is the answer; Convex trails the room and would repeat it from older state.
      if (isAuthoritativeRefusal(error)) throw error
      return undefined
    }
  }

  async #executeEncounterCommand(input: unknown): Promise<EncounterCommandResultDto> {
    const { command } = encounterExecuteInputSchema.parse(input)
    return this.#room(await this.#encounterCampaign(command.encounterId)).executeEncounter(command)
  }

  async #executeTokenBinding(args: { input: unknown }): Promise<EncounterCommandResultDto> {
    const input = encounterActorTokenBindingCommandInputDtoSchema.parse(args.input)
    const campaignId = await this.#encounterCampaign(input.encounterId)
    // The room reads the binding's Scene from its presented Scene, as the GM's tabletop holds it, so
    // the command waits for that Scene; a binding for another Scene is then the room's to refuse.
    return this.#room(campaignId).executeEncounter(input, () =>
      this.#presentedSceneRequirement(campaignId)
    )
  }

  async #presentedSceneRequirement(campaignId: string) {
    const presentation = await this.query(api.scenes.presentations.get, { campaignId })
    if (!presentation?.sceneId) throw new Error('The Campaign is not presenting a Scene.')
    const header = await this.query(api.scenes.recipientReads.header, {
      sceneId: presentation.sceneId
    })
    return { sceneId: presentation.sceneId, expectedSceneVersion: header.version }
  }

  async #bindSceneThroughRoom(
    input: BindEncounterToPresentedSceneInputDto
  ): Promise<BindEncounterToPresentedSceneResultDto> {
    const campaignId = await this.#encounterCampaign(input.encounterId)
    // The room binds to the Scene it presents, so it must hold the Scene the GM presented.
    return this.#room(campaignId).executeEncounterBinding(input, () =>
      this.#presentedSceneRequirement(campaignId)
    )
  }

  #room(campaignId: string): CommandRoom {
    const existing = this.#rooms.get(campaignId)
    if (existing) return existing
    this.#openedRoomCampaignIds.add(campaignId)
    const url = this.workerUrl()
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = `${url.pathname.replace(/\/$/, '')}${LIVE_SESSION_PATH_PREFIX}/${campaignId}`
    const room = openCommandRoom({
      url: url.toString(),
      origin: liveSessionOrigin,
      issueTicket: () => super.action(api.liveSessions.tickets.issue, { campaignId }),
      accessToken: async () => {
        if (this.#fetchToken) this.setAuth(await this.#fetchToken(), this.#fetchToken)
        return this.#accessToken
      },
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
