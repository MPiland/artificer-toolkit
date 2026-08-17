import type { LiveSessionConflictKey } from './conflictKeys.js'

export type LiveSessionJournalStatus =
  | 'PENDING'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'COMMITTED'
  | 'REJECTED'

interface RoomMetaRow extends Record<string, SqlStorageValue> {
  authority_id: string
  authority_renewal_at: number | null
  authority_renewal_blocked: number
  authority_user_id: string | null
  campaign_id: string
  delivery_sequence: number
  next_accepted_sequence: number
  release_at: number | null
  session_id: string
  snapshot_json: string | null
}

interface CommandRow extends Record<string, SqlStorageValue> {
  accepted_sequence: number
  actor_role: 'OWNER' | 'PLAYER'
  actor_user_id: string
  attempts: number
  command_id: string
  conflict_keys_json: string
  delivery_sequence: number | null
  fingerprint: string
  next_attempt_at: number
  origin_socket_id: string
  payload_json: string
  rejection_json: string | null
  result_json: string | null
  status: LiveSessionJournalStatus
}

export interface LiveSessionRoomMeta {
  authorityId: string
  authorityRenewalAt: number | null
  authorityRenewalBlocked: boolean
  authorityUserId: string | null
  campaignId: string
  deliverySequence: number
  nextAcceptedSequence: number
  releaseAt: number | null
  sessionId: string
  snapshotJson: string | null
}

export interface LiveSessionJournalCommand {
  acceptedSequence: number
  actorRole: 'OWNER' | 'PLAYER'
  actorUserId: string
  attempts: number
  commandId: string
  conflictKeys: LiveSessionConflictKey[]
  deliverySequence: number | null
  fingerprint: string
  nextAttemptAt: number
  originSocketId: string
  payloadJson: string
  rejectionJson: string | null
  resultJson: string | null
  status: LiveSessionJournalStatus
}

export interface AcceptLiveSessionCommandInput {
  actorRole: 'OWNER' | 'PLAYER'
  actorUserId: string
  commandId: string
  conflictKeys: readonly LiveSessionConflictKey[]
  fingerprint: string
  originSocketId: string
  payloadJson: string
}

interface LiveSessionRoomJournalOptions {
  terminalCommandLimit?: number
}

export const LIVE_SESSION_COMMAND_INBOX_TERMINAL_LIMIT = 10_000

function commandFromRow(row: CommandRow): LiveSessionJournalCommand {
  return {
    acceptedSequence: row.accepted_sequence,
    actorRole: row.actor_role,
    actorUserId: row.actor_user_id,
    attempts: row.attempts,
    commandId: row.command_id,
    conflictKeys: JSON.parse(row.conflict_keys_json) as LiveSessionConflictKey[],
    deliverySequence: row.delivery_sequence,
    fingerprint: row.fingerprint,
    nextAttemptAt: row.next_attempt_at,
    originSocketId: row.origin_socket_id,
    payloadJson: row.payload_json,
    rejectionJson: row.rejection_json,
    resultJson: row.result_json,
    status: row.status
  }
}

export class LiveSessionRoomJournal {
  readonly #storage: DurableObjectStorage
  readonly #terminalCommandLimit: number

  constructor(storage: DurableObjectStorage, options: LiveSessionRoomJournalOptions = {}) {
    this.#storage = storage
    this.#terminalCommandLimit =
      options.terminalCommandLimit ?? LIVE_SESSION_COMMAND_INBOX_TERMINAL_LIMIT
    if (!Number.isInteger(this.#terminalCommandLimit) || this.#terminalCommandLimit < 0) {
      throw new Error('The live-session terminal command limit must be a nonnegative integer.')
    }
    storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        authority_id TEXT NOT NULL,
        authority_renewal_at INTEGER,
        authority_renewal_blocked INTEGER NOT NULL DEFAULT 0 CHECK (authority_renewal_blocked IN (0, 1)),
        authority_user_id TEXT,
        campaign_id TEXT NOT NULL,
        delivery_sequence INTEGER NOT NULL DEFAULT 0,
        next_accepted_sequence INTEGER NOT NULL DEFAULT 1,
        release_at INTEGER,
        session_id TEXT NOT NULL,
        snapshot_json TEXT
      );
      CREATE TABLE IF NOT EXISTS used_tickets (
        jti TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS command_inbox (
        command_id TEXT PRIMARY KEY,
        accepted_sequence INTEGER NOT NULL UNIQUE,
        actor_user_id TEXT NOT NULL,
        actor_role TEXT NOT NULL CHECK (actor_role IN ('OWNER', 'PLAYER')),
        origin_socket_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        conflict_keys_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'EXECUTING', 'COMPLETED', 'COMMITTED', 'REJECTED')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL DEFAULT 0,
        result_json TEXT,
        rejection_json TEXT,
        delivery_sequence INTEGER
      );
      CREATE INDEX IF NOT EXISTS command_inbox_status_retry_idx
        ON command_inbox(status, next_attempt_at, accepted_sequence);
      UPDATE command_inbox SET status = 'PENDING' WHERE status = 'EXECUTING';
    `)
    const roomMetaColumns = storage.sql
      .exec<{ name: string }>('PRAGMA table_info(room_meta)')
      .toArray()
    if (!roomMetaColumns.some((column) => column.name === 'authority_renewal_at')) {
      storage.sql.exec('ALTER TABLE room_meta ADD COLUMN authority_renewal_at INTEGER')
    }
    if (!roomMetaColumns.some((column) => column.name === 'authority_renewal_blocked')) {
      storage.sql.exec(
        `ALTER TABLE room_meta
         ADD COLUMN authority_renewal_blocked INTEGER NOT NULL DEFAULT 0
         CHECK (authority_renewal_blocked IN (0, 1))`
      )
    }
  }

  loadMeta(): LiveSessionRoomMeta | null {
    const row = this.#storage.sql
      .exec<RoomMetaRow>('SELECT * FROM room_meta WHERE id = 1')
      .toArray()[0]
    return row
      ? {
          authorityId: row.authority_id,
          authorityRenewalAt: row.authority_renewal_at,
          authorityRenewalBlocked: row.authority_renewal_blocked === 1,
          authorityUserId: row.authority_user_id,
          campaignId: row.campaign_id,
          deliverySequence: row.delivery_sequence,
          nextAcceptedSequence: row.next_accepted_sequence,
          releaseAt: row.release_at,
          sessionId: row.session_id,
          snapshotJson: row.snapshot_json
        }
      : null
  }

  ensureRoomIdentity(input: {
    authorityId: string
    campaignId: string
    sessionId: string
  }): LiveSessionRoomMeta {
    return this.#storage.transactionSync(() => {
      this.#storage.sql.exec(
        `INSERT OR IGNORE INTO room_meta
          (id, authority_id, campaign_id, session_id)
         VALUES (1, ?, ?, ?)`,
        input.authorityId,
        input.campaignId,
        input.sessionId
      )
      const meta = this.loadMeta()
      if (!meta || meta.campaignId !== input.campaignId || meta.sessionId !== input.sessionId) {
        throw new Error('Durable Object room identity does not match the live-session ticket.')
      }
      return meta
    })
  }

  consumeTicket(jti: string, expiresAt: number, now: number): boolean {
    return this.#storage.transactionSync(() => {
      this.#storage.sql.exec('DELETE FROM used_tickets WHERE expires_at < ?', now)
      const existing = this.#storage.sql
        .exec<{ jti: string }>('SELECT jti FROM used_tickets WHERE jti = ?', jti)
        .toArray()[0]
      if (existing) return false
      this.#storage.sql.exec(
        'INSERT INTO used_tickets (jti, expires_at) VALUES (?, ?)',
        jti,
        expiresAt
      )
      return true
    })
  }

  removeTicket(jti: string): void {
    this.#storage.sql.exec('DELETE FROM used_tickets WHERE jti = ?', jti)
  }

  hydrateAuthority(input: { renewalAt: number; snapshotJson: string; userId: string }): void {
    this.#storage.sql.exec(
      `UPDATE room_meta
       SET authority_renewal_at = ?, authority_renewal_blocked = 0,
           authority_user_id = ?, snapshot_json = ?
       WHERE id = 1`,
      input.renewalAt,
      input.userId,
      input.snapshotJson
    )
  }

  resetAuthority(authorityId: string): void {
    this.#storage.sql.exec(
      `UPDATE room_meta
       SET authority_id = ?, authority_renewal_at = NULL, authority_renewal_blocked = 0,
           authority_user_id = NULL, release_at = NULL, snapshot_json = NULL
       WHERE id = 1`,
      authorityId
    )
  }

  setAuthorityRenewal(renewalAt: number | null, blocked = false): void {
    this.#storage.sql.exec(
      `UPDATE room_meta
       SET authority_renewal_at = ?, authority_renewal_blocked = ?
       WHERE id = 1`,
      renewalAt,
      blocked ? 1 : 0
    )
  }

  setRenewedAuthority(userId: string, renewalAt: number): void {
    this.#storage.sql.exec(
      `UPDATE room_meta
       SET authority_renewal_at = ?, authority_renewal_blocked = 0, authority_user_id = ?
       WHERE id = 1`,
      renewalAt,
      userId
    )
  }

  setReleaseAt(releaseAt: number | null): void {
    this.#storage.sql.exec('UPDATE room_meta SET release_at = ? WHERE id = 1', releaseAt)
  }

  acceptCommand(input: AcceptLiveSessionCommandInput): LiveSessionJournalCommand {
    return this.#storage.transactionSync(() => {
      const existing = this.findCommand(input.commandId)
      if (existing) return existing
      const meta = this.loadMeta()
      if (!meta) throw new Error('The live-session room has not been initialized.')
      const acceptedSequence = meta.nextAcceptedSequence
      this.#storage.sql.exec(
        `INSERT INTO command_inbox (
          command_id, accepted_sequence, actor_user_id, actor_role, origin_socket_id,
          fingerprint, payload_json, conflict_keys_json, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        input.commandId,
        acceptedSequence,
        input.actorUserId,
        input.actorRole,
        input.originSocketId,
        input.fingerprint,
        input.payloadJson,
        JSON.stringify(input.conflictKeys)
      )
      this.#storage.sql.exec(
        'UPDATE room_meta SET next_accepted_sequence = ? WHERE id = 1',
        acceptedSequence + 1
      )
      const accepted = this.findCommand(input.commandId)
      if (!accepted) throw new Error('The accepted live-session command was not persisted.')
      return accepted
    })
  }

  findCommand(commandId: string): LiveSessionJournalCommand | null {
    const row = this.#storage.sql
      .exec<CommandRow>('SELECT * FROM command_inbox WHERE command_id = ?', commandId)
      .toArray()[0]
    return row ? commandFromRow(row) : null
  }

  listPending(): LiveSessionJournalCommand[] {
    return this.#storage.sql
      .exec<CommandRow>(
        `SELECT * FROM command_inbox
         WHERE status = 'PENDING'
         ORDER BY accepted_sequence`
      )
      .toArray()
      .map(commandFromRow)
  }

  listCompleted(): LiveSessionJournalCommand[] {
    return this.#storage.sql
      .exec<CommandRow>(
        `SELECT * FROM command_inbox
         WHERE status = 'COMPLETED'
         ORDER BY accepted_sequence`
      )
      .toArray()
      .map(commandFromRow)
  }

  listByIds(commandIds: readonly string[]): LiveSessionJournalCommand[] {
    return commandIds.flatMap((commandId) => {
      const command = this.findCommand(commandId)
      return command ? [command] : []
    })
  }

  markExecuting(commandId: string): void {
    this.#storage.sql.exec(
      `UPDATE command_inbox
       SET status = 'EXECUTING', attempts = attempts + 1
       WHERE command_id = ? AND status = 'PENDING'`,
      commandId
    )
  }

  markCompleted(commandId: string, resultJson: string, authorityRenewalAt: number): void {
    this.#storage.transactionSync(() => {
      this.#storage.sql.exec(
        `UPDATE command_inbox
         SET status = 'COMPLETED', result_json = ?, rejection_json = NULL
         WHERE command_id = ?`,
        resultJson,
        commandId
      )
      this.setAuthorityRenewal(authorityRenewalAt)
    })
  }

  markPending(commandId: string, nextAttemptAt: number): void {
    this.#storage.sql.exec(
      `UPDATE command_inbox
       SET status = 'PENDING', next_attempt_at = ?
       WHERE command_id = ?`,
      nextAttemptAt,
      commandId
    )
  }

  markRejected(commandId: string, rejectionJson: string): void {
    this.#storage.transactionSync(() => {
      this.#storage.sql.exec(
        `UPDATE command_inbox
         SET status = 'REJECTED', rejection_json = ?
         WHERE command_id = ?`,
        rejectionJson,
        commandId
      )
      this.#pruneTerminalCommands()
    })
  }

  commitDelivery(commandId: string, deliverySequence: number, snapshotJson: string): void {
    this.#storage.transactionSync(() => {
      this.#storage.sql.exec(
        `UPDATE command_inbox
         SET status = 'COMMITTED', delivery_sequence = ?
         WHERE command_id = ? AND status = 'COMPLETED'`,
        deliverySequence,
        commandId
      )
      this.#storage.sql.exec(
        `UPDATE room_meta
         SET delivery_sequence = ?, snapshot_json = ?
         WHERE id = 1`,
        deliverySequence,
        snapshotJson
      )
      this.#pruneTerminalCommands()
    })
  }

  #pruneTerminalCommands(): void {
    this.#storage.sql.exec(
      `DELETE FROM command_inbox
       WHERE command_id IN (
         SELECT command_id
         FROM command_inbox
         WHERE status IN ('COMMITTED', 'REJECTED')
         ORDER BY accepted_sequence DESC
         LIMIT -1 OFFSET ?
       )`,
      this.#terminalCommandLimit
    )
  }

  activeWorkCount(): number {
    return (
      this.#storage.sql
        .exec<{ count: number }>(
          `SELECT COUNT(*) AS count FROM command_inbox
           WHERE status IN ('PENDING', 'EXECUTING', 'COMPLETED')`
        )
        .toArray()[0]?.count ?? 0
    )
  }

  nextRetryAt(now: number): number | null {
    return (
      this.#storage.sql
        .exec<{ next_retry_at: number | null }>(
          `SELECT MIN(next_attempt_at) AS next_retry_at
           FROM command_inbox WHERE status = 'PENDING' AND next_attempt_at > ?`,
          now
        )
        .toArray()[0]?.next_retry_at ?? null
    )
  }
}
