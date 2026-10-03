import type { LiveSessionWebSocketClientMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt'

/** Room-side flood limits; see "Security and limits" in docs/architecture/live-sessions.md. */
export const ROOM_LIMITS = {
  maxMessageBytes: 64 * 1024,
  maxSocketsPerUser: 4,
  maxSocketsPerRoom: 64,
  authenticationTimeoutMs: 10_000,
  /** With no admitted socket for this long, the room drains and releases its authority (ADR 0033). */
  idleReleaseMs: 5 * 60_000,
  maxPendingCommandsPerSocket: 8,
  maxPendingCommandsPerRoom: 64,
  /** A player's Encounter commands run one at a time across all of their sockets. */
  maxInFlightEncounterCommandsPerPlayer: 1,
  /**
   * The room trusts its authorization cache for this long (2N, ADR 0035 Amendment 14). Each
   * socket's re-authentication, and later each checkpoint response, renews it.
   */
  authorizationLeaseMs: 240_000,
  checkpointDeadlineMs: 120_000,
  /** A failed checkpoint or release in the alarm retries after this delay instead of at its past deadline. */
  alarmRetryMs: 30_000,
  /** A background preview refresh starts at most once per input in this window. */
  previewRetryMs: 5_000,
  /**
   * A GM's staged fog patches (D79): at most this many unpublished uploads per account, each
   * discarded once its window passes, at publication, or when the epoch ends. The per-batch message
   * limits bound the bytes, so no separate byte cap exists.
   */
  maxFogUploadsPerUser: 2,
  fogUploadWindowMs: 10 * 60_000
} as const

/**
 * Per-account token buckets inside each room (D72), shared across the account's sockets and kept
 * in room SQLite. TABLE covers chat and every roll the account makes; SCENE covers Scene writes.
 * The GM of their own room gets the larger TABLE allowance.
 */
export const ACCOUNT_BUCKETS = {
  TABLE: {
    PLAYER: { capacity: 30, refillPerMinute: 30 },
    OWNER: { capacity: 60, refillPerMinute: 60 }
  },
  SCENE: {
    PLAYER: { capacity: 80, refillPerMinute: 240 },
    OWNER: { capacity: 80, refillPerMinute: 240 }
  }
} as const

type MessageClass = 'AUTHENTICATE' | 'COMMAND' | 'FOG_UPLOAD' | 'INVALID' | 'SYNC' | 'TRANSIENT'

// Clients send previews only during a gesture, each stream at most 10 Hz, and re-authenticate only
// on connect or challenge; the TRANSIENT budget is the room's backstop. A ping also takes one PING
// token when it fans out; faster pings are dropped without closing the socket. FOG_UPLOAD admits one
// full 256-chunk fog layer (a begin and 32 batches of 8) in a burst.
const BUDGETS: Record<MessageClass | 'PING', { capacity: number; refillPerSecond: number }> = {
  AUTHENTICATE: { capacity: 10, refillPerSecond: 0.5 },
  COMMAND: { capacity: 20, refillPerSecond: 5 },
  FOG_UPLOAD: { capacity: 40, refillPerSecond: 20 },
  INVALID: { capacity: 5, refillPerSecond: 0.5 },
  PING: { capacity: 1, refillPerSecond: 1_000 / VTT_SCENE_LIMITS.pingIntervalMs },
  SYNC: { capacity: 20, refillPerSecond: 2 },
  TRANSIENT: { capacity: 200, refillPerSecond: 100 }
}

export function messageClass(message: LiveSessionWebSocketClientMessageDto | null): MessageClass {
  if (!message) return 'INVALID'
  if (
    message.type === 'RESUME' ||
    message.type === 'SYNCHRONIZE_SCENE' ||
    message.type === 'SUBSCRIBE_CHARACTER_SHEET' ||
    message.type === 'UNSUBSCRIBE_CHARACTER_SHEET'
  )
    return 'SYNC'
  if (message.type === 'SCENE_FOG_BEGIN' || message.type === 'SCENE_FOG_APPEND') return 'FOG_UPLOAD'
  return message.type
}

export function exceedsMessageBytes(raw: string): boolean {
  // UTF-8 uses at most 3 bytes per UTF-16 code unit, so short messages skip encoding.
  return (
    raw.length * 3 > ROOM_LIMITS.maxMessageBytes &&
    new TextEncoder().encode(raw).byteLength > ROOM_LIMITS.maxMessageBytes
  )
}

/** Token buckets per message class for one socket. */
export class SocketMessageBudget {
  readonly #buckets = new Map<keyof typeof BUDGETS, { tokens: number; updatedAt: number }>()

  take(kind: keyof typeof BUDGETS, now = Date.now()): boolean {
    const { capacity, refillPerSecond } = BUDGETS[kind]
    const bucket = this.#buckets.get(kind) ?? { tokens: capacity, updatedAt: now }
    const tokens = Math.min(
      capacity,
      bucket.tokens + ((now - bucket.updatedAt) / 1_000) * refillPerSecond
    )
    if (tokens < 1) {
      this.#buckets.set(kind, { tokens, updatedAt: now })
      return false
    }
    this.#buckets.set(kind, { tokens: tokens - 1, updatedAt: now })
    return true
  }
}

/** Bounds queued work per socket and per room. */
export class PendingWork {
  readonly #bySocket = new Map<WebSocket, number>()
  #total = 0

  constructor(
    readonly perSocket: number,
    readonly perRoom: number
  ) {}

  tryAcquire(socket: WebSocket): boolean {
    const current = this.#bySocket.get(socket) ?? 0
    if (current >= this.perSocket || this.#total >= this.perRoom) return false
    this.#bySocket.set(socket, current + 1)
    this.#total += 1
    return true
  }

  release(socket: WebSocket): void {
    const current = this.#bySocket.get(socket) ?? 0
    if (current === 0) return
    if (current === 1) this.#bySocket.delete(socket)
    else this.#bySocket.set(socket, current - 1)
    this.#total -= 1
  }
}
