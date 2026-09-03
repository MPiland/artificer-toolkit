import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createServer as createNetServer } from 'node:net'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import {
  createCampaignRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  createEncounterRepository,
  createLiveSessionCommandLeaseRepository,
  createMediaRepository,
  createRuleOccurrenceRepository,
  createVttSceneRepository,
  createDb,
  srdBaselineContent,
  withTransaction,
  withUserContext
} from '@artificer-toolkit/db'
import {
  assignCampaignCharacter,
  createCampaign,
  createCampaignSceneDefinition,
  createCampaignSession,
  CampaignAccessError,
  CampaignNotFoundError,
  createEncounter,
  createEncounterBlueprint,
  dispatchCommandForUser,
  executeEncounterCommand,
  executeEncounterSceneCommandWithState,
  deleteCampaign,
  getCampaign,
  getCampaignPlaySettings,
  getVttMapDelivery,
  issueLiveSessionTicket,
  removeCampaignMember,
  saveCampaignPlaySettings,
  setCampaignLiveScenePresentation
} from '@artificer-toolkit/functions/services'
import { sql } from 'kysely'
import { MediaAccessError, MediaNotFoundError } from '@artificer-toolkit/functions/services/media'
import {
  LIVE_SESSION_PATH_PREFIX,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_WEBSOCKET_PROTOCOL,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionJoinOptionsDto,
  type LiveSessionWebSocketClientMessageDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { WebSocket, type RawData } from 'ws'

import {
  findFixtureCatalog,
  requireLocalDatabaseUrl,
  type BuilderResolutionTiming,
  type CharacterLifecycleFixture,
  type CharacterRuleEvaluationTiming,
  type SheetReadTiming
} from '../../../packages/functions/src/scripts/characterLifecycleIntegrationFixtures.js'
import { dispatchAndReloadSheetCommand } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationAssertions.js'
import { proveFixtureLifecycle } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationBuilderProof.js'
import { createSessionHostServer } from '../src/app.js'
import {
  createLiveSessionRoomDependencies,
  type LiveSessionCharacterCommandTiming,
  type LiveSessionEncounterCommandTiming,
  type LiveSessionSceneCommandTiming
} from '../src/dependencies.js'
import { replaySceneEvents } from '@artificer-toolkit/shared/vtt'

import { proveCompactCharacterPostgresSemantics } from './compactCharacterPostgresProof.js'
import { discoverEncounterFeatureActionCapabilities } from '../../../packages/functions/src/services/rules/encounterFeatureActionCapabilityDiscoveryRegistry.js'

process.env.ARTIFICER_DB_QUERY_TRACE ??= '1'

const MESSAGE_TIMEOUT_MS = 15_000
const WARM_COMMAND_P95_LIMIT_MS = 500
const RULE_BOUND_HOST_P95_LIMIT_MS = 250
const SCENE_HOST_P95_LIMIT_MS = 100
const VTT_USAGE_WARMUP_PAIRS = 2
const VTT_USAGE_MEASURED_PAIRS = 10
const runsEncounterTrafficSimulation = process.argv.includes('--encounter-traffic-simulation')
const runsEncounterRoundBenchmark = process.argv.includes('--encounter-round-benchmark')
const runsExpandedEncounterFixture = runsEncounterTrafficSimulation || runsEncounterRoundBenchmark
const ENCOUNTER_TRAFFIC_SIMULATION_ROUNDS = 8
const ENCOUNTER_TRAFFIC_SIMULATION_EVENTS_PER_ACTOR_ROUND = 3
const DIRECT_HOST_LEASE_RELEASE_TIMEOUT_MS = 2_500
const DURABLE_OBJECT_LEASE_RELEASE_TIMEOUT_MS = 45_000
const LOCAL_INTEGRATION_TICKET_SECRET =
  'local-live-session-integration-secret-with-at-least-32-bytes'

interface DisposableUser {
  email: string
  id: string
  password: string
}

interface CommandMeasurement {
  commandId: string
  durationMs: number
  replayed: boolean
  streamVersion: number
}

interface WebSocketTraffic {
  receivedBytes: number
  receivedMessages: number
  sentBytes: number
  sentMessages: number
}

function rawDataByteLength(raw: RawData): number {
  if (Array.isArray(raw)) return raw.reduce((total, part) => total + part.byteLength, 0)
  return raw.byteLength
}

function localSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.')
  }
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
    throw new Error('The local live-session integration gate only runs against local Supabase.')
  }
  return { secretKey, url }
}

function externalSessionHostEndpoint(): string | null {
  const rawEndpoint = process.env.SESSION_HOST_INTEGRATION_ENDPOINT?.trim()
  if (!rawEndpoint) return null
  const endpoint = new URL(rawEndpoint)
  if (
    endpoint.protocol !== 'http:' ||
    (endpoint.hostname !== '127.0.0.1' && endpoint.hostname !== 'localhost')
  ) {
    throw new Error('SESSION_HOST_INTEGRATION_ENDPOINT must be a loopback HTTP endpoint.')
  }
  return endpoint.origin
}

function percentile(values: readonly number[], quantile: number): number {
  assert.ok(values.length > 0)
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * quantile) - 1] as number
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function availablePort(): Promise<number> {
  const server = createNetServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return address.port
}

async function waitForLeaseRelease(
  db: ReturnType<typeof createDb>,
  sessionId: string,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const lease = await db
      .selectFrom('live_session_command_leases')
      .select('session_id')
      .where('session_id', '=', sessionId)
      .executeTakeFirst()
    if (!lease) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.fail('The live-session command authority lease was not released with the room.')
}

async function createDisposableUser(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  runId: string,
  role: 'gm' | 'player',
  suffix = ''
): Promise<DisposableUser> {
  const password = `Local-${randomUUID()}-Aa1!`
  const identitySuffix = suffix ? `-${suffix}` : ''
  const email = `live-session-${role}-${runId}${identitySuffix}@example.test`
  const username = `live${role}${runId.replaceAll('-', '').slice(0, 12)}${suffix}`
  const { data, error } = await admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { username }
  })
  if (error) throw error
  if (!data.user) throw new Error(`Supabase did not create the ${role} integration user.`)
  return { email, id: data.user.id, password }
}

function isRetryableAdmin500(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 500
}

async function deleteDisposableAuthUser(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  db: ReturnType<typeof createDb>,
  userId: string
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let failure: unknown = null
    try {
      const { error } = await admin.deleteUser(userId)
      failure = error
    } catch (error) {
      failure = error
    }
    const result = await sql<{ exists: boolean }>`
      select exists(select 1 from auth.users where id = ${userId}::uuid) as exists
    `.execute(db)
    if (!(result.rows[0]?.exists ?? false)) return
    if (attempt === 0 && isRetryableAdmin500(failure)) {
      await delay(250)
      continue
    }
    throw failure ?? new Error(`Disposable auth user "${userId}" was not deleted.`)
  }
}

class LocalLiveRoom {
  readonly #events = new EventEmitter()
  readonly #pendingCommandIds = new Set<string>()
  readonly #queuedMessages: LiveSessionWebSocketClientMessageDto[] = []
  readonly #ticket: () => Promise<string>
  readonly #url: string
  #closed = false
  #deliverySequence = 0
  #reconnecting = false
  #socket: WebSocket | null = null
  #traffic: WebSocketTraffic = {
    receivedBytes: 0,
    receivedMessages: 0,
    sentBytes: 0,
    sentMessages: 0
  }
  lastReady: Extract<LiveSessionWebSocketServerMessageDto, { type: 'READY' }> | null = null
  readonly roomId: string
  readonly state = {
    aggregateVersions: new Map<string, { version: number }>()
  }

  constructor(endpoint: string, ticket: () => Promise<string>, options: LiveSessionJoinOptionsDto) {
    this.roomId = `${options.campaignId}:${options.sessionId}`
    this.#ticket = ticket
    this.#url = `${endpoint.replace(/^http/, 'ws')}${LIVE_SESSION_PATH_PREFIX}/${options.sessionId}`
  }

  async connect(): Promise<void> {
    const ready = this.#waitFor('READY')
    try {
      await this.#open(false)
      await ready
    } catch (error) {
      this.#closed = true
      this.#socket?.close()
      throw error
    }
  }

  onMessage(type: LiveSessionWebSocketServerMessageDto['type'], listener: (raw: unknown) => void) {
    this.#events.on(type, listener)
    return () => this.#events.off(type, listener)
  }

  send(command: LiveSessionCommandDto): void {
    this.#pendingCommandIds.add(command.command.commandId)
    this.#sendOrQueue({ command, type: 'COMMAND' })
  }

  resetTraffic(): void {
    this.#traffic = { receivedBytes: 0, receivedMessages: 0, sentBytes: 0, sentMessages: 0 }
  }

  traffic(): WebSocketTraffic {
    return { ...this.#traffic }
  }

  simulateDrop(): void {
    this.#socket?.terminate()
  }

  waitForDrop(): Promise<void> {
    return new Promise((resolve) => this.#events.once('drop', () => resolve()))
  }

  waitForReconnect(): Promise<void> {
    return new Promise((resolve) => this.#events.once('reconnect', () => resolve()))
  }

  async leave(): Promise<void> {
    this.#closed = true
    const socket = this.#socket
    if (!socket || socket.readyState === WebSocket.CLOSED) return
    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve())
      socket.close(1000, 'Client left.')
    })
  }

  refreshAuthorityAndStopReconnect(): void {
    const socket = this.#socket
    if (socket?.readyState !== WebSocket.OPEN) {
      throw new Error('The live-session socket is not open for authority refresh.')
    }
    this.#closed = true
    socket.send(
      JSON.stringify({
        lastSeenDeliverySequence: this.#deliverySequence,
        pendingCommandIds: [...this.#pendingCommandIds],
        type: 'RESUME'
      } satisfies LiveSessionWebSocketClientMessageDto)
    )
  }

  async #open(reconnecting: boolean): Promise<void> {
    const ticket = await this.#ticket()
    if (this.#closed) return
    const socket = new WebSocket(
      this.#url,
      [LIVE_SESSION_WEBSOCKET_PROTOCOL, `${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket}`],
      {
        headers: { Origin: 'http://127.0.0.1:3000' }
      }
    )
    this.#socket = socket
    socket.on('message', (raw, binary) => this.#receive(raw, binary))
    socket.once('close', () => {
      if (this.#socket === socket) this.#socket = null
      this.#events.emit('drop')
      if (!this.#closed) {
        setTimeout(() => void this.#open(true), 20)
      }
    })
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    if (reconnecting) {
      this.#reconnecting = true
      socket.send(
        JSON.stringify({
          lastSeenDeliverySequence: this.#deliverySequence,
          pendingCommandIds: [...this.#pendingCommandIds],
          type: 'RESUME'
        } satisfies LiveSessionWebSocketClientMessageDto)
      )
    }
  }

  #receive(raw: RawData, binary: boolean): void {
    if (binary) throw new Error('The local integration received a binary WebSocket message.')
    this.#traffic.receivedBytes += rawDataByteLength(raw)
    this.#traffic.receivedMessages += 1
    const message = liveSessionWebSocketServerMessageDtoSchema.parse(
      JSON.parse(raw.toString()) as unknown
    )
    if (message.type === 'READY') {
      this.lastReady = message
      this.state.aggregateVersions.clear()
      for (const version of message.aggregateVersions) {
        this.state.aggregateVersions.set(`${version.aggregateKind}:${version.aggregateId}`, {
          version: version.version
        })
      }
      this.#deliverySequence = message.deliverySequence
      this.#events.emit(message.type, message)
      if (this.#reconnecting) {
        this.#reconnecting = false
        this.#events.emit('reconnect')
      }
      while (this.#queuedMessages.length > 0) {
        const queued = this.#queuedMessages.shift()
        if (queued) this.#sendOrQueue(queued)
      }
      return
    }
    if (message.type === 'COMMAND_COMMITTED') {
      this.#deliverySequence = Math.max(this.#deliverySequence, message.deliverySequence)
      this.#pendingCommandIds.delete(message.originCommandId)
      this.state.aggregateVersions.set(`${message.aggregateKind}:${message.aggregateId}`, message)
    } else if (message.type === 'COMMAND_REJECTED' && message.commandId) {
      this.#pendingCommandIds.delete(message.commandId)
    }
    this.#events.emit(message.type, message)
  }

  #sendOrQueue(message: LiveSessionWebSocketClientMessageDto): void {
    if (this.#socket?.readyState === WebSocket.OPEN && !this.#reconnecting) {
      const serialized = JSON.stringify(message)
      this.#traffic.sentBytes += Buffer.byteLength(serialized)
      this.#traffic.sentMessages += 1
      this.#socket.send(serialized)
      return
    }
    if (message.type !== 'RESUME') this.#queuedMessages.push(message)
  }

  #waitFor(type: LiveSessionWebSocketServerMessageDto['type']): Promise<void> {
    return new Promise((resolve, reject) => {
      const listener = () => {
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(() => {
        this.#events.off(type, listener)
        reject(new Error(`Timed out waiting for live-session message "${type}".`))
      }, MESSAGE_TIMEOUT_MS)
      this.#events.once(type, listener)
    })
  }
}

async function joinLiveRoom(
  endpoint: string,
  ticket: () => Promise<string>,
  options: LiveSessionJoinOptionsDto
) {
  const room = new LocalLiveRoom(endpoint, ticket, options)
  const startedAt = performance.now()
  await room.connect()
  return { durationMs: performance.now() - startedAt, room }
}

type LiveSessionMessageOf<TType extends LiveSessionWebSocketServerMessageDto['type']> = Extract<
  LiveSessionWebSocketServerMessageDto,
  { type: TType }
>
type LiveSessionCommandOutcome =
  | Extract<LiveSessionMessageOf<'COMMAND_COMMITTED'>, { aggregateKind: 'CHARACTER' }>
  | Extract<LiveSessionMessageOf<'COMMAND_COMMITTED'>, { aggregateKind: 'ENCOUNTER' }>
  | Extract<LiveSessionMessageOf<'COMMAND_COMMITTED'>, { aggregateKind: 'SESSION' }>
type LiveSessionSceneCommandOutcome = Extract<
  LiveSessionMessageOf<'COMMAND_COMMITTED'>,
  { aggregateKind: 'SCENE' }
>

function waitForMessage<TType extends LiveSessionWebSocketServerMessageDto['type']>(
  room: LocalLiveRoom,
  type: TType,
  predicate: (message: LiveSessionMessageOf<TType>) => boolean = () => true
): Promise<LiveSessionMessageOf<TType>> {
  return new Promise((resolve, reject) => {
    let unsubscribe: () => void = () => undefined
    const timer = setTimeout(() => {
      unsubscribe()
      reject(new Error(`Timed out waiting for live-session message "${type}".`))
    }, MESSAGE_TIMEOUT_MS)
    unsubscribe = room.onMessage(type, (raw: unknown) => {
      const parsed = liveSessionWebSocketServerMessageDtoSchema.safeParse(raw)
      if (!parsed.success || parsed.data.type !== type) {
        clearTimeout(timer)
        unsubscribe()
        reject(parsed.success ? new Error('Received the wrong message type.') : parsed.error)
        return
      }
      const message = parsed.data as LiveSessionMessageOf<TType>
      if (!predicate(message)) return
      clearTimeout(timer)
      unsubscribe()
      resolve(message)
    })
  })
}

function waitForCommandOutcome(
  room: LocalLiveRoom,
  commandId: string,
  options: { allowNullResponse?: boolean } = {}
): Promise<LiveSessionCommandOutcome> {
  return new Promise((resolve, reject) => {
    let unsubscribeResult: () => void = () => undefined
    let unsubscribeRejected: () => void = () => undefined
    const cleanup = () => {
      clearTimeout(timer)
      unsubscribeResult()
      unsubscribeRejected()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for command "${commandId}".`))
    }, MESSAGE_TIMEOUT_MS)
    unsubscribeResult = room.onMessage('COMMAND_COMMITTED', (raw: unknown) => {
      const parsed = liveSessionWebSocketServerMessageDtoSchema.safeParse(raw)
      if (!parsed.success || parsed.data.type !== 'COMMAND_COMMITTED') {
        cleanup()
        reject(parsed.success ? new Error('Received the wrong message type.') : parsed.error)
        return
      }
      if (
        parsed.data.aggregateKind === 'SCENE' ||
        parsed.data.originCommandId !== commandId ||
        (parsed.data.response === null && !options.allowNullResponse)
      ) {
        return
      }
      cleanup()
      resolve(parsed.data)
    })
    unsubscribeRejected = room.onMessage('COMMAND_REJECTED', (raw: unknown) => {
      const parsed = liveSessionWebSocketServerMessageDtoSchema.safeParse(raw)
      if (!parsed.success || parsed.data.type !== 'COMMAND_REJECTED') {
        cleanup()
        reject(parsed.success ? new Error('Received the wrong message type.') : parsed.error)
        return
      }
      if (parsed.data.commandId !== commandId) return
      cleanup()
      reject(new Error(`${parsed.data.code}: ${parsed.data.message}`))
    })
  })
}

function waitForSceneCommandOutcome(
  room: LocalLiveRoom,
  commandId: string
): Promise<LiveSessionSceneCommandOutcome> {
  return new Promise((resolve, reject) => {
    let unsubscribeResult: () => void = () => undefined
    let unsubscribeRejected: () => void = () => undefined
    const cleanup = () => {
      clearTimeout(timer)
      unsubscribeResult()
      unsubscribeRejected()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for Scene command "${commandId}".`))
    }, MESSAGE_TIMEOUT_MS)
    unsubscribeResult = room.onMessage('COMMAND_COMMITTED', (raw: unknown) => {
      const parsed = liveSessionWebSocketServerMessageDtoSchema.safeParse(raw)
      if (!parsed.success || parsed.data.type !== 'COMMAND_COMMITTED') {
        cleanup()
        reject(parsed.success ? new Error('Received the wrong message type.') : parsed.error)
        return
      }
      if (parsed.data.aggregateKind !== 'SCENE' || parsed.data.originCommandId !== commandId) return
      cleanup()
      resolve(parsed.data)
    })
    unsubscribeRejected = room.onMessage('COMMAND_REJECTED', (raw: unknown) => {
      const parsed = liveSessionWebSocketServerMessageDtoSchema.safeParse(raw)
      if (!parsed.success || parsed.data.type !== 'COMMAND_REJECTED') {
        cleanup()
        reject(parsed.success ? new Error('Received the wrong message type.') : parsed.error)
        return
      }
      if (parsed.data.commandId !== commandId) return
      cleanup()
      reject(new Error(`${parsed.data.code}: ${parsed.data.message}`))
    })
  })
}

async function waitForAggregateVersion(
  room: LocalLiveRoom,
  aggregateKey: string,
  version: number
): Promise<void> {
  const deadline = Date.now() + MESSAGE_TIMEOUT_MS
  while (room.state.aggregateVersions.get(aggregateKey)?.version !== version) {
    if (Date.now() >= deadline) {
      throw new Error(`State did not reach ${aggregateKey} version ${version}.`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function sendCharacterCommand(
  room: LocalLiveRoom,
  witnesses: readonly LocalLiveRoom[],
  characterId: string,
  command: Extract<LiveSessionCommandDto, { aggregateKind: 'CHARACTER' }>['command'],
  expectCommit: boolean
): Promise<CommandMeasurement> {
  const isCompactCharacterCommand =
    command.type === 'ADJUST_HIT_POINTS' ||
    (command.type === 'UPSERT_SHEET_ADJUSTMENT' &&
      command.adjustment.family === 'HIT_POINTS' &&
      command.adjustment.field === 'MAXIMUM_MODIFIER' &&
      typeof command.adjustment.value === 'number')
  const outcome = waitForCommandOutcome(room, command.commandId, {
    allowNullResponse: isCompactCharacterCommand
  })
  const committed = expectCommit
    ? Promise.all(
        [room, ...witnesses].map((target) =>
          waitForMessage(
            target,
            'COMMAND_COMMITTED',
            (message) => message.originCommandId === command.commandId
          )
        )
      )
    : null
  const startedAt = performance.now()
  room.send({
    aggregateKind: 'CHARACTER',
    characterId,
    command
  } satisfies LiveSessionCommandDto)
  const [result] = await Promise.all([outcome, committed ?? Promise.resolve([])])
  assert.equal(result.aggregateKind, 'CHARACTER')
  if (isCompactCharacterCommand) {
    assert.equal(result.response, null)
  } else {
    assert.ok(result.response)
  }
  return {
    commandId: command.commandId,
    durationMs: performance.now() - startedAt,
    replayed: result.replayed,
    streamVersion: result.response === null ? result.version : result.response.streamVersion
  }
}

async function sendEncounterCommand(
  room: LocalLiveRoom,
  witnesses: readonly LocalLiveRoom[],
  command: Extract<LiveSessionCommandDto, { aggregateKind: 'ENCOUNTER' }>['command']
): Promise<CommandMeasurement> {
  const outcome = waitForCommandOutcome(room, command.commandId)
  const committed = Promise.all(
    [room, ...witnesses].map((target) =>
      waitForMessage(
        target,
        'COMMAND_COMMITTED',
        (message) => message.originCommandId === command.commandId
      )
    )
  )
  const startedAt = performance.now()
  room.send({
    aggregateKind: 'ENCOUNTER',
    command
  } satisfies LiveSessionCommandDto)
  const result = await outcome
  await committed
  assert.equal(result.aggregateKind, 'ENCOUNTER')
  assert.ok(result.response)
  return {
    commandId: command.commandId,
    durationMs: performance.now() - startedAt,
    replayed: result.replayed,
    streamVersion: result.version
  }
}

async function sendSessionCommand(
  room: LocalLiveRoom,
  witnesses: readonly LocalLiveRoom[],
  command: Extract<LiveSessionCommandDto, { aggregateKind: 'SESSION' }>['command']
): Promise<
  CommandMeasurement & {
    outcome: Extract<LiveSessionCommandOutcome, { aggregateKind: 'SESSION' }>
  }
> {
  const outcome = waitForCommandOutcome(room, command.commandId)
  const committed = Promise.all(
    [room, ...witnesses].map((target) =>
      waitForMessage(
        target,
        'COMMAND_COMMITTED',
        (message) => message.originCommandId === command.commandId
      )
    )
  )
  const startedAt = performance.now()
  room.send({ aggregateKind: 'SESSION', command } satisfies LiveSessionCommandDto)
  const result = await outcome
  await committed
  assert.equal(result.aggregateKind, 'SESSION')
  assert.ok(result.response)
  return {
    commandId: command.commandId,
    durationMs: performance.now() - startedAt,
    outcome: result,
    replayed: result.replayed,
    streamVersion: result.version
  }
}

async function sendSceneCommand(
  room: LocalLiveRoom,
  witnesses: readonly LocalLiveRoom[],
  command: Extract<LiveSessionCommandDto, { aggregateKind: 'SCENE' }>['command'],
  expectCommit = true
): Promise<CommandMeasurement & { snapshot: LiveSessionSceneCommandOutcome['snapshot'] }> {
  const outcome = waitForSceneCommandOutcome(room, command.commandId)
  const committed = expectCommit
    ? Promise.all(
        [room, ...witnesses].map((target) =>
          waitForMessage(
            target,
            'COMMAND_COMMITTED',
            (message) => message.originCommandId === command.commandId
          )
        )
      )
    : null
  const startedAt = performance.now()
  room.send({
    aggregateKind: 'SCENE',
    command
  } satisfies LiveSessionCommandDto)
  let result: LiveSessionSceneCommandOutcome
  try {
    ;[result] = await Promise.all([outcome, committed ?? Promise.resolve([])])
  } catch (error) {
    const versionContext = {
      expectedSceneVersion: command.expectedSceneVersion,
      ...(command.type === 'MOVE_SCENE_TOKEN'
        ? { expectedEncounterVersion: command.expectedEncounterVersion }
        : {})
    }
    throw new Error(
      `Scene command ${command.type} (${command.commandId}) failed with ${JSON.stringify(versionContext)}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
  assert.equal(result.aggregateKind, 'SCENE')
  return {
    commandId: command.commandId,
    durationMs: performance.now() - startedAt,
    replayed: result.replayed,
    snapshot: result.snapshot,
    streamVersion: result.version
  }
}

async function main(): Promise<void> {
  const connectionString = requireLocalDatabaseUrl()
  const { secretKey, url } = localSupabaseConfig()
  const db = createDb({ connectionString })
  const admin = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  })
  const runId = randomUUID()
  const characterId = randomUUID()
  const playerBCharacterId = randomUUID()
  const additionalCharacterIds = Array.from(
    { length: runsEncounterTrafficSimulation ? 3 : runsEncounterRoundBenchmark ? 1 : 0 },
    () => randomUUID()
  )
  const mapAssetId = randomUUID()
  const mapOverviewObjectKey = `integration/${runId}/map-display.png`
  const mapTileObjectKey = `integration/${runId}/map-tile-0-0.png`
  const mapObjectKeys = [mapOverviewObjectKey, mapTileObjectKey]
  let campaignId: string | null = null
  let encounterBlueprintId: string | null = null
  let gm: DisposableUser | null = null
  let outsider: DisposableUser | null = null
  let player: DisposableUser | null = null
  let players: DisposableUser[] = []
  let sessionHost: ReturnType<typeof createSessionHostServer> | null = null
  let playerRooms: LocalLiveRoom[] = []
  let playerRoom: LocalLiveRoom | null = null
  let gmRoom: LocalLiveRoom | null = null
  let runError: unknown
  let cleanupError: unknown
  let campaignDeleted = false
  const captureCleanup = async (operation: () => Promise<unknown>) => {
    try {
      await operation()
    } catch (error) {
      cleanupError ??= error
    }
  }

  try {
    gm = await createDisposableUser(admin.auth.admin, runId, 'gm')
    outsider = await createDisposableUser(admin.auth.admin, runId, 'player', 'outsider')
    for (let index = 0; index < (runsEncounterRoundBenchmark ? 3 : 5); index += 1) {
      players.push(await createDisposableUser(admin.auth.admin, runId, 'player', `${index + 1}`))
    }
    player = players[0] ?? null
    assert.ok(player)
    const playerB = players[1]
    assert.ok(playerB)
    const gmUser = gm
    const catalog = await findFixtureCatalog(db)
    const fixture: CharacterLifecycleFixture = {
      ...catalog,
      userId: player.id,
      characterId,
      classes: runsEncounterRoundBenchmark
        ? [{ classId: catalog.fighterId, classLabel: 'Fighter', classLevel: 1 }]
        : [
            {
              classId: catalog.clericId,
              classLabel: 'Cleric',
              classLevel: 1,
              subclassId: catalog.lifeDomainId,
              subclassLabel: 'Life Domain'
            }
          ],
      expectedMaxHitPoints: runsEncounterRoundBenchmark ? 12 : 9,
      hitpointLevels: runsEncounterRoundBenchmark
        ? [{ level: 1, classId: catalog.fighterId, classLevel: 1, value: 12 }]
        : [{ level: 1, classId: catalog.clericId, classLevel: 1, value: 9 }],
      label: `Local Live Session ${runId}`,
      ...(runsEncounterRoundBenchmark ? {} : { preparedCasterClassId: catalog.clericId }),
      raceId: runsEncounterRoundBenchmark ? catalog.humanId : catalog.dragonbornId,
      raceLabel: runsEncounterRoundBenchmark ? 'Human' : 'Dragonborn'
    }
    const builderTimings: BuilderResolutionTiming[] = []
    const sheetTimings: SheetReadTiming[] = []
    const ruleTimings: CharacterRuleEvaluationTiming[] = []
    const commandTimings: LiveSessionCharacterCommandTiming[] = []
    const encounterCommandTimings: LiveSessionEncounterCommandTiming[] = []
    const sceneCommandTimings: LiveSessionSceneCommandTiming[] = []
    const initialSheet = await proveFixtureLifecycle(
      db,
      fixture,
      builderTimings,
      sheetTimings,
      ruleTimings
    )
    assert.equal(initialSheet.meta.streamVersion, 1)
    const playerBInitialSheet = await proveFixtureLifecycle(
      db,
      {
        ...fixture,
        characterId: playerBCharacterId,
        label: `Local Live Session Player B ${runId}`,
        userId: playerB.id
      },
      builderTimings,
      sheetTimings,
      ruleTimings
    )
    assert.equal(playerBInitialSheet.meta.streamVersion, 1)
    const characterSheets = new Map<string, typeof initialSheet>([
      [characterId, initialSheet],
      [playerBCharacterId, playerBInitialSheet]
    ])
    if (runsExpandedEncounterFixture) {
      for (const [index, additionalCharacterId] of additionalCharacterIds.entries()) {
        const currentPlayer = players[index + 2]
        assert.ok(currentPlayer)
        const sheet = await proveFixtureLifecycle(
          db,
          {
            ...fixture,
            characterId: additionalCharacterId,
            label: `Local Live Session Player ${index + 3} ${runId}`,
            userId: currentPlayer.id
          },
          builderTimings,
          sheetTimings,
          ruleTimings
        )
        assert.equal(sheet.meta.streamVersion, 1)
        characterSheets.set(additionalCharacterId, sheet)
      }
    }
    if (runsEncounterRoundBenchmark) {
      const benchmarkWeapon = srdBaselineContent.subjects.equipment.find(
        ({ label }) => label === 'Light Crossbow'
      )
      assert.ok(benchmarkWeapon)
      for (const [index, benchmarkCharacterId] of [
        characterId,
        playerBCharacterId,
        ...additionalCharacterIds
      ].entries()) {
        const owner = players[index]
        let sheet = characterSheets.get(benchmarkCharacterId)
        assert.ok(owner && sheet)
        const mechanics = await createCharacterMechanicsProjectionRepository(db).requireCurrent({
          characterId: benchmarkCharacterId,
          expectedStreamVersion: sheet.meta.streamVersion
        })
        const actionCandidate = mechanics.rulePolicyInput.actionCandidates.find(
          (candidate) => candidate.equipment?.equipmentId === benchmarkWeapon.id
        )
        assert.ok(actionCandidate?.equipment)
        if (!actionCandidate.equipment.equipped) {
          sheet = await dispatchAndReloadSheetCommand(
            db,
            {
              ...fixture,
              characterId: benchmarkCharacterId,
              label: `Local benchmark Character ${index + 1} ${runId}`,
              userId: owner.id
            },
            sheet,
            {
              type: 'EQUIP_ITEM',
              itemId: actionCandidate.equipment.itemInstanceId
            }
          )
          characterSheets.set(benchmarkCharacterId, sheet)
        }
      }
    }

    const campaign = await createCampaign(db, gm.id, {
      name: `Local live-session integration ${runId}`,
      format: 'ONE_SHOT',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: fixture.systemId,
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301'
    })
    campaignId = campaign.id
    if (runsEncounterRoundBenchmark) {
      const currentSettings = await getCampaignPlaySettings(db, gm.id, campaign.id)
      const {
        campaignId: _campaignId,
        updatedAt: _updatedAt,
        version: settingsVersion,
        ...settings
      } = currentSettings
      await saveCampaignPlaySettings(db, gm.id, {
        ...settings,
        automationMode: 'AUTOMATIC',
        campaignId: campaign.id,
        expectedVersion: settingsVersion
      })
    }
    const media = createMediaRepository(db)
    await media.createPending({
      declaredBytes: 1_024,
      declaredMimeType: 'image/png',
      id: mapAssetId,
      idempotencyKey: randomUUID(),
      originalFileName: 'local-vtt-map.png',
      ownerUserId: gm.id,
      profile: 'VTT_MAP',
      rawObjectKey: `integration/${runId}/map-original.png`,
      storageProvider: 'SUPABASE',
      targetKey: `VTT_MAP:${campaign.id}`
    })
    assert.ok(await media.claimForProcessing(mapAssetId, gm.id))
    assert.equal(
      await media.replaceReady({
        assetId: mapAssetId,
        height: 1_000,
        ownerUserId: gm.id,
        quotaBytes: 100_000_000,
        reservationBytes: 26_214_400,
        variants: [
          {
            byte_size: 512,
            height: 1_000,
            id: randomUUID(),
            kind: 'DISPLAY',
            mime_type: 'image/png',
            object_key: mapOverviewObjectKey,
            width: 1_000
          }
        ],
        verifiedBytes: 1_024,
        verifiedMimeType: 'image/png',
        vttMapTiles: [
          {
            byte_size: 512,
            column_index: 0,
            height: 1_000,
            object_key: mapTileObjectKey,
            row_index: 0,
            width: 1_000
          }
        ],
        width: 1_000
      }),
      true
    )
    const mapPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+S4uR7wAAAABJRU5ErkJggg==',
      'base64'
    )
    for (const objectKey of mapObjectKeys) {
      const { error } = await admin.storage.from('media').upload(objectKey, mapPng, {
        contentType: 'image/png',
        upsert: true
      })
      if (error) throw error
    }
    for (const currentPlayer of players) {
      await createCampaignRepository(db).activatePlayerMembership(
        campaign.id,
        currentPlayer.id,
        new Date().toISOString()
      )
    }
    await assignCampaignCharacter(db, gm.id, campaign.id, characterId)
    await assignCampaignCharacter(db, gm.id, campaign.id, playerBCharacterId)
    if (runsExpandedEncounterFixture) {
      for (const additionalCharacterId of additionalCharacterIds) {
        await assignCampaignCharacter(db, gm.id, campaign.id, additionalCharacterId)
      }
    }
    const session = await createCampaignSession(
      db,
      { campaignId: campaign.id, title: 'Local integration session' },
      gm.id
    )
    const encounterCreature = runsEncounterRoundBenchmark
      ? srdBaselineContent.subjects.creatures.find((creature) => creature.label === 'Goblin')
      : srdBaselineContent.subjects.creatures.find((creature) =>
          (creature.features ?? []).some(
            (feature) =>
              feature.charges?.limitKind === 'FIXED_AMOUNT' &&
              feature.charges.scalingKind === 'NONE' &&
              feature.charges.amount > 0
          )
        )
    assert.ok(encounterCreature, 'The required SRD Creature fixture is unavailable.')
    const encounterBlueprint = await createEncounterBlueprint(db, gm.id, {
      gameSystemId: encounterCreature.systemId,
      name: `Local encounter ${runId}`,
      enemies: Array.from(
        { length: runsEncounterTrafficSimulation ? 6 : runsEncounterRoundBenchmark ? 4 : 1 },
        () => ({
          kind: 'CREATURE' as const,
          sourceId: encounterCreature.id
        })
      ),
      commandId: randomUUID()
    })
    encounterBlueprintId = encounterBlueprint.id
    const encounter = await createEncounter(db, gm.id, {
      campaignId: campaign.id,
      sessionId: session.id,
      blueprintId: encounterBlueprint.id,
      commandId: randomUUID()
    })
    const encounterActor = encounter.actors.find((actor) => actor.sourceId === encounterCreature.id)
    const encounterFeature = encounterActor?.features.find(
      (feature) => feature.resource !== null && feature.resource.remaining > 0
    )
    assert.ok(encounterActor)
    if (runsEncounterTrafficSimulation) assert.equal(encounter.actors.length, 11)
    if (runsEncounterRoundBenchmark) assert.equal(encounter.actors.length, 7)
    const benchmarkTokenIds = new Map(
      encounter.actors.map((actor) => [actor.id, randomUUID()] as const)
    )
    const sceneTokenId = randomUUID()
    const hiddenTokenId = randomUUID()
    const doorId = randomUUID()
    const annotationId = randomUUID()
    const sceneDefinition = await createCampaignSceneDefinition(db, gm.id, {
      annotations: [
        {
          id: annotationId,
          position: { x: 20, y: 20 },
          text: 'GM-only trap note',
          visibility: 'GM_ONLY'
        }
      ],
      barriers: [
        {
          a: { x: 50, y: 0 },
          b: { x: 50, y: 100 },
          blocksLightWhenClosed: true,
          blocksMovementWhenClosed: true,
          id: doorId,
          initialState: 'CLOSED',
          kind: 'DOOR',
          openAngleDegrees: 90
        }
      ],
      ambientIllumination: 'BRIGHT',
      campaignId: campaign.id,
      darknessZones: [],
      fogMode: 'SHARED_PARTY',
      grid: {
        cellSize: 50,
        diagonalPolicy: 'EQUAL',
        distancePerCell: 5,
        kind: 'SQUARE',
        origin: { x: 0, y: 0 },
        unit: 'FEET'
      },
      lights: [],
      map: {
        assetId: mapAssetId,
        height: 1_000,
        tileManifestAssetId: null,
        width: 1_000
      },
      name: 'Local live Scene integration',
      tokens: runsEncounterRoundBenchmark
        ? encounter.actors.map((actor, index) => {
            const peerIndex = encounter.actors
              .filter((candidate) => candidate.kind === actor.kind)
              .findIndex((candidate) => candidate.id === actor.id)
            return {
              assetId: null,
              controlledByUserIds: [],
              height: 50,
              hidden: false,
              id: benchmarkTokenIds.get(actor.id)!,
              label: `Benchmark actor ${index + 1}`,
              locked: false,
              position: {
                x: 120 + Math.floor(peerIndex / (actor.kind === 'CHARACTER' ? 1 : 2)) * 150,
                y: actor.kind === 'CHARACTER' ? 20 : 70 + (peerIndex % 2) * 50
              },
              rotationDegrees: 0,
              vision: null,
              width: 50
            }
          })
        : [
            {
              assetId: null,
              controlledByUserIds: [player.id],
              height: 1,
              hidden: false,
              id: sceneTokenId,
              label: 'Player token',
              locked: false,
              position: { x: 20, y: 20 },
              rotationDegrees: 0,
              vision: null,
              width: 1
            },
            {
              assetId: null,
              controlledByUserIds: [],
              height: 1,
              hidden: true,
              id: hiddenTokenId,
              label: 'Hidden GM token',
              locked: false,
              position: { x: 80, y: 20 },
              rotationDegrees: 0,
              vision: null,
              width: 1
            }
          ],
      visionRevealMode: 'ON_DRAG'
    })
    const liveScene = (await createVttSceneRepository(db).listLiveScenes(campaign.id)).find(
      (candidate) => candidate.state.definitionId === sceneDefinition.id
    )
    assert.ok(liveScene, 'Creating a Campaign Scene definition must materialize its live Scene.')
    const options = { campaignId: campaign.id, sessionId: session.id }
    const externalEndpoint = externalSessionHostEndpoint()
    const ticketSecret =
      process.env.LIVE_SESSION_TICKET_SECRET?.trim() ||
      (externalEndpoint ? null : LOCAL_INTEGRATION_TICKET_SECRET)
    if (!ticketSecret) {
      throw new Error(
        'LIVE_SESSION_TICKET_SECRET is required when testing an external session host.'
      )
    }
    if (!externalEndpoint) {
      const admissionDependencies = createLiveSessionRoomDependencies({ ticketSecret })
      try {
        const firstPlayerSnapshot = await admissionDependencies.loadSnapshot(player.id, options)
        const expectedCharacterIds = runsEncounterRoundBenchmark
          ? [...characterSheets.keys()]
          : [characterId, playerBCharacterId]
        for (const aggregateId of expectedCharacterIds) {
          const expectedSheet = characterSheets.get(aggregateId)
          assert.ok(expectedSheet)
          assert.ok(
            firstPlayerSnapshot.aggregateVersions.some(
              (version) =>
                version.aggregateKind === 'CHARACTER' &&
                version.aggregateId === aggregateId &&
                version.version === expectedSheet.meta.streamVersion
            ),
            `Player A did not hydrate present Character ${aggregateId}.`
          )
        }
      } finally {
        await admissionDependencies.dispose?.()
      }
    }
    const playerTickets = players.map(
      (currentPlayer) => () =>
        withUserContext(db, currentPlayer.id, (scopedDb) =>
          issueLiveSessionTicket(scopedDb, currentPlayer.id, options, ticketSecret)
        ).then(({ ticket }) => ticket)
    )
    const gmTicket = () =>
      withUserContext(db, gmUser.id, (scopedDb) =>
        issueLiveSessionTicket(scopedDb, gmUser.id, options, ticketSecret)
      ).then(({ ticket }) => ticket)

    let endpoint: string
    let externalDurableObject = false
    if (externalEndpoint) {
      endpoint = externalEndpoint
    } else {
      const port = await availablePort()
      const localDependencies = createLiveSessionRoomDependencies({
        ticketSecret,
        onCharacterCommandTiming: (timing) => commandTimings.push(timing),
        onEncounterCommandTiming: (timing) => encounterCommandTimings.push(timing),
        onSceneCommandTiming: (timing) => sceneCommandTimings.push(timing)
      })
      const executeLocalCommand = localDependencies.execute
      sessionHost = createSessionHostServer(
        {
          ...localDependencies,
          execute: async (...args) => {
            try {
              return await executeLocalCommand(...args)
            } catch (error) {
              const command = args[2]
              const detail =
                error instanceof Error ? `${error.name}: ${error.message}` : String(error)
              process.stderr.write(
                `Local ${command.aggregateKind} command ${command.command.type} (${command.command.commandId}) failed: ${detail}\n`
              )
              throw error
            }
          }
        },
        { ticketSecret }
      )
      await sessionHost.listen(port)
      endpoint = `http://127.0.0.1:${port}`
    }
    const health = await fetch(`${endpoint}/health`)
    assert.equal(health.status, 200)
    const healthBody = await health.json()
    if (externalEndpoint && JSON.stringify(healthBody) === JSON.stringify({ ok: true })) {
      externalDurableObject = true
    } else {
      assert.deepEqual(healthBody, {
        service: 'artificer-session-host',
        status: 'ok'
      })
    }
    const enforcesDirectHostLatencyBudgets = !externalDurableObject

    const playerJoins: Array<Awaited<ReturnType<typeof joinLiveRoom>>> = []
    const firstTicket = playerTickets[0]
    assert.ok(firstTicket)
    const firstJoin = await joinLiveRoom(endpoint, firstTicket, options)
    playerJoins.push(firstJoin)
    playerRooms.push(firstJoin.room)
    playerRoom = firstJoin.room
    const playerBCharacterAggregateKey = `CHARACTER:${playerBCharacterId}`
    const expectedCharacterVersions = runsEncounterRoundBenchmark
      ? [...characterSheets.entries()].map(([id, sheet]) => ({
          aggregateKey: `CHARACTER:${id}`,
          id,
          version: sheet.meta.streamVersion
        }))
      : [
          { aggregateKey: `CHARACTER:${characterId}`, id: characterId, version: 1 },
          { aggregateKey: playerBCharacterAggregateKey, id: playerBCharacterId, version: 1 }
        ]
    await Promise.all(
      expectedCharacterVersions.map(({ aggregateKey, version }) =>
        waitForAggregateVersion(playerRoom!, aggregateKey, version)
      )
    )
    const firstReady = playerRoom.lastReady
    assert.ok(firstReady)
    assert.ok(
      firstReady.aggregateVersions.some(
        (version) =>
          version.aggregateKind === 'CHARACTER' &&
          version.aggregateId === playerBCharacterId &&
          version.version === characterSheets.get(playerBCharacterId)?.meta.streamVersion
      )
    )
    for (const ticket of playerTickets.slice(1)) {
      const join = await joinLiveRoom(endpoint, ticket, options)
      playerJoins.push(join)
      playerRooms.push(join.room)
    }
    const playerJoin = playerJoins[0]
    const gmJoin = await joinLiveRoom(endpoint, gmTicket, options)
    gmRoom = gmJoin.room
    assert.equal(playerRoom.roomId, gmRoom.roomId)
    const aggregateKey = `CHARACTER:${characterId}`
    const encounterAggregateKey = `ENCOUNTER:${encounter.id}`
    await Promise.all([
      ...playerRooms.flatMap((room) => [
        ...expectedCharacterVersions.map(({ aggregateKey: key, version }) =>
          waitForAggregateVersion(room, key, version)
        ),
        waitForAggregateVersion(room, encounterAggregateKey, encounter.version)
      ]),
      ...expectedCharacterVersions.map(({ aggregateKey: key, version }) =>
        waitForAggregateVersion(gmRoom!, key, version)
      ),
      waitForAggregateVersion(gmRoom, encounterAggregateKey, encounter.version)
    ])
    const characterWitnesses = [...playerRooms.slice(1), gmRoom]
    const playerBRoom = playerRooms[1]
    assert.ok(playerBRoom)
    const scenePresentationCommand = {
      commandId: randomUUID(),
      expectedPresentationVersion: null,
      sceneId: liveScene.state.id,
      sessionId: session.id,
      type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION' as const
    }
    const scenePresentationBroadcasts = [gmRoom, ...playerRooms].map((room) =>
      waitForMessage(
        room,
        'COMMAND_COMMITTED',
        (message) => message.originCommandId === scenePresentationCommand.commandId
      )
    )
    const scenePresentation = await sendSessionCommand(
      gmRoom,
      playerRooms,
      scenePresentationCommand
    )
    const scenePresentationMessages = await Promise.all(scenePresentationBroadcasts)
    assert.equal(scenePresentation.replayed, false)
    const sceneId = liveScene.state.id
    assert.equal(scenePresentation.streamVersion, 0)
    const sceneBinding = await sendEncounterCommand(gmRoom, playerRooms, {
      commandId: randomUUID(),
      encounterId: encounter.id,
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE'
    })
    assert.equal(sceneBinding.replayed, false)
    if (runsEncounterRoundBenchmark) {
      const characterActors = encounter.actors.filter((actor) => actor.kind === 'CHARACTER')
      const enemyActors = encounter.actors.filter((actor) => actor.kind === 'CREATURE')
      assert.equal(characterActors.length, 3)
      assert.equal(enemyActors.length, 4)
      const actorOrder = [...characterActors, ...enemyActors]
      const actionIds = new Map<string, string>()
      for (const actor of characterActors) {
        assert.ok(actor.sourceId)
        const sheet = characterSheets.get(actor.sourceId)
        assert.ok(sheet, `Missing finalized Character sheet for actor ${actor.id}.`)
        const action = sheet.actions.items.find(
          (candidate) =>
            candidate.availability.status === 'AVAILABLE' &&
            typeof candidate.mechanic?.attackBonus === 'number'
        )
        assert.ok(action, `Character actor ${actor.id} has no available attack action.`)
        actionIds.set(actor.id, action.id)
      }
      const persistedEncounter = await createEncounterRepository(db).find(encounter.id)
      assert.ok(persistedEncounter)
      const persistedActors = new Map(
        persistedEncounter.actors.map((actor) => [actor.id, actor] as const)
      )
      for (const actor of enemyActors) {
        const persistedActor = persistedActors.get(actor.id)
        assert.ok(persistedActor?.kind === 'CREATURE')
        const action = discoverEncounterFeatureActionCapabilities({ actor: persistedActor }).find(
          (candidate) => candidate.attackMechanic !== null
        )
        assert.ok(action, `Creature actor ${actor.id} has no executable attack action.`)
        actionIds.set(actor.id, action.actionId)
      }

      let expectedVersion = sceneBinding.streamVersion
      for (const actor of actorOrder) {
        const tokenId = benchmarkTokenIds.get(actor.id)
        assert.ok(tokenId)
        const binding = await sendEncounterCommand(gmRoom, playerRooms, {
          actorId: actor.id,
          commandId: randomUUID(),
          encounterId: encounter.id,
          expectedEncounterVersion: expectedVersion,
          sceneId,
          tokenId,
          type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
        })
        expectedVersion = binding.streamVersion
      }
      const reordered = await sendEncounterCommand(gmRoom, playerRooms, {
        actorIds: actorOrder.map(({ id }) => id),
        commandId: randomUUID(),
        encounterId: encounter.id,
        expectedVersion,
        type: 'REORDER'
      })
      expectedVersion = reordered.streamVersion
      const started = await sendEncounterCommand(gmRoom, playerRooms, {
        commandId: randomUUID(),
        encounterId: encounter.id,
        expectedVersion,
        systemId: fixture.systemId,
        type: 'START'
      })
      expectedVersion = started.streamVersion

      const actions: Array<CommandMeasurement & { actorKind: 'CHARACTER' | 'CREATURE' }> = []
      const advances: CommandMeasurement[] = []
      for (const [index, actor] of actorOrder.entries()) {
        const enemyIndex = enemyActors.findIndex((enemy) => enemy.id === actor.id)
        const target: (typeof actorOrder)[number] | undefined =
          actor.kind === 'CHARACTER'
            ? enemyActors[index % enemyActors.length]
            : characterActors[Math.floor(enemyIndex / 2)]
        assert.ok(target)
        const actionId = actionIds.get(actor.id)
        assert.ok(actionId)
        const sourceTokenId = benchmarkTokenIds.get(actor.id)
        const targetTokenId = benchmarkTokenIds.get(target.id)
        assert.ok(sourceTokenId && targetTokenId)
        const action = await sendEncounterCommand(gmRoom, playerRooms, {
          actionId,
          actorId: actor.id,
          commandId: randomUUID(),
          encounterId: encounter.id,
          expectedVersion,
          sceneContext: {
            expectedSceneVersion: liveScene.state.version,
            sceneId,
            sourceTokenId,
            targetTokenId
          },
          targetActorId: target.id,
          type: 'RESOLVE_ACTION'
        })
        assert.equal(action.replayed, false)
        assert.equal(action.streamVersion, expectedVersion + 1)
        const ruleOccurrences = createRuleOccurrenceRepository(db)
        const actionOccurrence = await ruleOccurrences.findEncounterByRootCommand(
          encounter.id,
          action.commandId
        )
        assert.equal(actionOccurrence?.state, 'COMPLETED')
        const actionReceipt = await ruleOccurrences.findReceipt(
          'ENCOUNTER',
          encounter.id,
          action.commandId
        )
        assert.equal(actionReceipt?.occurrenceId, actionOccurrence?.id)
        assert.equal(actionReceipt?.aggregateVersion, action.streamVersion)
        assert.ok(actionReceipt?.resultPayload.status === 'COMPLETE')
        assert.equal(
          actionReceipt.resultPayload.applicationOutputs.kind,
          target.kind === 'CHARACTER'
            ? 'CHARACTER_MECHANICS_BATCH'
            : 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        )
        actions.push({
          ...action,
          actorKind: actor.kind === 'CHARACTER' ? 'CHARACTER' : 'CREATURE'
        })
        expectedVersion = action.streamVersion
        const advance = await sendEncounterCommand(gmRoom, playerRooms, {
          commandId: randomUUID(),
          encounterId: encounter.id,
          expectedVersion,
          type: 'ADVANCE_TURN'
        })
        advances.push(advance)
        expectedVersion = advance.streamVersion
      }
      const actionDurations = actions.map(({ durationMs }) => durationMs)
      const advanceDurations = advances.map(({ durationMs }) => durationMs)
      console.info(
        JSON.stringify({
          encounterRoundBenchmark: {
            actions: actions.map((action) => ({
              actorKind: action.actorKind,
              commandId: action.commandId,
              durationMs: action.durationMs,
              service: encounterCommandTimings.find(
                ({ commandId }) => commandId === action.commandId
              )?.service
            })),
            actionLatencyMs: {
              maximum: Math.max(...actionDurations),
              p50: percentile(actionDurations, 0.5),
              p95: percentile(actionDurations, 0.95)
            },
            actors: actorOrder.length,
            advanceLatencyMs: {
              maximum: Math.max(...advanceDurations),
              p50: percentile(advanceDurations, 0.5),
              p95: percentile(advanceDurations, 0.95)
            },
            enemies: enemyActors.length,
            playerCharacters: characterActors.length,
            roundCompleted: 1
          },
          localDatabaseOnly: true
        })
      )
      return
    }
    assert.ok(encounterFeature)
    if (runsEncounterTrafficSimulation) {
      const rooms = [gmRoom, ...playerRooms]
      for (const room of rooms) room.resetTraffic()
      const enemyActors = encounter.actors.filter((actor) => actor.kind === 'CREATURE')
      assert.equal(enemyActors.length, 6)
      const commandDurations: number[] = []
      const commandCount =
        encounter.actors.length *
        ENCOUNTER_TRAFFIC_SIMULATION_ROUNDS *
        ENCOUNTER_TRAFFIC_SIMULATION_EVENTS_PER_ACTOR_ROUND
      let expectedEncounterVersion = sceneBinding.streamVersion
      const startedAt = performance.now()
      for (let index = 0; index < commandCount; index += 1) {
        const target = enemyActors[index % enemyActors.length]
        assert.ok(target)
        const measurement = await sendEncounterCommand(gmRoom, playerRooms, {
          actorId: target.id,
          commandId: randomUUID(),
          currentHitPoints:
            Math.floor(index / enemyActors.length) % 2 === 0
              ? Math.max(0, target.maxHitPoints - 1)
              : target.maxHitPoints,
          encounterId: encounter.id,
          expectedVersion: expectedEncounterVersion,
          type: 'UPDATE_ACTOR'
        })
        expectedEncounterVersion = measurement.streamVersion
        commandDurations.push(measurement.durationMs)
      }
      const durationMs = performance.now() - startedAt
      const traffic = rooms.map((room) => room.traffic())
      const total = traffic.reduce<WebSocketTraffic>(
        (sum, value) => ({
          receivedBytes: sum.receivedBytes + value.receivedBytes,
          receivedMessages: sum.receivedMessages + value.receivedMessages,
          sentBytes: sum.sentBytes + value.sentBytes,
          sentMessages: sum.sentMessages + value.sentMessages
        }),
        { receivedBytes: 0, receivedMessages: 0, sentBytes: 0, sentMessages: 0 }
      )
      console.info(
        JSON.stringify({
          encounterTrafficSimulation: {
            actors: encounter.actors.length,
            clients: rooms.length,
            commands: commandCount,
            durationMs,
            eventsPerActorPerRound: ENCOUNTER_TRAFFIC_SIMULATION_EVENTS_PER_ACTOR_ROUND,
            latencyMs: {
              maximum: Math.max(...commandDurations),
              p50: percentile(commandDurations, 0.5),
              p95: percentile(commandDurations, 0.95)
            },
            perClient: traffic,
            rounds: ENCOUNTER_TRAFFIC_SIMULATION_ROUNDS,
            traffic: total
          },
          localDatabaseOnly: true
        })
      )
      return
    }
    const gmSceneSnapshot = scenePresentationMessages[0]
    if (
      !gmSceneSnapshot ||
      gmSceneSnapshot.aggregateKind !== 'SESSION' ||
      !gmSceneSnapshot.sceneSnapshots?.[0]
    ) {
      assert.fail('GM did not receive the presented Scene snapshot.')
    }
    assert.ok(
      gmSceneSnapshot.sceneSnapshots[0].scene.tokens.some((token) => token.id === hiddenTokenId)
    )
    assert.ok(
      gmSceneSnapshot.sceneSnapshots[0].scene.annotations.some(
        (annotation) => annotation.id === annotationId
      )
    )
    for (const [index, message] of scenePresentationMessages.slice(1).entries()) {
      if (message.aggregateKind !== 'SESSION' || !message.sceneSnapshots?.[0]) {
        assert.fail('Player did not receive the presented Scene snapshot.')
      }
      assert.equal(
        message.sceneSnapshots[0].scene.tokens.some((token) => token.id === hiddenTokenId),
        false
      )
      assert.equal(
        message.sceneSnapshots[0].scene.annotations.some(
          (annotation) => annotation.id === annotationId
        ),
        false
      )
      assert.equal(
        message.sceneSnapshots[0].scene.tokens.some((token) => token.id === sceneTokenId),
        index === 0
      )
    }
    const [gmMapDelivery, playerMapDelivery] = await Promise.all([
      getVttMapDelivery(db, gm.id, mapAssetId),
      getVttMapDelivery(db, player.id, mapAssetId)
    ])
    assert.equal(gmMapDelivery.assetId, mapAssetId)
    assert.equal(playerMapDelivery.assetId, mapAssetId)
    assert.equal(gmMapDelivery.tiles.length, 1)
    assert.equal(playerMapDelivery.tiles.length, 1)
    assert.ok(outsider)
    await assert.rejects(
      getVttMapDelivery(db, outsider.id, mapAssetId),
      (error: unknown) =>
        error instanceof CampaignNotFoundError ||
        error instanceof MediaAccessError ||
        error instanceof MediaNotFoundError
    )

    const sceneMoveCommand = {
      commandId: randomUUID(),
      correlationId: null,
      expectedEncounterVersion: null,
      expectedSceneVersion: liveScene.state.version,
      movementKind: 'VOLUNTARY' as const,
      path: [
        { x: 20, y: 20 },
        { x: 25, y: 20 }
      ],
      sceneId,
      tokenId: sceneTokenId,
      type: 'MOVE_SCENE_TOKEN' as const
    }
    const sceneDoorCommand = {
      barrierId: doorId,
      commandId: randomUUID(),
      expectedSceneVersion: liveScene.state.version,
      sceneId,
      state: 'OPEN' as const,
      type: 'SET_SCENE_DOOR_STATE' as const
    }
    const [sceneMove, sceneDoor] = await Promise.all([
      sendSceneCommand(gmRoom, playerRooms, sceneMoveCommand),
      sendSceneCommand(gmRoom, playerRooms, sceneDoorCommand)
    ])
    assert.equal(sceneMove.replayed, false)
    assert.equal(sceneDoor.replayed, false)
    assert.notEqual(sceneMove.streamVersion, sceneDoor.streamVersion)
    const sceneReplay = await sendSceneCommand(gmRoom, [], sceneMoveCommand, false)
    assert.equal(sceneReplay.replayed, true)
    assert.equal(sceneReplay.streamVersion, sceneMove.streamVersion)

    let expectedSceneVersion = Math.max(sceneMove.streamVersion, sceneDoor.streamVersion)
    const measuredSceneDoorCommands: CommandMeasurement[] = []
    let doorState: 'CLOSED' | 'OPEN' = 'OPEN'
    for (let index = 0; index < VTT_USAGE_WARMUP_PAIRS + VTT_USAGE_MEASURED_PAIRS; index += 1) {
      doorState = doorState === 'OPEN' ? 'CLOSED' : 'OPEN'
      const measurement = await sendSceneCommand(gmRoom, playerRooms, {
        commandId: randomUUID(),
        expectedSceneVersion,
        barrierId: doorId,
        sceneId,
        state: doorState,
        type: 'SET_SCENE_DOOR_STATE'
      })
      expectedSceneVersion = measurement.streamVersion
      if (index >= VTT_USAGE_WARMUP_PAIRS) measuredSceneDoorCommands.push(measurement)
    }
    const sceneHostSamples = externalEndpoint
      ? []
      : measuredSceneDoorCommands.map((measurement) => {
          const timing = sceneCommandTimings.find(
            ({ commandId }) => commandId === measurement.commandId
          )
          assert.ok(timing, `Missing local Scene timing for ${measurement.commandId}.`)
          return timing.totalMs
        })
    const sceneHostP95Ms = externalEndpoint ? null : percentile(sceneHostSamples, 0.95)
    if (sceneHostP95Ms !== null) {
      assert.ok(
        sceneHostP95Ms < SCENE_HOST_P95_LIMIT_MS,
        `Scene host p95 ${sceneHostP95Ms.toFixed(2)} ms exceeded ${SCENE_HOST_P95_LIMIT_MS} ms.`
      )
    }
    const persistedScene = await createVttSceneRepository(db).findLiveScene(sceneId)
    assert.ok(persistedScene)
    assert.equal(persistedScene.state.version, expectedSceneVersion)
    assert.equal(doorState, 'OPEN')
    assert.equal(persistedScene.state.doorStates[doorId], 'OPEN')
    assert.deepEqual(
      replaySceneEvents(
        persistedScene.definitionSnapshot,
        persistedScene.state.id,
        (await createVttSceneRepository(db).listEvents(persistedScene.state.id)).map(
          (event) => event.event
        )
      ),
      persistedScene.state
    )

    await assert.rejects(
      dispatchCommandForUser(
        db,
        characterId,
        {
          type: 'ADJUST_HIT_POINTS',
          mode: 'DAMAGE',
          amount: 1,
          commandId: randomUUID(),
          expectedVersion: 1
        },
        player.id
      ),
      (error: unknown) =>
        error instanceof Error && error.name === 'LiveSessionCommandAuthorityError'
    )
    await assert.rejects(
      executeEncounterCommand(db, gm.id, {
        type: 'ADJUST_FEATURE_RESOURCE',
        encounterId: encounter.id,
        actorId: encounterActor.id,
        featureId: encounterFeature.id,
        direction: 'USE',
        amount: 1,
        commandId: randomUUID(),
        expectedVersion: encounter.version
      }),
      (error: unknown) =>
        error instanceof Error && error.name === 'LiveSessionCommandAuthorityError'
    )

    const firstCommand = {
      type: 'ADJUST_HIT_POINTS' as const,
      mode: 'DAMAGE' as const,
      amount: 1,
      commandId: randomUUID(),
      expectedVersion: 1
    }
    const cold = await sendCharacterCommand(
      playerRoom,
      characterWitnesses,
      characterId,
      firstCommand,
      true
    )
    assert.equal(cold.streamVersion, 2)
    assert.equal(cold.replayed, false)
    const coldServiceTiming = commandTimings.find(
      ({ commandId }) => commandId === cold.commandId
    )?.service
    if (enforcesDirectHostLatencyBudgets) {
      assert.ok(
        cold.durationMs < WARM_COMMAND_P95_LIMIT_MS,
        `First local command ${cold.durationMs.toFixed(2)} ms exceeded ${WARM_COMMAND_P95_LIMIT_MS} ms. Service timing: ${JSON.stringify(coldServiceTiming ?? null)}.`
      )
    }

    const replay = await sendCharacterCommand(
      playerRoom,
      characterWitnesses,
      characterId,
      firstCommand,
      false
    )
    assert.equal(replay.streamVersion, 2)
    assert.equal(replay.replayed, true)

    const playerBPrivateCommand = {
      amount: 1,
      commandId: randomUUID(),
      expectedVersion: 1,
      mode: 'DAMAGE' as const,
      type: 'ADJUST_HIT_POINTS' as const
    }
    const playerAViewOfPlayerB = waitForMessage(
      playerRoom,
      'COMMAND_COMMITTED',
      (message) => message.originCommandId === playerBPrivateCommand.commandId
    )
    const playerBCommand = await sendCharacterCommand(
      playerBRoom,
      [playerRoom, ...playerRooms.slice(2), gmRoom],
      playerBCharacterId,
      playerBPrivateCommand,
      true
    )
    assert.equal(playerBCommand.streamVersion, 2)
    const redactedPlayerBCommit = await playerAViewOfPlayerB
    if (redactedPlayerBCommit.aggregateKind !== 'CHARACTER') {
      assert.fail('Player A did not receive Player B’s Character commit.')
    }
    assert.equal(redactedPlayerBCommit.response, null)

    const warm: CommandMeasurement[] = []
    let expectedVersion = 2
    for (let index = 0; index < 8; index += 1) {
      const measurement = await sendCharacterCommand(
        playerRoom,
        characterWitnesses,
        characterId,
        {
          type: 'ADJUST_HIT_POINTS',
          mode: index % 2 === 0 ? 'HEAL' : 'DAMAGE',
          amount: 1,
          commandId: randomUUID(),
          expectedVersion
        },
        true
      )
      expectedVersion = measurement.streamVersion
      warm.push(measurement)
    }
    const warmP95Ms = percentile(
      warm.map(({ durationMs }) => durationMs),
      0.95
    )
    console.info(
      JSON.stringify({
        localLiveSessionCommandTimings: warm.map((measurement) => ({
          ...measurement,
          service: commandTimings.find(({ commandId }) => commandId === measurement.commandId)
            ?.service
        }))
      })
    )
    if (enforcesDirectHostLatencyBudgets) {
      assert.ok(
        warmP95Ms < WARM_COMMAND_P95_LIMIT_MS,
        `Warm local command p95 ${warmP95Ms.toFixed(2)} ms exceeded ${WARM_COMMAND_P95_LIMIT_MS} ms.`
      )
    }

    const measuredMaximumModifierCommands: CommandMeasurement[] = []
    for (let index = 0; index < VTT_USAGE_WARMUP_PAIRS + VTT_USAGE_MEASURED_PAIRS; index += 1) {
      for (const value of [1, 0]) {
        const measurement = await sendCharacterCommand(
          playerRoom,
          characterWitnesses,
          characterId,
          {
            adjustment: {
              family: 'HIT_POINTS',
              field: 'MAXIMUM_MODIFIER',
              id: randomUUID(),
              value
            },
            commandId: randomUUID(),
            expectedVersion,
            type: 'UPSERT_SHEET_ADJUSTMENT'
          },
          true
        )
        expectedVersion = measurement.streamVersion
        if (index >= VTT_USAGE_WARMUP_PAIRS) measuredMaximumModifierCommands.push(measurement)
      }
    }
    const maximumModifierHostSamples = externalEndpoint
      ? []
      : measuredMaximumModifierCommands.map(({ durationMs }) => durationMs)
    const maximumModifierHostP95Ms =
      maximumModifierHostSamples.length > 0 ? percentile(maximumModifierHostSamples, 0.95) : null
    if (maximumModifierHostP95Ms !== null) {
      assert.ok(
        maximumModifierHostP95Ms < RULE_BOUND_HOST_P95_LIMIT_MS,
        `Maximum-modifier host p95 ${maximumModifierHostP95Ms.toFixed(2)} ms exceeded ${RULE_BOUND_HOST_P95_LIMIT_MS} ms.`
      )
    }

    const spendableResource = initialSheet.resources.items.find(
      (resource) => resource.remaining > 0
    )
    assert.ok(
      spendableResource,
      'The live-session fixture must expose a spendable rule-backed resource.'
    )
    const mechanicsChangingCommand = await sendCharacterCommand(
      playerRoom,
      characterWitnesses,
      characterId,
      {
        type: 'USE_SHEET_RESOURCE',
        owner: spendableResource.owner,
        amount: 1,
        commandId: randomUUID(),
        expectedVersion
      },
      true
    )
    expectedVersion = mechanicsChangingCommand.streamVersion
    console.info(
      JSON.stringify({
        localLiveSessionMechanicsChangingCommandTiming: {
          ...mechanicsChangingCommand,
          service: commandTimings.find(
            ({ commandId }) => commandId === mechanicsChangingCommand.commandId
          )?.service
        }
      })
    )
    if (enforcesDirectHostLatencyBudgets) {
      assert.ok(
        mechanicsChangingCommand.durationMs < WARM_COMMAND_P95_LIMIT_MS,
        `Rule-invalidating local command ${mechanicsChangingCommand.durationMs.toFixed(2)} ms exceeded ${WARM_COMMAND_P95_LIMIT_MS} ms.`
      )
    }
    const resourceTiming = commandTimings.find(
      ({ commandId }) => commandId === mechanicsChangingCommand.commandId
    )
    if (!externalEndpoint) {
      assert.equal(resourceTiming?.service.evaluationLane, 'CHARACTER_ACTION')
      assert.ok((resourceTiming?.service.boundedZenEvaluationMs ?? 0) > 0)
    }

    const spellSlot = initialSheet.spells.slots.find((slot) => slot.remaining > 0)
    assert.ok(spellSlot, 'The prepared-caster fixture must expose a spendable spell slot.')
    const spellSlotCommand = await sendCharacterCommand(
      playerRoom,
      characterWitnesses,
      characterId,
      {
        type: 'USE_SPELL_SLOT',
        slotKey: spellSlot.slotKey,
        commandId: randomUUID(),
        expectedVersion
      },
      true
    )
    expectedVersion = spellSlotCommand.streamVersion
    const spellSlotTiming = commandTimings.find(
      ({ commandId }) => commandId === spellSlotCommand.commandId
    )
    console.info(
      JSON.stringify({
        localLiveSessionSpellSlotCommandTiming: {
          ...spellSlotCommand,
          service: spellSlotTiming?.service
        }
      })
    )
    if (enforcesDirectHostLatencyBudgets) {
      assert.ok(
        spellSlotCommand.durationMs < WARM_COMMAND_P95_LIMIT_MS,
        `Spell-slot local command ${spellSlotCommand.durationMs.toFixed(2)} ms exceeded ${WARM_COMMAND_P95_LIMIT_MS} ms.`
      )
    }
    if (!externalEndpoint) {
      assert.equal(spellSlotTiming?.service.evaluationLane, 'CHARACTER_ACTION')
      assert.ok((spellSlotTiming?.service.boundedZenEvaluationMs ?? 0) > 0)
    }
    const ruleBoundHostSamples = [
      ...maximumModifierHostSamples,
      resourceTiming?.service.totalMs,
      spellSlotTiming?.service.totalMs
    ].filter((duration): duration is number => duration !== undefined)
    if (!externalEndpoint)
      assert.equal(ruleBoundHostSamples.length, VTT_USAGE_MEASURED_PAIRS * 2 + 2)
    const ruleBoundHostP95Ms =
      ruleBoundHostSamples.length > 0 ? percentile(ruleBoundHostSamples, 0.95) : null
    if (enforcesDirectHostLatencyBudgets && ruleBoundHostP95Ms !== null) {
      assert.ok(
        ruleBoundHostP95Ms < RULE_BOUND_HOST_P95_LIMIT_MS,
        `Rule-bound host p95 ${ruleBoundHostP95Ms.toFixed(2)} ms exceeded ${RULE_BOUND_HOST_P95_LIMIT_MS} ms.`
      )
    }

    const encounterResourceCommand = await sendEncounterCommand(gmRoom, playerRooms, {
      type: 'ADJUST_FEATURE_RESOURCE',
      encounterId: encounter.id,
      actorId: encounterActor.id,
      featureId: encounterFeature.id,
      direction: 'USE',
      amount: 1,
      commandId: randomUUID(),
      expectedVersion: encounter.version
    })
    const encounterResourceTiming = encounterCommandTimings.find(
      ({ commandId }) => commandId === encounterResourceCommand.commandId
    )
    console.info(
      JSON.stringify({
        localLiveSessionEncounterResourceCommandTiming: {
          ...encounterResourceCommand,
          service: encounterResourceTiming?.service
        }
      })
    )
    if (enforcesDirectHostLatencyBudgets) {
      assert.ok(
        encounterResourceCommand.durationMs < WARM_COMMAND_P95_LIMIT_MS,
        `Encounter resource command ${encounterResourceCommand.durationMs.toFixed(2)} ms exceeded ${WARM_COMMAND_P95_LIMIT_MS} ms.`
      )
    }
    if (!externalEndpoint) {
      assert.equal(encounterResourceTiming?.service.evaluationLane, 'NONE')
      assert.equal(encounterResourceTiming?.service.actorEvaluationMs, 0)
    }
    const expectedRoomDeliverySequenceBeforeReconnect =
      expectedVersion + playerBCommand.streamVersion + expectedSceneVersion + 1

    const dropped = playerRoom.waitForDrop()
    const reconnected = playerRoom.waitForReconnect()
    const reconnectReady = waitForMessage(
      playerRoom,
      'READY',
      (message) => message.campaignId === campaign.id && message.sessionId === session.id
    )
    const reconnectStartedAt = performance.now()
    playerRoom.simulateDrop()
    await dropped
    const bufferedCommand = {
      type: 'ADJUST_HIT_POINTS' as const,
      mode: 'HEAL' as const,
      amount: 1,
      commandId: randomUUID(),
      expectedVersion
    }
    const bufferedOutcome = sendCharacterCommand(
      playerRoom,
      characterWitnesses,
      characterId,
      bufferedCommand,
      true
    )
    await reconnected
    const ready = await reconnectReady
    const buffered = await bufferedOutcome
    const reconnectMs = performance.now() - reconnectStartedAt
    assert.equal(buffered.streamVersion, expectedVersion + 1)
    assert.equal(buffered.replayed, false)
    assert.equal(ready.deliverySequence, expectedRoomDeliverySequenceBeforeReconnect)
    assert.ok(
      ready.aggregateVersions.some(
        (version) =>
          version.aggregateKind === 'CHARACTER' &&
          version.aggregateId === characterId &&
          version.version === expectedVersion
      )
    )
    const reconnectedScene = ready.sceneSnapshots.find((snapshot) => snapshot.scene.id === sceneId)
    assert.ok(reconnectedScene)
    assert.equal(reconnectedScene.scene.version, expectedSceneVersion)
    assert.equal(
      reconnectedScene.scene.tokens.some((token) => token.id === hiddenTokenId),
      false
    )
    assert.equal(
      reconnectedScene.scene.annotations.some((annotation) => annotation.id === annotationId),
      false
    )
    assert.ok(reconnectedScene.scene.tokens.some((token) => token.id === sceneTokenId))

    const [persisted, row, persistedEncounter] = await Promise.all([
      createCharacterRepository(db).findAuthoredById(characterId),
      createCharacterRepository(db).findById(characterId),
      createEncounterRepository(db).find(encounter.id)
    ])
    assert.ok(persisted && row && persistedEncounter)
    assert.equal(row.stream_version, expectedVersion + 1)
    assert.equal(persisted.state.hitpoints.current, fixture.expectedMaxHitPoints)
    assert.equal(persistedEncounter.version, encounter.version + 1)

    const removedPlayer = players.at(-1)
    const removedRoom = playerRooms.at(-1)
    assert.ok(removedPlayer && removedRoom)
    const campaignBeforeRemoval = await getCampaign(db, gm.id, campaign.id)
    const removedMembership = campaignBeforeRemoval.memberships.find(
      ({ userId }) => userId === removedPlayer.id
    )
    assert.ok(removedMembership)
    const removedRejection = waitForMessage(
      removedRoom,
      'COMMAND_REJECTED',
      (message) => message.code === 'UNAUTHORIZED' && message.commandId === null
    )
    const removedDrop = removedRoom.waitForDrop()
    const retainedRefresh = waitForMessage(gmRoom, 'READY', (message) =>
      message.aggregateVersions.some(
        (version) =>
          version.aggregateKind === 'CAMPAIGN' &&
          version.aggregateId === campaign.id &&
          version.version > campaignBeforeRemoval.version
      )
    )
    await removeCampaignMember(
      db,
      gm.id,
      campaign.id,
      removedPlayer.id,
      campaignBeforeRemoval.version,
      removedMembership.accessStartedAt,
      randomUUID()
    )
    removedRoom.refreshAuthorityAndStopReconnect()
    const [revocation, refreshedCampaign] = await Promise.all([removedRejection, retainedRefresh])
    await removedDrop
    assert.equal(revocation.code, 'UNAUTHORIZED')
    const campaignAfterRemoval = await getCampaign(db, gm.id, campaign.id)
    assert.equal(
      campaignAfterRemoval.memberships.some(({ userId }) => userId === removedPlayer.id),
      false
    )
    assert.ok(
      refreshedCampaign.aggregateVersions.some(
        (version) =>
          version.aggregateKind === 'CAMPAIGN' &&
          version.aggregateId === campaign.id &&
          version.version === campaignAfterRemoval.version
      )
    )
    await assert.rejects(
      withUserContext(db, removedPlayer.id, (scopedDb) =>
        issueLiveSessionTicket(scopedDb, removedPlayer.id, options, ticketSecret)
      ),
      CampaignAccessError
    )

    await Promise.all(playerRooms.map((room) => room.leave()))
    playerRooms = []
    playerRoom = null
    await gmRoom.leave()
    gmRoom = null
    if (sessionHost) {
      await sessionHost.gracefullyShutdown(false)
      sessionHost = null
    }
    await waitForLeaseRelease(
      db,
      session.id,
      externalDurableObject
        ? DURABLE_OBJECT_LEASE_RELEASE_TIMEOUT_MS
        : DIRECT_HOST_LEASE_RELEASE_TIMEOUT_MS
    )
    await proveCompactCharacterPostgresSemantics({
      campaignId: campaign.id,
      characterId,
      connectionString,
      sessionId: session.id,
      userId: player.id
    })

    const currentCampaignId = campaignId
    assert.ok(currentCampaignId)
    const authorityId = `scene-lock-proof-${randomUUID()}`
    const leaseNow = new Date()
    const claimed = await createLiveSessionCommandLeaseRepository(db).claim({
      authorityId,
      expiresAt: new Date(leaseNow.getTime() + 30_000).toISOString(),
      now: leaseNow.toISOString(),
      sessionId: session.id
    })
    assert.equal(claimed, true)
    const sceneEventsBeforeLockProof = await createVttSceneRepository(db).listEvents(sceneId)
    const presentationProofDb = createDb({ connectionString })
    const liveCommandProofDb = createDb({ connectionString })
    try {
      let presentationFinished = false
      let liveCommandFinished = false
      const proof = await withTransaction(db, async (trx) => {
        await sql`
          SELECT id
          FROM public.campaign_live_scenes
          WHERE id = ${sceneId}
          FOR UPDATE
        `.execute(trx)

        const presentationUpdate = setCampaignLiveScenePresentation(
          presentationProofDb,
          gmUser.id,
          {
            commandId: randomUUID(),
            expectedPresentationVersion: scenePresentation.streamVersion,
            sceneId,
            sessionId: session.id,
            type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
          },
          { liveSessionAuthority: { authorityId, sessionId: session.id } }
        ).finally(() => {
          presentationFinished = true
        })
        const liveCommand = executeEncounterSceneCommandWithState(
          liveCommandProofDb,
          gmUser.id,
          {
            barrierId: doorId,
            commandId: randomUUID(),
            expectedSceneVersion,
            sceneId,
            state: 'CLOSED' as const,
            type: 'SET_SCENE_DOOR_STATE' as const
          },
          {
            liveSessionAuthority: { authorityId, sessionId: session.id },
            liveSceneContext: {
              authorityId,
              campaignId: currentCampaignId,
              sessionId: session.id
            }
          }
        ).finally(() => {
          liveCommandFinished = true
        })

        await delay(75)
        assert.equal(
          presentationFinished,
          false,
          'Session presentation bypassed the held Scene lock.'
        )
        assert.equal(liveCommandFinished, false, 'Live Scene command bypassed the held Scene lock.')
        return { liveCommand, presentationUpdate }
      })
      const [presentationUpdate, liveCommand] = await Promise.all([
        proof.presentationUpdate,
        proof.liveCommand
      ])
      assert.equal(presentationUpdate.replayed, false)
      assert.equal(presentationUpdate.version, scenePresentation.streamVersion + 1)
      assert.equal(liveCommand.result.replayed, false)
      const sceneEventsAfterLockProof = await createVttSceneRepository(db).listEvents(sceneId)
      assert.equal(sceneEventsAfterLockProof.length, sceneEventsBeforeLockProof.length + 1)
      assert.equal(liveCommand.state.version, expectedSceneVersion + 1)
      assert.equal(liveCommand.state.doorStates[doorId], 'CLOSED')
    } finally {
      await Promise.all([
        presentationProofDb.destroy(),
        liveCommandProofDb.destroy(),
        createLiveSessionCommandLeaseRepository(db).release({
          authorityId,
          sessionId: session.id
        })
      ])
    }

    console.info(
      JSON.stringify({
        authenticatedJoin: 'verified',
        commandAuthorityLeaseCleanup: 'verified',
        commandPersistence: 'verified',
        directHttpMutationBypass: 'rejected',
        exactReplay: 'verified',
        health: 'verified',
        hostMode: externalDurableObject
          ? 'LOCAL_DURABLE_OBJECT_HTTP_EXECUTOR'
          : externalEndpoint
            ? 'EXTERNAL_LINUX_CONTAINER'
            : 'LOCAL_NODE_PROCESS',
        directHostLatencyBudgets: enforcesDirectHostLatencyBudgets ? 'enforced' : 'not-applicable',
        encounterCommittedSnapshot: 'verified',
        localDatabaseOnly: true,
        multiClientCommittedBroadcast: 'verified',
        membershipRevocationCurrentness: 'verified',
        reconnectBufferedCommand: 'verified',
        timings: {
          coldCommandMs: cold.durationMs,
          encounterResourceCommandMs: encounterResourceCommand.durationMs,
          gmJoinMs: gmJoin.durationMs,
          mechanicsChangingCommandMs: mechanicsChangingCommand.durationMs,
          maximumModifierHostP95Ms,
          maximumModifierHostSamples,
          playerJoinMs: playerJoin.durationMs,
          reconnectMs,
          ruleBoundHostP95Ms,
          sceneHostP95Ms,
          sceneHostSamples,
          spellSlotCommandMs: spellSlotCommand.durationMs,
          warmCommandMaxMs: Math.max(...warm.map(({ durationMs }) => durationMs)),
          warmCommandP50Ms: percentile(
            warm.map(({ durationMs }) => durationMs),
            0.5
          ),
          warmCommandP95Ms: warmP95Ms,
          warmCommandSamples: warm.map(({ durationMs }) => durationMs)
        }
      })
    )
  } catch (error) {
    runError = error
  } finally {
    if (playerRooms.length > 0) {
      const rooms = playerRooms
      playerRooms = []
      await captureCleanup(() => Promise.all(rooms.map((room) => room.leave())))
    }
    if (gmRoom) {
      const room = gmRoom
      await captureCleanup(() => room.leave())
    }
    if (sessionHost) {
      const host = sessionHost
      await captureCleanup(() => host.gracefullyShutdown(false))
    }
    if (campaignId && gm) {
      const currentCampaignId = campaignId
      const currentGm = gm
      await captureCleanup(async () => {
        const campaign = await getCampaign(db, currentGm.id, currentCampaignId)
        await deleteCampaign(db, currentGm.id, currentCampaignId, campaign.version)
        campaignDeleted = true
      })
    }
    if (campaignDeleted) {
      await captureCleanup(async () => {
        const { error } = await admin.storage.from('media').remove(mapObjectKeys)
        if (error) throw error
        await createMediaRepository(db).deleteAsset(mapAssetId)
      })
    }
    if (encounterBlueprintId && gm) {
      const currentEncounterBlueprintId = encounterBlueprintId
      const currentGm = gm
      await captureCleanup(async () => {
        const deleted = await sql<{ id: string }>`
          delete from public.encounter_blueprints
          where id = ${currentEncounterBlueprintId}::uuid
            and owner_user_id = ${currentGm.id}::uuid
          returning id
        `.execute(db)
        assert.equal(deleted.rows[0]?.id, currentEncounterBlueprintId)
      })
    }
    for (const currentPlayer of players) {
      await captureCleanup(() => deleteDisposableAuthUser(admin.auth.admin, db, currentPlayer.id))
    }
    await captureCleanup(async () => {
      assert.equal(await createCharacterRepository(db).findById(characterId), null)
    })
    if (gm) {
      const currentGm = gm
      await captureCleanup(() => deleteDisposableAuthUser(admin.auth.admin, db, currentGm.id))
    }
    if (outsider) {
      const currentOutsider = outsider
      await captureCleanup(() => deleteDisposableAuthUser(admin.auth.admin, db, currentOutsider.id))
    }
    await captureCleanup(() => db.destroy())
  }
  if (runError) throw runError
  if (cleanupError) throw cleanupError
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
