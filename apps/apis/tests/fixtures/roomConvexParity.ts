import { vi } from 'vitest'
import type { TestConvex } from 'convex-test'
import type { z } from 'zod'
import { ConvexError } from 'convex/values'
import type { ContentSnapshotManifestDto } from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  encounterExecuteInputSchema,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  isRoomLocalEncounterCommand,
  type RoomNativeEncounterCommand
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import {
  liveSessionRoomAuthorizationSchema,
  type LiveSessionRoomAuthorization
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { EncounterDomainRejection } from '@artificer-toolkit/encounter-persistence/domainRejections'
import type { EncounterTableName } from '@artificer-toolkit/encounter-persistence/store'
import { encounterStoreSchemas } from '@artificer-toolkit/encounter-persistence/storeTables'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { internal } from '../../convex/_generated/api'
import { createConvexEncounterStoreReader } from '../../convex/lib/convexEncounterStore'
import { readRoomAuthorization } from '../../convex/liveSessions/roomAuthorization'
import type schema from '../../convex/schema'
import { LiveCaptureCache } from '../../../session-worker/src/nativeCaptureCache'
import { createNativeLiveRulesRuntime } from '../../../session-worker/src/nativeRulesRuntime'
import { executeRoomEncounterCommand } from '../../../session-worker/src/roomEncounterCommands'
import { RoomEncounterStore } from '../../../session-worker/src/roomEncounterStore'
import { RoomInputs } from '../../../session-worker/src/roomInputs'
import { loadRoomContentSnapshots } from '../../../session-worker/src/roomContentSnapshots'
import { createNodeSqliteRoomStorage } from '../../../session-worker/src/testing/nodeSqliteRoomStorage'
import {
  executeConvexFirstInRoom as executeInRoom,
  insertActiveLiveAuthority,
  workerEnvironment
} from './liveSessionWorker'
import { installContentSnapshots } from './roomContentSnapshots'

/**
 * Shadow parity (A35-S5): the same Encounter command sequence through the Convex-first comparator
 * ("room plans, Convex commits", `executeInRoom`) and through the room-native executor over node
 * SQLite, each side continuing from its own state, compared after every command. Development and
 * test only: it is deleted with the protected Convex comparators in S6c.
 */

type MemberCaller = Parameters<typeof executeInRoom>[0]

export interface ParityMember {
  userId: string
  caller: MemberCaller
}

export interface ParityDivergence {
  step: string
  path: string
  convex: unknown
  room: unknown
}

type Outcome =
  | { kind: 'COMMITTED'; result: EncounterCommandResultDto }
  | { kind: 'REJECTED'; data: unknown }
  | { kind: 'FAILED'; message: string }

const TABLES = Object.keys(encounterStoreSchemas) as EncounterTableName[]
const EPOCH = '00000000-0000-4000-8000-00000000e0c4'
const SECRET = 'parity-room-worker-secret-at-least-32-bytes'

/**
 * Normalization list. Each field is provably storage-specific, never domain data:
 * - `_id`, `_creationTime`: assigned by Convex and by the room's memory store respectively. The
 *   logical Encounter rows reference each other by public id, never by these.
 * Receipt pointer fields (`ledgerId`, `entryIndex`, `entryChecksum`) need no entry: the logical
 * reader (`createConvexEncounterStoreReader`) hydrates headers without them.
 */
const STORAGE_FIELDS: ReadonlySet<string> = new Set(['_id', '_creationTime'])

/**
 * Path-specific UUID draws, each in a namespace of its own so it never shifts the shared sequence:
 * - `receiptLedgers`: Convex draws a physical receipt-ledger id (`receiptLedgers.ts` writeReceiptRecord);
 *   the room stores logical rows and has no ledger.
 * - `refreshScope`: Convex's write trigger draws a `sceneVisionRevisions` token (`lib/mutations.ts`
 *   refreshScope); that table is Convex-only and the room has no such write.
 */
const PATH_SPECIFIC_UUID_CALLERS = ['receiptLedgers', 'refreshScope'] as const

export class ParityHalted extends Error {}

function uuid(namespace: number, index: number) {
  return `${namespace.toString(16).padStart(8, '0')}-0000-4000-8000-${index
    .toString(16)
    .padStart(12, '0')}` as ReturnType<typeof crypto.randomUUID>
}

const clip = (value: unknown) => {
  const json = JSON.stringify(value) ?? 'undefined'
  return json.length > 600 ? `${json.slice(0, 600)}...(${json.length} chars)` : json
}

function roomNative(command: EncounterCommandInputDto): RoomNativeEncounterCommand | null {
  return isRoomLocalEncounterCommand(command) ||
    command.type === 'RESOLVE_RULE_OCCURRENCE' ||
    command.type === 'VOID_RULE_OCCURRENCE'
    ? command
    : null
}

function logicalDocument(document: object) {
  return canonicalizeJson(
    Object.fromEntries(Object.entries(document).filter(([field]) => !STORAGE_FIELDS.has(field)))
  )
}

type Snapshot = Map<EncounterTableName, string[]>
type Delta = Map<EncounterTableName, { added: string[]; removed: string[] }>

/** Rows added and removed between two snapshots; a patched row is one removal and one addition. */
function snapshotDelta(before: Snapshot, after: Snapshot): Delta {
  const delta: Delta = new Map()
  for (const table of TABLES) {
    const counts = new Map<string, number>()
    for (const row of before.get(table) ?? []) counts.set(row, (counts.get(row) ?? 0) - 1)
    for (const row of after.get(table) ?? []) counts.set(row, (counts.get(row) ?? 0) + 1)
    const added: string[] = []
    const removed: string[] = []
    for (const [row, count] of [...counts].sort(([left], [right]) => (left < right ? -1 : 1)))
      for (let index = 0; index < Math.abs(count); index++) (count > 0 ? added : removed).push(row)
    if (added.length || removed.length) delta.set(table, { added, removed })
  }
  return delta
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJsonText(value: unknown): unknown {
  if (typeof value !== 'string' || !/^[[{]/.test(value)) return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

/**
 * Every field path at which two values differ. JSON text columns (`stateJson`, `commandJson`,
 * `replayReceiptJson`, ...) are compared parsed: Convex stores canonical (sorted-key) text and the
 * room keeps insertion order, and key order carries no meaning.
 */
function fieldDiffs(convex: unknown, room: unknown, path: string): ParityDivergence[] {
  const left = parseJsonText(convex)
  const right = parseJsonText(room)
  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length)
    return Array.from({ length }, (_, index) =>
      fieldDiffs(left[index], right[index], `${path}[${index}]`)
    ).flat()
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
    return keys.flatMap((key) => fieldDiffs(left[key], right[key], `${path}.${key}`))
  }
  return canonicalizeJson(left ?? null) === canonicalizeJson(right ?? null)
    ? []
    : [{ step: '', path, convex: left, room: right }]
}

/** Pairs unequal rows by public `id` where both sides have one, else by position, to name fields. */
function documentDiffs(table: string, kind: string, convex: string[], room: string[]) {
  const onlyConvex = convex.filter((row) => !room.includes(row))
  const onlyRoom = room.filter((row) => !convex.includes(row))
  const remaining = [...onlyRoom]
  const diffs: ParityDivergence[] = []
  for (const row of onlyConvex) {
    const document: unknown = JSON.parse(row)
    const keyOf = (value: unknown) =>
      isRecord(value) ? (value.commandId ?? value.id ?? value.occurrenceId) : undefined
    const id = keyOf(document)
    const index = remaining.findIndex((candidate) =>
      typeof id === 'string' ? keyOf(JSON.parse(candidate)) === id : true
    )
    const paired = index < 0 ? undefined : remaining.splice(index, 1)[0]
    diffs.push(
      ...(paired === undefined
        ? [{ step: '', path: `${table}.${kind}[]`, convex: document, room: undefined }]
        : fieldDiffs(document, JSON.parse(paired), `${table}.${kind}[id=${String(id)}]`))
    )
  }
  for (const row of remaining)
    diffs.push({ step: '', path: `${table}.${kind}[]`, convex: undefined, room: JSON.parse(row) })
  return diffs
}

async function convexSnapshot(t: TestConvex<typeof schema>): Promise<Snapshot> {
  const entries = await t.run(async (ctx) => {
    // The reader's per-table overload intersection cannot take a runtime table union.
    const query = createConvexEncounterStoreReader(ctx).query as (
      table: EncounterTableName
    ) => { collect(): Promise<object[]> }
    return Promise.all(
      TABLES.map(
        async (table) => [table, (await query(table).collect()).map(logicalDocument)] as const
      )
    )
  })
  return new Map(entries)
}

/** The Convex side's room authorization as JSON; `t.run` cannot return `undefined` members. */
async function convexAuthorization(t: TestConvex<typeof schema>, campaignId: string, epoch: string) {
  const json = await t.run(async (ctx) =>
    JSON.stringify(await readRoomAuthorization(ctx, { campaignId, epoch, known: null }))
  )
  return liveSessionRoomAuthorizationSchema.parse(JSON.parse(json))
}

/**
 * Opens one shadow-parity scenario on a Run that Convex already holds: an ACTIVE live authority, a
 * room hydrated from the real Convex room-inputs query over node SQLite, and a clock, UUID and dice
 * source shared by both paths. Call `close` when done.
 */
export async function openRoomParity(input: {
  t: TestConvex<typeof schema>
  campaignId: string
  encounterId: string
  /** The ACTIVE authority's epoch when the fixture already holds one; otherwise one is inserted. */
  epoch?: string
}) {
  const { t, campaignId, encounterId } = input
  const epoch = input.epoch ?? EPOCH
  if (!input.epoch)
    await t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId,
        epoch,
        createdAt: new Date().toISOString()
      })
    )
  const snapshotEnvironment = await installContentSnapshots(t, campaignId)
  const { storage, database } = createNodeSqliteRoomStorage()
  const room = new RoomEncounterStore(storage)
  const inputs = new RoomInputs(
    room,
    (epoch, scope) =>
      t.query(internal.liveSessions.roomInputs.read, { campaignId, epoch, scope }),
    (manifest: ContentSnapshotManifestDto) =>
      loadRoomContentSnapshots(snapshotEnvironment, manifest, campaignId)
  )
  await inputs.hydrate({ epoch, encounterId })
  // The room's authorization is frozen for a lease; only its play section follows room commands.
  let authorization: LiveSessionRoomAuthorization = await convexAuthorization(
    t,
    campaignId,
    epoch
  )
  const runtime = await createNativeLiveRulesRuntime(process.env.RULES_CONTINUATION_SECRET ?? '')
  const captures = new LiveCaptureCache()

  const startedAt = Date.now()
  vi.useFakeTimers({ toFake: ['Date'] })
  let stepNumber = 0
  let draws = 0
  let scriptDraws = 0
  let ledgerDraws = 0
  let inStep = false
  let side: 'convex' | 'room' = 'convex'
  const drawLog: string[] = []
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    const stack = new Error().stack ?? ''
    if (inStep && PATH_SPECIFIC_UUID_CALLERS.some((caller) => stack.includes(caller)))
      return uuid(0xfffffff, ++ledgerDraws)
    if (inStep)
      drawLog.push(
        `#${stepNumber} ${side} draw ${draws + 1}: ${stack
          .split('\n')
          .slice(2, 5)
          .map((frame) => frame.trim().replace(/\(.*[\\/]([^\\/]+)\)/, '($1)'))
          .join(' < ')}`
      )
    return inStep ? uuid(0x10000000 + stepNumber, ++draws) : uuid(0x0a000000, ++scriptDraws)
  })

  const divergences: ParityDivergence[] = []
  const stepLog: string[] = []
  let halted = false

  async function runConvex(member: ParityMember, command: EncounterCommandInputDto, random: (n: number) => number) {
    try {
      return {
        kind: 'COMMITTED',
        result: await executeInRoom(member.caller, { command }, random)
      } satisfies Outcome
    } catch (error) {
      return failure(error)
    }
  }

  async function runRoom(
    member: ParityMember,
    command: RoomNativeEncounterCommand,
    random: (n: number) => number
  ) {
    const fetch = globalThis.fetch
    globalThis.fetch = async () => {
      throw new Error('The room-native path attempted an HTTP request.')
    }
    try {
      const result = await room.transact((transaction) =>
        executeRoomEncounterCommand({
          store: room,
          transaction,
          inputs,
          authorization,
          campaignId,
          epoch,
          userId: member.userId,
          recipientUserIds: authorization.campaign.members.map(({ userId }) => userId),
          command,
          random,
          turnExecution: {
            environment: workerEnvironment(SECRET),
            runtime,
            captures: captures.reads()
          }
        })
      )
      if (result.play) authorization = { ...authorization, play: result.play }
      const own = result.recipients.get(member.userId)
      if (!own) throw new Error('The room produced no result for its submitter.')
      return { kind: 'COMMITTED', result: own } satisfies Outcome
    } catch (error) {
      return failure(error)
    } finally {
      globalThis.fetch = fetch
    }
  }

  function failure(error: unknown): Outcome {
    if (error instanceof ConvexError || error instanceof EncounterDomainRejection)
      return { kind: 'REJECTED', data: error.data }
    return { kind: 'FAILED', message: error instanceof Error ? error.message : String(error) }
  }

  // A non-domain Error reaches Convex's caller only as the route wrapper's generic message ("Live
  // Session route request failed"), so a FAILED outcome compares by kind alone.
  const describe = (outcome: Outcome) =>
    outcome.kind === 'REJECTED' ? { kind: outcome.kind, data: outcome.data } : { kind: outcome.kind }
  const outcomeLabel = (outcome: Outcome) =>
    outcome.kind === 'FAILED' ? `FAILED (${outcome.message})` : outcome.kind

  async function roomSnapshot(): Promise<Snapshot> {
    const snapshot: Snapshot = new Map()
    for (const table of TABLES) snapshot.set(table, room.documents(table).map(logicalDocument))
    return snapshot
  }

  let convexBefore = await convexSnapshot(t)
  let roomBefore = await roomSnapshot()

  return {
    divergences,
    stepLog,
    /** The Run's version on the Convex side, for `expectedVersion`. */
    version: () =>
      t.run(async (ctx) => {
        const row = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', encounterId))
          .unique()
        if (!row) throw new Error('Parity Run is unavailable.')
        return row.version
      }),
    /**
     * Runs `command` through both paths with identical dice, command ids, UUID draws and clock, then
     * compares outcome, logical Encounter rows (including Characters' play and active effects) and the
     * room's play authorization. A divergence is recorded and halts the scenario.
     * `faces` are the dice's rolled faces in draw order; later draws roll three quarters of the die.
     */
    async step(
      label: string,
      member: ParityMember,
      rawCommand: z.input<typeof encounterExecuteInputSchema>['command'],
      faces: number[] = []
    ) {
      if (halted) throw new ParityHalted()
      const { command } = encounterExecuteInputSchema.parse({ command: rawCommand })
      const native = roomNative(command)
      if (!native) throw new Error(`${command.type} is not a room-native command.`)
      stepNumber += 1
      const name = `#${stepNumber} ${label}`
      const dice = () => {
        let next = 0
        return (maximum: number) => {
          const face = faces[next++]
          return face === undefined ? Math.floor((maximum * 3) / 4) : face - 1
        }
      }
      vi.setSystemTime(startedAt + stepNumber * 1000)
      inStep = true
      draws = 0
      side = 'convex'
      const convex = await runConvex(member, command, dice())
      draws = 0
      side = 'room'
      const roomOutcome = await runRoom(member, native, dice())
      inStep = false

      const found: ParityDivergence[] = []
      if (convex.kind !== roomOutcome.kind || convex.kind === 'REJECTED')
        found.push(...fieldDiffs(describe(convex), describe(roomOutcome), 'outcome'))
      else if (convex.kind === 'COMMITTED' && roomOutcome.kind === 'COMMITTED')
        found.push(...fieldDiffs(convex.result, roomOutcome.result, 'result'))
      const convexAfter = await convexSnapshot(t)
      const roomAfter = await roomSnapshot()
      const convexDelta = snapshotDelta(convexBefore, convexAfter)
      const roomDelta = snapshotDelta(roomBefore, roomAfter)
      for (const table of TABLES) {
        const left = convexDelta.get(table) ?? { added: [], removed: [] }
        const right = roomDelta.get(table) ?? { added: [], removed: [] }
        found.push(
          ...documentDiffs(table, 'added', left.added, right.added),
          ...documentDiffs(table, 'removed', left.removed, right.removed)
        )
      }
      if (convex.kind === 'COMMITTED' && roomOutcome.kind === 'COMMITTED') {
        found.push(
          ...fieldDiffs(
            (await convexAuthorization(t, campaignId, epoch)).play,
            authorization.play,
            'playAuthorization'
          )
        )
      }
      convexBefore = convexAfter
      roomBefore = roomAfter
      stepLog.push(`${name}: convex ${outcomeLabel(convex)}, room ${outcomeLabel(roomOutcome)}`)
      for (const divergence of found) divergences.push({ ...divergence, step: name })
      if (found.length) {
        halted = true
        throw new ParityHalted()
      }
      return convex
    },
    /** One line per divergence for the assertion message. */
    report: () =>
      [
        ...stepLog,
        ...(divergences.length ? drawLog : []),
        ...divergences.map(
          (divergence) =>
            `${divergence.step} ${divergence.path}: convex=${clip(divergence.convex)} room=${clip(divergence.room)}`
        )
      ].join('\n'),
    close() {
      database.close()
      vi.restoreAllMocks()
      vi.useRealTimers()
    }
  }
}

export type RoomParity = Awaited<ReturnType<typeof openRoomParity>>

/** The result of a step both paths committed; a refusal or failure is a test error. */
export function committed(outcome: Outcome): EncounterCommandResultDto {
  if (outcome.kind !== 'COMMITTED') throw new Error(`Expected a commit, got ${clip(outcome)}.`)
  return outcome.result
}

/**
 * Runs `body` over one parity scenario and closes it. `divergences` is empty when the paths agreed;
 * a halted scenario ends at its first divergence, and `report` names every step and divergence.
 */
export async function runRoomParity(
  input: Parameters<typeof openRoomParity>[0],
  body: (parity: RoomParity) => Promise<void>
) {
  const parity = await openRoomParity(input)
  try {
    await body(parity)
  } catch (error) {
    if (!(error instanceof ParityHalted)) throw error
  } finally {
    parity.close()
  }
  return { divergences: parity.divergences, report: parity.report() }
}
