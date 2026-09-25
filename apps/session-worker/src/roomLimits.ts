import type { LiveSessionWebSocketClientMessageDto } from '@artificer-toolkit/schema/api/liveSessions'

/** Room-side flood limits; see "Security and limits" in docs/architecture/live-sessions.md. */
export const ROOM_LIMITS = {
  maxMessageBytes: 64 * 1024,
  maxSocketsPerUser: 4,
  maxSocketsPerRoom: 64,
  authenticationTimeoutMs: 10_000,
  maxPendingCommandsPerSocket: 8,
  maxPendingCommandsPerRoom: 64,
  maxPendingTransientsPerSocket: 32,
  authorityCaptureTtlMs: 2_000
} as const

type MessageClass = 'AUTHENTICATE' | 'COMMAND' | 'INVALID' | 'SYNC' | 'TRANSIENT'

// Clients throttle each preview stream to ~31 Hz and re-authenticate only on connect or challenge.
const BUDGETS: Record<MessageClass, { capacity: number; refillPerSecond: number }> = {
  AUTHENTICATE: { capacity: 10, refillPerSecond: 0.5 },
  COMMAND: { capacity: 20, refillPerSecond: 5 },
  INVALID: { capacity: 5, refillPerSecond: 0.5 },
  SYNC: { capacity: 20, refillPerSecond: 2 },
  TRANSIENT: { capacity: 200, refillPerSecond: 100 }
}

export function messageClass(message: LiveSessionWebSocketClientMessageDto | null): MessageClass {
  if (!message) return 'INVALID'
  if (message.type === 'RESUME' || message.type === 'SYNCHRONIZE_SCENE') return 'SYNC'
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
  readonly #buckets = new Map<MessageClass, { tokens: number; updatedAt: number }>()

  take(kind: MessageClass, now = Date.now()): boolean {
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
