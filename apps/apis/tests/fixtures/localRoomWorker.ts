import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest'
import type { TestConvex } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { ConvexError, convexToJson, jsonToConvex, type JSONValue, type Value } from 'convex/values'
import {
  LIVE_SESSION_CHECKPOINT_BARRIER_PATH,
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  LIVE_SESSION_TEST_ROLLS_PATH,
  type LiveSessionInputScope,
  type LiveSessionTestRollsInputDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  encounterExecuteInputSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { EncounterReadDto } from '@artificer-toolkit/schema/api/encounterRead'
import type { z } from 'zod'
import { api, internal } from '../../convex/_generated/api'
import type { QueryCtx } from '../../convex/_generated/server'
import { createConvexEncounterStoreReader } from '../../convex/lib/convexEncounterStore'
import type schema from '../../convex/schema'
import {
  markContentSnapshotScope,
  type ContentSnapshotScopeRef
} from '../../convex/contentSnapshots/marking'
import { executeEncounterCommand } from '../developmentClient'
import {
  DevelopmentHttpClient,
  RoomCommandRejectedError,
  type RoomSheetCommand
} from '../developmentHttpClient'
import { startLocalR2 } from '../localR2'

/**
 * The REAL Session Worker (`apps/session-worker`, its Durable Object room) in local workerd, with
 * the Convex side served by a test's own convex-test instance over loopback HTTP. The fixture fakes
 * the platform and the data (identity, storage, network endpoints), never the room's or Convex's
 * logic: Encounter commands, refusals, replays, checkpoints and dice all come from the real room,
 * and content snapshots are built by the real producer into a loopback R2 bucket.
 *
 * One Worker serves a test file (`useLocalRoomWorker`); each test attaches its own convex-test
 * instance and a fresh Campaign (`attachRoomWorker`).
 */

/** An identity-bound convex-test caller (a Campaign member), or the unauthenticated `t` itself. */
export type RoomCaller = ReturnType<TestConvex<typeof schema>['withIdentity']>

const LOCAL_ROOM_ORIGIN = 'http://localhost:3000'
const LOCAL_CONVEX_SITE_URL = 'http://127.0.0.1:3221'
const WORKER_SECRET = 'room-fixture-worker-secret-at-least-32-bytes-long'
const TICKET_SECRET = 'room-fixture-ticket-secret-at-least-32-bytes-long'
const CONTENT_TOKEN_SECRET = 'room-fixture-content-secret-at-least-32-bytes-long'
const STARTUP_TIMEOUT_MS = 120_000

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const stateDirectory = resolve(root, 'local-validation/room-fixture')

function base64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/**
 * The room reads only `exp` from a socket's access token before asking Convex (through the bridge)
 * to authenticate it, so a token is an unsigned JWT-shaped handle the bridge maps to a caller.
 */
function accessToken() {
  return [
    base64Url({ alg: 'none', typ: 'JWT' }),
    base64Url({
      aud: 'convex',
      exp: Math.floor(Date.now() / 1_000) + 3_600,
      jti: crypto.randomUUID()
    }),
    'unsigned'
  ].join('.')
}

const apiKinds = {
  '/api/query': 'query',
  '/api/mutation': 'mutation',
  '/api/action': 'action'
} as const

async function callConvex(
  caller: RoomCaller,
  kind: (typeof apiKinds)[keyof typeof apiKinds],
  path: string,
  args: Record<string, Value>
): Promise<Value | undefined> {
  if (kind === 'query')
    return caller.query(makeFunctionReference<'query', Record<string, Value>, Value>(path), args)
  if (kind === 'mutation')
    return caller.mutation(
      makeFunctionReference<'mutation', Record<string, Value>, Value>(path),
      args
    )
  return caller.action(makeFunctionReference<'action', Record<string, Value>, Value>(path), args)
}

/**
 * One loopback server for both directions of Convex traffic: the Convex client protocol
 * (`/api/query|mutation|action`, which DevelopmentHttpClient speaks) and the Convex site routes the
 * Worker calls (`/live-sessions/*`). A bearer token picks the member's convex-test caller;
 * a request with none is served by the test's own unauthenticated instance.
 */
async function startConvexBridge() {
  let anonymous: RoomCaller | null = null
  const callers = new Map<string, RoomCaller>()
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(chunk as Buffer)
      const body = Buffer.concat(chunks)
      const authorization = request.headers.authorization
      const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
      const caller = token ? callers.get(token) : anonymous
      if (!caller) return void response.writeHead(401).end()
      const path = request.url ?? '/'
      const kind = apiKinds[path as keyof typeof apiKinds]
      if (kind) {
        const call = JSON.parse(body.toString()) as { path: string; args: [JSONValue] }
        try {
          const value = await callConvex(
            caller,
            kind,
            call.path,
            jsonToConvex(call.args[0]) as Record<string, Value>
          )
          response.writeHead(200, { 'content-type': 'application/json' }).end(
            JSON.stringify({
              status: 'success',
              value: value === undefined ? null : convexToJson(value),
              logLines: []
            })
          )
        } catch (error) {
          response.writeHead(560, { 'content-type': 'application/json' }).end(
            JSON.stringify({
              status: 'error',
              errorMessage: error instanceof Error ? error.message : String(error),
              ...(error instanceof ConvexError ? { errorData: convexToJson(error.data) } : {}),
              logLines: []
            })
          )
        }
        return
      }
      const headers: Record<string, string> = {}
      for (const [name, value] of Object.entries(request.headers))
        if (typeof value === 'string' && !['host', 'connection', 'content-length'].includes(name))
          headers[name] = value
      const answer = await caller.fetch(path, {
        body: body.byteLength ? body : undefined,
        headers,
        method: request.method
      })
      response
        .writeHead(answer.status, {
          'content-type': answer.headers.get('content-type') ?? 'text/plain'
        })
        .end(Buffer.from(await answer.arrayBuffer()))
    } catch (error) {
      response.writeHead(502).end(error instanceof Error ? error.message : 'bridge failure')
    }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    serve(t: RoomCaller) {
      anonymous = t
      callers.clear()
    },
    tokenFor(caller: RoomCaller) {
      const token = accessToken()
      callers.set(token, caller)
      return token
    },
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((done) => server.close(() => done()))
    }
  }
}

async function startWorker() {
  const r2 = await startLocalR2()
  const bridge = await startConvexBridge()
  await mkdir(stateDirectory, { recursive: true })
  const directory = await mkdtemp(resolve(stateDirectory, 'run-'))
  // An empty env file keeps the ignored `.dev.vars` (the developer's local secrets) out of this Worker.
  const environmentFile = resolve(directory, 'worker.env')
  await writeFile(environmentFile, '')
  const rulesSecret = process.env.RULES_CONTINUATION_SECRET
  if (!rulesSecret) throw new Error('RULES_CONTINUATION_SECRET is required by the room.')
  const errorLogs: string[] = []
  const { unstable_startWorker } = await import('wrangler')
  vi.stubEnv('WRANGLER_LOG', 'warn')
  const worker = await unstable_startWorker({
    config: resolve(root, 'apps/session-worker/wrangler.jsonc'),
    entrypoint: resolve(root, 'apps/session-worker/src/index.ts'),
    envFiles: [environmentFile],
    bindings: Object.fromEntries(
      Object.entries({
        CONTENT_SNAPSHOT_TOKEN_SECRET: CONTENT_TOKEN_SECRET,
        CONVEX_SITE_URL: bridge.url,
        LIVE_SESSION_ALLOWED_ORIGINS: LOCAL_ROOM_ORIGIN,
        LIVE_SESSION_TICKET_SECRET: TICKET_SECRET,
        LIVE_SESSION_WORKER_SECRET: WORKER_SECRET,
        LOCAL_CONTENT_SNAPSHOT_ORIGIN: r2.endpoint,
        RULES_CONTINUATION_SECRET: rulesSecret
      }).map(([name, value]) => [name, { type: 'plain_text', value }])
    ),
    dev: {
      // Like `wrangler dev --host localhost`: without an origin wrangler infers the first route's
      // deployed domain as the request host, and the development routes only answer loopback hosts.
      origin: { hostname: '127.0.0.1' },
      persist: resolve(directory, 'state'),
      remote: false,
      server: { hostname: '127.0.0.1', port: 0 },
      structuredLogsHandler: (log: { level: string; message: string }) => {
        if (log.level === 'error') errorLogs.push(log.message)
      },
      watch: false
    }
  })
  await worker.ready
  const url = await worker.url
  return {
    errorLogs,
    r2,
    bridge,
    url: url.origin,
    dispose: async () => {
      await worker.dispose()
      await bridge.close()
      await r2.close()
      await rm(directory, { force: true, recursive: true })
    }
  }
}

type RoomWorker = Awaited<ReturnType<typeof startWorker>>
type AttachedRoom = {
  worker: RoomWorker
  t: TestConvex<typeof schema>
  clients: Map<RoomCaller | null, DevelopmentHttpClient>
  peers: DevelopmentHttpClient[]
}

let started: Promise<RoomWorker> | null = null
let attached: AttachedRoom | null = null

/** Starts one Worker for the test file and stops it, with its loopback servers, after the file. */
export function useLocalRoomWorker() {
  beforeAll(() => {
    started = startWorker()
    return started.then(() => undefined)
  }, STARTUP_TIMEOUT_MS)
  afterEach(() => {
    for (const client of [...(attached?.clients.values() ?? []), ...(attached?.peers ?? [])])
      client.closeRooms()
    attached = null
  })
  afterAll(async () => {
    await (await started)?.dispose()
    started = null
  })
}

/**
 * Points the file's Worker at this test's convex-test instance and gives Convex the room's
 * environment (secrets, the Worker's URL, local R2). Each test needs a fresh Campaign: the Worker's
 * rooms are keyed by Campaign and outlive the test.
 */
export async function attachRoomWorker(t: TestConvex<typeof schema>) {
  const worker = await started
  if (!worker) throw new Error('Call useLocalRoomWorker() in the test file first.')
  worker.bridge.serve(t)
  worker.r2.objects.clear()
  worker.r2.contentSnapshotObjects.clear()
  worker.errorLogs.length = 0
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', WORKER_SECRET)
  vi.stubEnv('LIVE_SESSION_TICKET_SECRET', TICKET_SECRET)
  vi.stubEnv('LIVE_SESSION_WORKER_URL', worker.url)
  vi.stubEnv('VITE_LIVE_SESSION_WEBSOCKET_URL', worker.url.replace('http:', 'ws:'))
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('LOCAL_R2_ENDPOINT', worker.r2.endpoint)
  vi.stubEnv('CONVEX_SITE_URL', LOCAL_CONVEX_SITE_URL)
  attached = { worker, t, clients: new Map(), peers: [] }
  return worker.r2
}

function room(): AttachedRoom {
  if (!attached) throw new Error('Call attachRoomWorker(t) in the test first.')
  return attached
}

/**
 * The development client a member (or, with `null`, a signed-out visitor) drives the real room
 * with: DevelopmentHttpClient itself, over the bridge, so the shared drivers run unchanged.
 * Encounter commands and Scene bindings go through the member's socket to the real room.
 */
export function roomDevelopmentClient(caller: RoomCaller | null): DevelopmentHttpClient {
  const { clients } = room()
  const existing = clients.get(caller)
  if (existing) return existing
  const client = openRoomClient(caller)
  clients.set(caller, client)
  return client
}

/**
 * A second, independent client for the same member: its own sockets to the real room, as a second
 * browser tab has, so concurrent commands from one member reach the room's own ordering.
 */
export function roomPeerClient(caller: RoomCaller): DevelopmentHttpClient {
  const client = openRoomClient(caller)
  room().peers.push(client)
  return client
}

function openRoomClient(caller: RoomCaller | null): DevelopmentHttpClient {
  const { worker } = room()
  const client = new DevelopmentHttpClient(worker.bridge.url, { holdRooms: true, logger: false })
  if (caller) {
    const mint = () => worker.bridge.tokenFor(caller)
    client.setAuth(mint(), () => Promise.resolve(mint()))
  }
  return client
}

/**
 * Sends an Encounter command through the member's socket to the real room, as a browser does.
 * Sending a settled command again is a retry: the live room's held history answers it (D85).
 */
export function executeInRoom(
  caller: RoomCaller,
  input: z.input<typeof encounterExecuteInputSchema>
): Promise<EncounterCommandResultDto> {
  return roomDevelopmentClient(caller).mutation(
    executeEncounterCommand,
    encounterExecuteInputSchema.parse(input)
  )
}

/** Sends one live Character Sheet command through the member's socket, as the Sheet does while the room holds the Character. */
export function executeSheetInRoom(caller: RoomCaller, command: RoomSheetCommand) {
  return roomDevelopmentClient(caller).executeCharacterSheet(command)
}

/**
 * What a member's socket reads from the real room while it holds the Run (D85): the Encounter
 * session frame the room sends after the member subscribes. Held history is visible only through
 * the room's own member messages, never through Convex rows.
 */
export function readRoomEncounterSession(
  caller: RoomCaller,
  campaignId: string,
  options: { timeline: boolean }
) {
  return roomDevelopmentClient(caller).encounterSession(campaignId, options.timeline)
}

/** The Run's timeline as the real room sends it to this member (newest page; a player's only the table's entries). */
export async function readRoomTimeline(caller: RoomCaller, campaignId: string) {
  const session = await readRoomEncounterSession(caller, campaignId, { timeline: true })
  return (session.held ? session.timeline?.entries : null) ?? []
}

/**
 * The roll cards the room's commands posted to the table chat, oldest first, as this member reads
 * them after a checkpoint. An action's d20s and damage totals are visible only here (D85).
 */
export async function readRoomRollCards(caller: RoomCaller, campaignId: string) {
  await checkpointLiveRoom(campaignId)
  const page = await caller.query(api.campaigns.chat.list, {
    campaignId,
    room: 'TABLE',
    limit: 100
  })
  return page.entries.flatMap((entry) => (entry.roll ? [entry.roll] : [])).reverse()
}

/** The real room's answer to this member's `ENCOUNTER_READ`; its refusal rejects. */
export function readRoomEncounter(caller: RoomCaller, campaignId: string, read: EncounterReadDto) {
  return roomDevelopmentClient(caller).readEncounter(campaignId, read)
}

/**
 * What the real room logged as errors since this test attached. The room tells a member nothing of
 * a command's failure cause, so its error log is where the cause of a redacted refusal shows.
 */
export function roomErrorLogs(): readonly string[] {
  return room().worker.errorLogs
}

/** A refusal the room redacted to the member: its code and the message it sent (never the cause). */
export { RoomCommandRejectedError as RoomCommandRefusal }

/** Asserts the real room redacted a command's failure to this code and member-visible message. */
export async function expectRedactedRoomRefusal(
  command: Promise<unknown>,
  message: string | RegExp,
  code = 'UNAVAILABLE'
) {
  const error = await command.then(
    () => {
      throw new Error('Expected the room to refuse the command.')
    },
    (failure: unknown) => failure
  )
  // Anything else (a domain rejection or a harness failure) is rethrown whole for the test report.
  if (!(error instanceof RoomCommandRejectedError)) throw error
  expect({ code: error.code, message: error.message }).toEqual({
    code,
    message:
      typeof message === 'string'
        ? expect.stringContaining(message)
        : expect.stringMatching(message)
  })
}

async function postToWorker(path: string, body?: unknown, tolerated: readonly number[] = []) {
  const post = () =>
    fetch(new URL(path, room().worker.url), {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { [LIVE_SESSION_CONTROL_SECRET_HEADER]: WORKER_SECRET },
      method: 'POST'
    })
  // Every control route here is safe to repeat. The proxy can drop a pooled connection between
  // requests (ECONNABORTED), which fails the write before anything reaches the Worker.
  const response = await post().catch(post)
  if (!response.ok && !tolerated.includes(response.status))
    throw new Error(
      `The Worker ${path} route answered ${response.status}: ${(await response.text()).slice(0, 300)}`
    )
}

/**
 * Queues the room's next dice for a Campaign, consumed in order and as given (a roll is not
 * clamped to its die); `repeat` then answers every later roll, and an empty queue restores the
 * platform's dice. Each call replaces the earlier queue, as `mockReturnValueOnce` calls
 * followed by `mockReturnValue` would.
 */
export function queueRoomRolls(campaignId: string, rolls: LiveSessionTestRollsInputDto) {
  return postToWorker(`${LIVE_SESSION_TEST_ROLLS_PATH}/${campaignId}`, rolls)
}

/** Publishes everything the room has committed to Convex, without disturbing its sockets. */
export function checkpointRoom(campaignId: string) {
  return postToWorker(`${LIVE_SESSION_CHECKPOINT_BARRIER_PATH}/${campaignId}`)
}

/**
 * Like `checkpointRoom`, for a read that can come before the Campaign's first room command: the
 * room answers 409 while it holds no live authority, and Convex is then the only state there is.
 */
export function checkpointLiveRoom(campaignId: string) {
  return postToWorker(`${LIVE_SESSION_CHECKPOINT_BARRIER_PATH}/${campaignId}`, undefined, [409])
}

/**
 * The notice Convex's scheduler sends after a transaction changes a Campaign's inputs. convex-test
 * runs no scheduler, so a test that edits a held Character delivers it here.
 */
export function invalidateRoomInputs(campaignId: string, scopes: LiveSessionInputScope[]) {
  return postToWorker(LIVE_SESSION_CONTROL_PATH, {
    campaignId,
    operation: { type: 'INVALIDATE_INPUTS', scopes }
  })
}

/** The control route Convex calls to close a Campaign's room: it drains, checkpoints and releases. */
export function closeRoom(campaignId: string) {
  return postToWorker(LIVE_SESSION_CONTROL_PATH, { campaignId, operation: { type: 'CLOSE_ROOM' } })
}

/**
 * The Encounter history rows Convex holds. A Run's history lives in the room until the Run ends
 * (D85) and the room serves no read of it, so rows the room still holds are not visible here.
 */
export function readEncounterHistory(ctx: QueryCtx) {
  return createConvexEncounterStoreReader(ctx)
}

/**
 * Builds the Campaign's content snapshots with the real producer (the build action, into the
 * loopback R2 bucket the Worker reads). Run it again after content changes, then `closeRoom`: a
 * room reads the snapshots current when it activates.
 */
export async function seedRoomContentSnapshots(campaignId: string) {
  const { t } = room()
  const scopes = await t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaignId))
      .unique()
    if (!campaign) throw new Error('Content snapshot Campaign is unavailable.')
    const sources = await ctx.db
      .query('contentSources')
      .withIndex('by_gameSystemId', (q) => q.eq('gameSystemId', campaign.gameSystemId))
      .collect()
    const refs: ContentSnapshotScopeRef[] = [
      ...sources.map((source) => ({ scope: 'SOURCE' as const, scopeId: source.id })),
      { scope: 'CAMPAIGN', scopeId: campaignId }
    ]
    for (const ref of refs) await markContentSnapshotScope(ctx, ref, true)
    return refs
  })
  for (const scope of scopes) await t.action(internal.contentSnapshots.actions.build, scope)
}
