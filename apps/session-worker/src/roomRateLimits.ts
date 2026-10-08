import { ACCOUNT_BUCKETS } from './roomLimits.js'

export type AccountBucketKind = keyof typeof ACCOUNT_BUCKETS

/** The account is over its D72 allowance; the command is refused before it commits. */
export class RoomRateLimitedError extends Error {
  constructor() {
    super('You are sending too fast; wait a moment and try again.')
  }
}

/**
 * D72 per-account token buckets in room SQLite. Charges run inside the command's durable commit,
 * so a refused or rolled-back command is never charged, and a reconnect never resets a bucket.
 * Rows belong to one authority epoch: they survive recovery within it and a new epoch discards them.
 */
export class RoomAccountBuckets {
  readonly #sql: SqlStorage

  constructor(sql: SqlStorage) {
    this.#sql = sql
    sql.exec(`
      CREATE TABLE IF NOT EXISTS room_account_buckets (
        epoch TEXT NOT NULL,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        tokens REAL NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (epoch, user_id, kind)
      )
    `)
  }

  /** Whether one more charge would be admitted; reads without consuming. */
  admits(scope: BucketScope, now = Date.now()): boolean {
    return this.#refilled(scope, now) >= 1
  }

  /** Consumes one token, or throws RoomRateLimitedError without changing the bucket. */
  charge(scope: BucketScope, now = Date.now()): void {
    if (!this.admits(scope, now)) throw new RoomRateLimitedError()
    this.#sql.exec(
      `INSERT INTO room_account_buckets (epoch, user_id, kind, tokens, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (epoch, user_id, kind) DO UPDATE SET tokens = excluded.tokens, updated_at = excluded.updated_at`,
      scope.epoch,
      scope.userId,
      scope.kind,
      this.#refilled(scope, now) - 1,
      now
    )
  }

  /** Eviction and account deletion remove the account's buckets. */
  deleteUser(userId: string): void {
    this.#sql.exec('DELETE FROM room_account_buckets WHERE user_id = ?', userId)
  }

  /** Room cleanup, and the rows of an epoch that is no longer current. */
  clear(exceptEpoch: string | null = null): void {
    if (exceptEpoch === null) this.#sql.exec('DELETE FROM room_account_buckets')
    else this.#sql.exec('DELETE FROM room_account_buckets WHERE epoch != ?', exceptEpoch)
  }

  #refilled(scope: BucketScope, now: number): number {
    const { capacity, refillPerMinute } = ACCOUNT_BUCKETS[scope.kind][scope.role]
    const [row] = this.#sql
      .exec<{ tokens: number; updated_at: number }>(
        'SELECT tokens, updated_at FROM room_account_buckets WHERE epoch = ? AND user_id = ? AND kind = ?',
        scope.epoch,
        scope.userId,
        scope.kind
      )
      .toArray()
    if (!row) return capacity
    return Math.min(
      capacity,
      row.tokens + (Math.max(0, now - row.updated_at) / 60_000) * refillPerMinute
    )
  }
}

interface BucketScope {
  epoch: string
  kind: AccountBucketKind
  role: 'OWNER' | 'PLAYER'
  userId: string
}
