import type {
  LiveSessionCheckpointIo,
  LiveSessionCheckpointReason
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'

/** How Cloudflare bills an incoming request; WebSocket messages count 20:1 (ADR 0035 Decision 9). */
export type RoomRequestKind = 'WEBSOCKET_MESSAGE' | 'HTTP' | 'ALARM'

export interface CheckpointTotals {
  count: number
  /** Worker→Convex requests: one inline, or stage + parts + commit. */
  requests: number
  /** Canonical records JSON bytes sent, summed. */
  payloadBytes: number
  wallMs: number
  /** Convex's own transaction metrics from the checkpoint mutation (the commit for staged ones). */
  convex: LiveSessionCheckpointIo
}

/** Everything the room counted from its first request after a release until its next release. */
export interface RoomMeterTotals {
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

export interface CheckpointSample {
  reason: LiveSessionCheckpointReason
  payloadBytes: number
  requests: number
  wallMs: number
  io: LiveSessionCheckpointIo
}

const MAX_RELEASED_TOTALS = 16

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

/** One room's counters. Measurement only: nothing here is read back by room behaviour. */
export class RoomMeter {
  #totals = emptyTotals(Date.now())
  readonly #released: RoomMeterTotals[] = []
  readonly #peaks = new Map<string, number>()

  /** Labels the running totals; a room that has not yet claimed an epoch stays unlabelled. */
  epoch(epoch: string): void {
    this.#totals.epoch = epoch
  }

  request(kind: RoomRequestKind): void {
    this.#totals.requests[kind] += 1
  }

  message(type: string): void {
    increment(this.#totals.messagesByType, type)
  }

  frame(type: string): void {
    increment(this.#totals.framesByType, type)
  }

  /** Makes `meterFrame` count this socket's outgoing frames for this room. */
  watch(socket: object): void {
    socketMeters.set(socket, this)
  }

  /** `concurrent` is the member's admitted open sockets including this one. */
  admitted(userId: string, concurrent: number): void {
    this.#totals.admissions += 1
    this.#peaks.set(userId, Math.max(this.#peaks.get(userId) ?? 0, concurrent))
  }

  rows(read: number, written: number): void {
    this.#totals.sql.rowsRead += read
    this.#totals.sql.rowsWritten += written
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
    }
  }

  /** Counts one acknowledged checkpoint and logs it as it happens. */
  checkpoint(sample: CheckpointSample): void {
    const totals = (this.#totals.checkpoints[sample.reason] ??= {
      count: 0,
      requests: 0,
      payloadBytes: 0,
      wallMs: 0,
      convex: { bytesRead: 0, bytesWritten: 0, documentsRead: 0, documentsWritten: 0 }
    })
    totals.count += 1
    totals.requests += sample.requests
    totals.payloadBytes += sample.payloadBytes
    totals.wallMs += sample.wallMs
    totals.convex.bytesRead += sample.io.bytesRead
    totals.convex.bytesWritten += sample.io.bytesWritten
    totals.convex.documentsRead += sample.io.documentsRead
    totals.convex.documentsWritten += sample.io.documentsWritten
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
  }

  read(): { current: RoomMeterTotals; released: RoomMeterTotals[] } {
    return { current: this.#snapshot(), released: this.#released }
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
