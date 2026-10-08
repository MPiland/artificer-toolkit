import {
  LIVE_SESSION_CHECKPOINT_IO_SECTIONS,
  LIVE_SESSION_CHECKPOINT_REASONS,
  liveSessionCheckpointIoSchema,
  type LiveSessionCheckpointIo,
  type LiveSessionCheckpointReason
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { z } from 'zod'

import type { RoomStorage } from './roomEncounterStore.js'

/** How Cloudflare bills an incoming request; WebSocket messages count 20:1 (ADR 0035 Decision 9). */
type RoomRequestKind = 'WEBSOCKET_MESSAGE' | 'HTTP' | 'ALARM'

interface CheckpointTotals {
  count: number
  /** Worker→Convex requests: one inline, or stage + parts + commit. */
  requests: number
  /** Canonical records JSON bytes sent, summed. */
  payloadBytes: number
  wallMs: number
  /**
   * Convex's own transaction metrics from the checkpoint mutation (the commit for staged ones),
   * with the same totals split by the section of the checkpoint that did the work.
   */
  convex: LiveSessionCheckpointIo
}

/** Everything the room counted from its first request after a release until its next release. */
interface RoomMeterTotals {
  epoch: string | null
  startedAt: number
  endedAt: number | null
  requests: Record<RoomRequestKind, number>
  /** Incoming WebSocket messages by their `type`; `INVALID` when the message did not parse. */
  messagesByType: Record<string, number>
  /** Outgoing WebSocket frames by their `type`, one per recipient. */
  framesByType: Record<string, number>
  admissions: number
  /** The most sockets each member had admitted at once, highest first; members carry no identity. */
  peakSocketsPerMember: number[]
  sql: { rowsRead: number; rowsWritten: number }
  commands: { count: number; wallMs: number; maxMs: number }
  checkpoints: Partial<Record<LiveSessionCheckpointReason, CheckpointTotals>>
}

interface CheckpointSample {
  reason: LiveSessionCheckpointReason
  payloadBytes: number
  requests: number
  wallMs: number
  io: LiveSessionCheckpointIo
}

/** Where a room keeps its meter across hibernation; development only, so it is never metered itself. */
interface RoomMeterStore {
  read(): string | null
  write(state: string): void
  clear(): void
}

const countsSchema = z.record(z.string(), z.number())

const totalsSchema = z.strictObject({
  epoch: z.nullable(z.string()),
  startedAt: z.number(),
  endedAt: z.nullable(z.number()),
  requests: z.strictObject({ WEBSOCKET_MESSAGE: z.number(), HTTP: z.number(), ALARM: z.number() }),
  messagesByType: countsSchema,
  framesByType: countsSchema,
  admissions: z.number(),
  peakSocketsPerMember: z.array(z.number()),
  sql: z.strictObject({ rowsRead: z.number(), rowsWritten: z.number() }),
  commands: z.strictObject({ count: z.number(), wallMs: z.number(), maxMs: z.number() }),
  checkpoints: z.partialRecord(
    z.enum(LIVE_SESSION_CHECKPOINT_REASONS),
    z.strictObject({
      count: z.number(),
      requests: z.number(),
      payloadBytes: z.number(),
      wallMs: z.number(),
      convex: liveSessionCheckpointIoSchema
    })
  )
})

const persistedMeterSchema = z.strictObject({
  totals: totalsSchema,
  released: z.array(totalsSchema),
  peaks: z.array(z.tuple([z.string(), z.number()]))
})

/** Keeps the meter in one row of the room's own SQLite, written through the raw, unmetered storage. */
export function sqlRoomMeterStore(sql: RoomStorage['sql']): RoomMeterStore {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS room_meter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state TEXT NOT NULL
    )
  `)
  return {
    read: () => {
      const row = sql.exec('SELECT state FROM room_meter WHERE id = 1').toArray()[0]
      return row ? String(row.state) : null
    },
    write: (state) => {
      sql.exec(
        'INSERT INTO room_meter (id, state) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET state = excluded.state',
        state
      )
    },
    clear: () => {
      sql.exec('DELETE FROM room_meter WHERE id = 1')
    }
  }
}

function readPersistedMeter(state: string) {
  try {
    return persistedMeterSchema.parse(JSON.parse(state))
  } catch {
    return null
  }
}

const MAX_RELEASED_TOTALS = 16

type IoCounters = Omit<LiveSessionCheckpointIo, 'sections'>

const emptyCounters = (): IoCounters => ({
  bytesRead: 0,
  bytesWritten: 0,
  documentsRead: 0,
  documentsWritten: 0
})

const emptyIo = (): LiveSessionCheckpointIo => ({
  ...emptyCounters(),
  sections: {
    fence: emptyCounters(),
    records: emptyCounters(),
    scopes: emptyCounters(),
    holds: emptyCounters(),
    scenes: emptyCounters(),
    history: emptyCounters(),
    privateRolls: emptyCounters(),
    remainder: emptyCounters()
  }
})

function addCounters(total: IoCounters, added: IoCounters): void {
  total.bytesRead += added.bytesRead
  total.bytesWritten += added.bytesWritten
  total.documentsRead += added.documentsRead
  total.documentsWritten += added.documentsWritten
}

function emptyTotals(now: number): RoomMeterTotals {
  return {
    epoch: null,
    startedAt: now,
    endedAt: null,
    requests: { WEBSOCKET_MESSAGE: 0, HTTP: 0, ALARM: 0 },
    messagesByType: {},
    framesByType: {},
    admissions: 0,
    peakSocketsPerMember: [],
    sql: { rowsRead: 0, rowsWritten: 0 },
    commands: { count: 0, wallMs: 0, maxMs: 0 },
    checkpoints: {}
  }
}

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1
}

/**
 * One room's counters. Measurement only: nothing here is read back by room behaviour. With a
 * `store` the counters survive hibernation, which would otherwise reset them mid-measurement.
 */
export class RoomMeter {
  #totals = emptyTotals(Date.now())
  readonly #released: RoomMeterTotals[] = []
  readonly #peaks = new Map<string, number>()
  readonly #store: RoomMeterStore | undefined
  #saving = false

  constructor(store?: RoomMeterStore) {
    this.#store = store
    if (!store) return
    const state = store.read()
    if (state === null) return
    const restored = readPersistedMeter(state)
    if (!restored) {
      store.clear()
      return
    }
    this.#totals = restored.totals
    this.#released.push(...restored.released)
    for (const [userId, peak] of restored.peaks) this.#peaks.set(userId, peak)
  }

  /** Labels the running totals; a room that has not yet claimed an epoch stays unlabelled. */
  epoch(epoch: string): void {
    this.#totals.epoch = epoch
    this.#changed()
  }

  request(kind: RoomRequestKind): void {
    this.#totals.requests[kind] += 1
    this.#changed()
  }

  message(type: string): void {
    increment(this.#totals.messagesByType, type)
    this.#changed()
  }

  frame(type: string): void {
    increment(this.#totals.framesByType, type)
    this.#changed()
  }

  /** Makes `meterFrame` count this socket's outgoing frames for this room. */
  watch(socket: object): void {
    socketMeters.set(socket, this)
  }

  /** `concurrent` is the member's admitted open sockets including this one. */
  admitted(userId: string, concurrent: number): void {
    this.#totals.admissions += 1
    this.#peaks.set(userId, Math.max(this.#peaks.get(userId) ?? 0, concurrent))
    this.#changed()
  }

  rows(read: number, written: number): void {
    this.#totals.sql.rowsRead += read
    this.#totals.sql.rowsWritten += written
    this.#changed()
  }

  /** Runs one room command and counts its wall time, whether it settles or throws. */
  async command<T>(run: () => Promise<T>): Promise<T> {
    const started = Date.now()
    try {
      return await run()
    } finally {
      const elapsed = Date.now() - started
      const { commands } = this.#totals
      commands.count += 1
      commands.wallMs += elapsed
      commands.maxMs = Math.max(commands.maxMs, elapsed)
      this.#changed()
    }
  }

  /** Counts one acknowledged checkpoint and logs it as it happens. */
  checkpoint(sample: CheckpointSample): void {
    const totals = (this.#totals.checkpoints[sample.reason] ??= {
      count: 0,
      requests: 0,
      payloadBytes: 0,
      wallMs: 0,
      convex: emptyIo()
    })
    totals.count += 1
    totals.requests += sample.requests
    totals.payloadBytes += sample.payloadBytes
    totals.wallMs += sample.wallMs
    addCounters(totals.convex, sample.io)
    for (const section of LIVE_SESSION_CHECKPOINT_IO_SECTIONS)
      addCounters(totals.convex.sections[section], sample.io.sections[section])
    this.#changed()
    console.log(
      `[room-meter] ${JSON.stringify({ event: 'checkpoint', epoch: this.#totals.epoch, ...sample })}`
    )
  }

  /** Closes the running totals at a release, logs their summary and starts the next epoch's. */
  release(): void {
    const closed = this.#snapshot()
    closed.endedAt = Date.now()
    this.#released.push(closed)
    if (this.#released.length > MAX_RELEASED_TOTALS) this.#released.shift()
    console.log(`[room-meter] ${JSON.stringify({ event: 'release', totals: closed })}`)
    this.#totals = emptyTotals(closed.endedAt)
    this.#peaks.clear()
    this.#changed()
  }

  read(): { current: RoomMeterTotals; released: RoomMeterTotals[] } {
    return { current: this.#snapshot(), released: this.#released }
  }

  /** Saves once per event turn, before the room can hibernate; at most one write however many changes. */
  #changed(): void {
    if (!this.#store || this.#saving) return
    this.#saving = true
    queueMicrotask(() => {
      this.#saving = false
      try {
        this.#store?.write(
          JSON.stringify({
            totals: this.#totals,
            released: this.#released,
            peaks: [...this.#peaks]
          })
        )
      } catch (error) {
        console.error('Room meter save failed.', error)
      }
    })
  }

  #snapshot(): RoomMeterTotals {
    return {
      ...structuredClone(this.#totals),
      peakSocketsPerMember: [...this.#peaks.values()].sort((a, b) => b - a)
    }
  }
}

const socketMeters = new WeakMap<object, RoomMeter>()

/** Counts one outgoing frame for the room that owns `socket`, when the room has seen it. */
export function meterFrame(socket: object, type: string): void {
  socketMeters.get(socket)?.frame(type)
}

type MeterableStorage = { sql: { exec(query: string, ...bindings: unknown[]): MeterableCursor } }
type MeterableCursor = { readonly rowsRead: number; readonly rowsWritten: number }

/** Replaces some members of `target` and binds every other function to the real object. */
function intercept<T extends object>(target: T, overrides: Record<string, unknown>): T {
  return new Proxy(target, {
    get(real, property) {
      if (typeof property === 'string' && Object.hasOwn(overrides, property))
        return overrides[property]
      const value: unknown = Reflect.get(real, property, real)
      return typeof value === 'function'
        ? (...args: unknown[]) => Reflect.apply(value, real, args)
        : value
    }
  })
}

/** Adds each call's rows read and written as the cursor is consumed; iterators are not followed. */
function meterCursor<C extends MeterableCursor>(cursor: C, meter: RoomMeter): C {
  let read = 0
  let written = 0
  const settle = () => {
    meter.rows(cursor.rowsRead - read, cursor.rowsWritten - written)
    read = cursor.rowsRead
    written = cursor.rowsWritten
  }
  settle()
  return new Proxy(cursor, {
    get(real, property) {
      const value: unknown = Reflect.get(real, property, real)
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => {
        const result: unknown = Reflect.apply(value, real, args)
        settle()
        return result
      }
    }
  })
}

/**
 * Wraps the room's SQLite storage once so every statement it runs is measured without editing its
 * call sites. Hand the result only to the room's own collaborators: the runtime rejects a proxy
 * where it expects its own `DurableObjectState` or storage.
 */
export function meterStorage<S extends MeterableStorage>(storage: S, meter: RoomMeter): S {
  const { sql } = storage
  return intercept(storage, {
    sql: intercept(sql, {
      exec: (query: string, ...bindings: unknown[]) =>
        meterCursor(sql.exec(query, ...bindings), meter)
    })
  })
}
