import type { LiveSessionRoomCommandDurability } from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'

export const MAX_DURABLE_COMMAND_JSON_BYTES = 1_000_000
export const MAX_DURABLE_OUTBOX_BATCH_COUNT = 100

const MAX_LEGACY_DURABLE_COMMAND_JSON_BYTES = 2 * 1024 * 1024
const MAX_IDENTIFIER_BYTES = 512
const MAX_CHECKSUM_BYTES = 256
const INLINE_JSON_CODE_UNITS = 256 * 1024
const CHUNK_CODE_UNITS = 128 * 1024
const textEncoder = new TextEncoder()
const jwtPattern = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

type DurableCommandJournalStatus = 'ACTIVE' | 'DRAINING' | 'RELEASED'

interface DurableCommandJournalState {
  authorityEpoch: string
  drainFinalChecksum: string | null
  drainFinalSequence: number | null
  publishedChecksum: string
  publishedSequence: number
  sequence: number
  stateChecksum: string
  stateJson: string
  status: DurableCommandJournalStatus
}

interface DurableCommandReceipt extends LiveSessionRoomCommandDurability {
  actorId: string
  commandId: string
  fingerprint: string
  receiptJson: string
  sequence: number
  stateChecksum: string
}

interface DurableCommandOutboxEntry {
  payloadJson: string
  sequence: number
  stateChecksum: string
}

type DurableCommandLookup =
  | { kind: 'MISSING' }
  | { kind: 'MISMATCHED_REUSE' }
  | { kind: 'REPLAY'; receipt: DurableCommandReceipt }

type DurableCommandCommitResult =
  | { kind: 'COMMITTED'; receipt: DurableCommandReceipt; state: DurableCommandJournalState }
  | { kind: 'REPLAY'; receipt: DurableCommandReceipt }

type DurableCommandJournalErrorCode =
  | 'AUTHORITY_MISMATCH'
  | 'COMMAND_ID_REUSE'
  | 'CORRUPT_JOURNAL'
  | 'DRAIN_IN_PROGRESS'
  | 'INVALID_ACKNOWLEDGEMENT'
  | 'INVALID_INPUT'
  | 'NOT_ACTIVATED'
  | 'NOT_DRAINING'
  | 'RELEASE_BLOCKED'
  | 'STALE_STATE'

export class DurableCommandJournalError extends Error {
  constructor(
    readonly code: DurableCommandJournalErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'DurableCommandJournalError'
  }
}

interface AuthorityRow extends Record<string, SqlStorageValue> {
  authority_epoch: string
  drain_final_checksum: string | null
  drain_final_sequence: number | null
  published_checksum: string
  published_sequence: number
  sequence: number
  state_checksum: string
  state_json: string
  status: string
}

interface ReceiptRow extends Record<string, SqlStorageValue> {
  actor_id: string
  checkpoint_before_ack: number
  command_id: string
  fingerprint: string
  receipt_json: string
  sequence: number
  state_checksum: string
}

interface OutboxRow extends Record<string, SqlStorageValue> {
  payload_json: string
  sequence: number
  state_checksum: string
}

interface JsonChunkRow extends Record<string, SqlStorageValue> {
  part_count: number
  part_index: number
  text: string
}

function fail(code: DurableCommandJournalErrorCode, message: string): never {
  throw new DurableCommandJournalError(code, message)
}

function assertBoundedText(name: string, value: string, maximumBytes: number): void {
  if (value.length === 0 || textEncoder.encode(value).byteLength > maximumBytes)
    fail('INVALID_INPUT', `${name} is empty or exceeds ${maximumBytes} bytes.`)
}

function containsJwt(value: unknown): boolean {
  const pending: unknown[] = [value]
  while (pending.length > 0) {
    const current = pending.pop()
    if (typeof current === 'string') {
      if (jwtPattern.test(current)) return true
    } else if (Array.isArray(current)) pending.push(...current)
    else if (typeof current === 'object' && current !== null)
      pending.push(...Object.values(current))
  }
  return false
}

function assertJson(
  name: string,
  value: string,
  maximumBytes = MAX_DURABLE_COMMAND_JSON_BYTES
): void {
  assertBoundedText(name, value, maximumBytes)
  assertJsonContents(name, value)
}

// State and undo JSON are bounded by the Scene schema and may span multiple SQLite rows.
function assertJsonContents(name: string, value: string): void {
  if (value.length === 0) fail('INVALID_INPUT', `${name} is empty.`)
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    fail('INVALID_INPUT', `${name} is not valid JSON.`)
  }
  if (containsJwt(parsed)) fail('INVALID_INPUT', `${name} must not contain a JWT.`)
}

function readStoredJson(
  storage: DurableObjectStorage,
  documentKey: string,
  inline: string
): string {
  if (inline !== '') return inline
  const rows = storage.sql
    .exec<JsonChunkRow>(
      `SELECT part_index, part_count, text FROM durable_command_json_chunks
       WHERE document_key = ? ORDER BY part_index`,
      documentKey
    )
    .toArray()
  const count = rows[0]?.part_count
  if (count === undefined || !Number.isSafeInteger(count) || count < 1 || rows.length !== count)
    fail('CORRUPT_JOURNAL', 'The durable command JSON chunks are incomplete.')
  for (const [index, row] of rows.entries()) {
    if (
      row.part_index !== index ||
      row.part_count !== count ||
      row.text.length === 0 ||
      row.text.length > CHUNK_CODE_UNITS
    )
      fail('CORRUPT_JOURNAL', 'The durable command JSON chunks are inconsistent.')
  }
  return rows.map((row) => row.text).join('')
}

// Called only inside the activation or commit transaction.
function writeStoredJson(
  storage: DurableObjectStorage,
  documentKey: string,
  value: string
): string {
  storage.sql.exec('DELETE FROM durable_command_json_chunks WHERE document_key = ?', documentKey)
  if (value.length <= INLINE_JSON_CODE_UNITS) return value
  const chunks: string[] = []
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + CHUNK_CODE_UNITS, value.length)
    const lastCodeUnit = value.charCodeAt(end - 1)
    if (end < value.length && lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end -= 1
    chunks.push(value.slice(start, end))
    start = end
  }
  for (const [index, chunk] of chunks.entries())
    storage.sql.exec(
      `INSERT INTO durable_command_json_chunks (document_key, part_index, part_count, text)
       VALUES (?, ?, ?, ?)`,
      documentKey,
      index,
      chunks.length,
      chunk
    )
  return ''
}

function assertIdentifier(name: string, value: string): void {
  assertBoundedText(name, value, MAX_IDENTIFIER_BYTES)
}

function assertChecksum(name: string, value: string): void {
  assertBoundedText(name, value, MAX_CHECKSUM_BYTES)
}

function assertSequence(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0)
    fail('INVALID_INPUT', `${name} must be a nonnegative safe integer.`)
}

function stateFromRow(
  row: AuthorityRow,
  storage: DurableObjectStorage
): DurableCommandJournalState {
  if (!['ACTIVE', 'DRAINING', 'RELEASED'].includes(row.status))
    fail('CORRUPT_JOURNAL', 'The durable command journal has an invalid status.')
  assertSequence('stored sequence', row.sequence)
  assertSequence('stored published sequence', row.published_sequence)
  if (row.published_sequence > row.sequence)
    fail('CORRUPT_JOURNAL', 'The published sequence is ahead of the durable state.')
  if ((row.drain_final_sequence === null) !== (row.drain_final_checksum === null))
    fail('CORRUPT_JOURNAL', 'The durable command drain fence is incomplete.')
  if (row.drain_final_sequence !== null)
    assertSequence('stored drain sequence', row.drain_final_sequence)
  assertIdentifier('stored authority epoch', row.authority_epoch)
  assertChecksum('stored state checksum', row.state_checksum)
  assertChecksum('stored published checksum', row.published_checksum)
  const stateJson = readStoredJson(storage, 'state', row.state_json)
  assertJsonContents('stored state', stateJson)
  return {
    authorityEpoch: row.authority_epoch,
    drainFinalChecksum: row.drain_final_checksum,
    drainFinalSequence: row.drain_final_sequence,
    publishedChecksum: row.published_checksum,
    publishedSequence: row.published_sequence,
    sequence: row.sequence,
    stateChecksum: row.state_checksum,
    stateJson,
    status: row.status as DurableCommandJournalStatus
  }
}

function receiptFromRow(row: ReceiptRow): DurableCommandReceipt {
  if (row.checkpoint_before_ack !== 0 && row.checkpoint_before_ack !== 1)
    fail('CORRUPT_JOURNAL', 'The durable command receipt has an invalid acknowledgement fence.')
  assertIdentifier('stored actor ID', row.actor_id)
  assertIdentifier('stored command ID', row.command_id)
  assertIdentifier('stored command fingerprint', row.fingerprint)
  assertSequence('stored receipt sequence', row.sequence)
  assertChecksum('stored receipt state checksum', row.state_checksum)
  assertJson('stored receipt', row.receipt_json, MAX_LEGACY_DURABLE_COMMAND_JSON_BYTES)
  return {
    actorId: row.actor_id,
    checkpointBeforeAcknowledgement: row.checkpoint_before_ack === 1,
    commandId: row.command_id,
    fingerprint: row.fingerprint,
    receiptJson: row.receipt_json,
    sequence: row.sequence,
    stateChecksum: row.state_checksum
  }
}

export class DurableCommandJournal {
  constructor(private readonly storage: DurableObjectStorage) {
    storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS durable_session_authority (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        authority_epoch TEXT NOT NULL,
        state_checksum TEXT NOT NULL,
        state_json TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK (sequence >= 0),
        published_sequence INTEGER NOT NULL CHECK (published_sequence >= 0),
        published_checksum TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DRAINING', 'RELEASED')),
        drain_final_sequence INTEGER,
        drain_final_checksum TEXT,
        CHECK ((drain_final_sequence IS NULL) = (drain_final_checksum IS NULL))
      );
      CREATE TABLE IF NOT EXISTS durable_command_receipts (
        command_id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        sequence INTEGER NOT NULL UNIQUE CHECK (sequence > 0),
        state_checksum TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        checkpoint_before_ack INTEGER NOT NULL DEFAULT 0 CHECK (checkpoint_before_ack IN (0, 1))
      );
      CREATE TABLE IF NOT EXISTS durable_command_outbox (
        sequence INTEGER PRIMARY KEY CHECK (sequence > 0),
        state_checksum TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS durable_command_json_chunks (
        document_key TEXT NOT NULL,
        part_index INTEGER NOT NULL CHECK (part_index >= 0),
        part_count INTEGER NOT NULL CHECK (part_count > 0),
        text TEXT NOT NULL,
        PRIMARY KEY (document_key, part_index),
        CHECK (part_index < part_count)
      );
    `)
    const receiptColumns = storage.sql
      .exec<{ name: string }>("SELECT name FROM pragma_table_info('durable_command_receipts')")
      .toArray()
    // Only the retired interval flush read the receipt time (ADR 0035 Amendment 25).
    if (receiptColumns.some((column) => column.name === 'created_at'))
      storage.sql.exec('ALTER TABLE durable_command_receipts DROP COLUMN created_at')
    if (!receiptColumns.some((column) => column.name === 'checkpoint_before_ack'))
      storage.transactionSync(() => {
        storage.sql.exec(
          'ALTER TABLE durable_command_receipts ADD COLUMN checkpoint_before_ack INTEGER NOT NULL DEFAULT 0'
        )
      })
  }

  activate(input: {
    authorityEpoch: string
    snapshotChecksum: string
    stateJson: string
  }): DurableCommandJournalState {
    assertIdentifier('authority epoch', input.authorityEpoch)
    assertChecksum('snapshot checksum', input.snapshotChecksum)
    assertJsonContents('snapshot state', input.stateJson)

    return this.storage.transactionSync(() => {
      const existing = this.#authorityRow()
      if (existing) {
        const current = stateFromRow(existing, this.storage)
        if (
          current.authorityEpoch !== input.authorityEpoch ||
          current.stateChecksum !== input.snapshotChecksum ||
          current.stateJson !== input.stateJson
        )
          fail('AUTHORITY_MISMATCH', 'The Session already has different durable authority.')
        return current
      }
      const storedStateJson = writeStoredJson(this.storage, 'state', input.stateJson)
      this.storage.sql.exec(
        `INSERT INTO durable_session_authority (
          id, authority_epoch, state_checksum, state_json, sequence,
          published_sequence, published_checksum, status
        ) VALUES (1, ?, ?, ?, 0, 0, ?, 'ACTIVE')`,
        input.authorityEpoch,
        input.snapshotChecksum,
        storedStateJson,
        input.snapshotChecksum
      )
      return this.#requiredState()
    })
  }

  /** Reads the fence even when the state JSON cannot be recovered. */
  get authorityEpoch(): string | null {
    return this.#authorityRow()?.authority_epoch ?? null
  }

  /** Called inside the replacement snapshot transaction, only after Convex fences this epoch. */
  discardFencedAuthorityInTransaction(authorityEpoch: string): undefined {
    assertIdentifier('authority epoch', authorityEpoch)
    const currentEpoch = this.authorityEpoch
    if (currentEpoch !== null && currentEpoch !== authorityEpoch)
      fail('AUTHORITY_MISMATCH', 'The recovered authority epoch is stale.')
    this.storage.sql.exec('DELETE FROM durable_session_authority')
    this.storage.sql.exec('DELETE FROM durable_command_receipts')
    this.storage.sql.exec('DELETE FROM durable_command_outbox')
    this.storage.sql.exec('DELETE FROM durable_command_json_chunks')
    return undefined
  }

  readCurrent(): DurableCommandJournalState | null {
    const row = this.#authorityRow()
    return row ? stateFromRow(row, this.storage) : null
  }

  /**
   * Discards a never-used provisional epoch, or a released one whose final state Convex already
   * holds. The caller must first obtain a replacement epoch from current Convex bootstrap authority.
   */
  discardReplaceableAuthority(authorityEpoch: string): void {
    assertIdentifier('authority epoch', authorityEpoch)
    this.storage.transactionSync(() => {
      const current = this.#requiredState()
      if (current.authorityEpoch !== authorityEpoch)
        fail('AUTHORITY_MISMATCH', 'The provisional authority epoch is stale.')
      const unused =
        current.status === 'ACTIVE' &&
        current.sequence === 0 &&
        current.publishedSequence === 0 &&
        this.storage.sql
          .exec(
            `SELECT 1 FROM durable_command_receipts
             UNION ALL SELECT 1 FROM durable_command_outbox LIMIT 1`
          )
          .toArray().length === 0
      if (!unused && current.status !== 'RELEASED')
        fail('RELEASE_BLOCKED', 'Committed Session authority cannot be discarded.')
      this.storage.sql.exec('DELETE FROM durable_session_authority WHERE id = 1')
      this.storage.sql.exec('DELETE FROM durable_command_receipts')
      this.storage.sql.exec('DELETE FROM durable_command_outbox')
      this.storage.sql.exec('DELETE FROM durable_command_json_chunks')
    })
  }

  lookupCommand(input: {
    actorId: string
    commandId: string
    fingerprint: string
  }): DurableCommandLookup {
    assertIdentifier('actor ID', input.actorId)
    assertIdentifier('command ID', input.commandId)
    assertIdentifier('command fingerprint', input.fingerprint)
    const row = this.#receiptRow(input.commandId)
    if (!row) return { kind: 'MISSING' }
    if (row.actor_id !== input.actorId || row.fingerprint !== input.fingerprint)
      return { kind: 'MISMATCHED_REUSE' }
    return { kind: 'REPLAY', receipt: receiptFromRow(row) }
  }

  commit(input: {
    actorId: string
    authorityEpoch: string
    checkpointBeforeAcknowledgement?: LiveSessionRoomCommandDurability['checkpointBeforeAcknowledgement']
    commandId: string
    expectedSequence: number
    expectedStateChecksum: string
    fingerprint: string
    nextStateChecksum: string
    nextStateJson: string
    /** Omit when RoomEncounterStore supplies the checkpoint publication write set. */
    outboxPayloadJson?: string
    receiptJson: string
  }): DurableCommandCommitResult {
    return this.storage.transactionSync(() => this.commitInTransaction(input))
  }

  /**
   * Shares RoomEncounterStore's SQLite transaction with its write set. The caller must already
   * hold storage.transactionSync; memory is published only after this method and the log commit.
   */
  commitInTransaction(
    input: Parameters<DurableCommandJournal['commit']>[0]
  ): DurableCommandCommitResult {
    assertIdentifier('actor ID', input.actorId)
    assertIdentifier('authority epoch', input.authorityEpoch)
    assertIdentifier('command ID', input.commandId)
    assertIdentifier('command fingerprint', input.fingerprint)
    assertSequence('expected sequence', input.expectedSequence)
    assertChecksum('expected state checksum', input.expectedStateChecksum)
    const existing = this.#receiptRow(input.commandId)
    if (existing) {
      if (existing.actor_id !== input.actorId || existing.fingerprint !== input.fingerprint)
        fail('COMMAND_ID_REUSE', 'The command ID was reused with different command input.')
      return { kind: 'REPLAY', receipt: receiptFromRow(existing) }
    }

    assertChecksum('next state checksum', input.nextStateChecksum)
    assertJsonContents('next state', input.nextStateJson)
    assertJson('command receipt', input.receiptJson)
    if (input.outboxPayloadJson !== undefined) assertJson('outbox payload', input.outboxPayloadJson)
    const checkpointBeforeAcknowledgement =
      input.checkpointBeforeAcknowledgement === undefined
        ? false
        : input.checkpointBeforeAcknowledgement
    if (typeof checkpointBeforeAcknowledgement !== 'boolean')
      fail('INVALID_INPUT', 'The command acknowledgement fence must be a boolean.')

    const authorityRow = this.#authorityRow()
    if (!authorityRow) fail('NOT_ACTIVATED', 'The durable Session authority is not active.')
    const current = stateFromRow(authorityRow, this.storage)
    if (current.authorityEpoch !== input.authorityEpoch)
      fail('AUTHORITY_MISMATCH', 'The command authority epoch is stale.')
    if (current.status !== 'ACTIVE')
      fail('DRAIN_IN_PROGRESS', 'The Session authority is no longer accepting commands.')
    if (
      current.sequence !== input.expectedSequence ||
      current.stateChecksum !== input.expectedStateChecksum
    )
      fail('STALE_STATE', 'The command was prepared from stale Session state.')
    if (current.sequence === Number.MAX_SAFE_INTEGER)
      fail('CORRUPT_JOURNAL', 'The durable command sequence is exhausted.')
    const sequence = current.sequence + 1
    const storedStateJson =
      input.nextStateJson === current.stateJson
        ? authorityRow.state_json
        : writeStoredJson(this.storage, 'state', input.nextStateJson)

    this.storage.sql.exec(
      `UPDATE durable_session_authority
         SET state_checksum = ?, state_json = ?, sequence = ?
         WHERE id = 1`,
      input.nextStateChecksum,
      storedStateJson,
      sequence
    )
    this.storage.sql.exec(
      `INSERT INTO durable_command_receipts (
          command_id, actor_id, fingerprint, sequence, state_checksum, receipt_json,
          checkpoint_before_ack
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.commandId,
      input.actorId,
      input.fingerprint,
      sequence,
      input.nextStateChecksum,
      input.receiptJson,
      checkpointBeforeAcknowledgement ? 1 : 0
    )
    if (input.outboxPayloadJson !== undefined)
      this.storage.sql.exec(
        `INSERT INTO durable_command_outbox (sequence, state_checksum, payload_json)
           VALUES (?, ?, ?)`,
        sequence,
        input.nextStateChecksum,
        input.outboxPayloadJson
      )
    const receipt = this.#receiptRow(input.commandId)
    if (!receipt) fail('CORRUPT_JOURNAL', 'The committed command receipt is missing.')
    return {
      kind: 'COMMITTED',
      receipt: receiptFromRow(receipt),
      state: this.#requiredState()
    }
  }

  listPending(limit: number): DurableCommandOutboxEntry[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DURABLE_OUTBOX_BATCH_COUNT)
      fail(
        'INVALID_INPUT',
        `Outbox batch count must be between 1 and ${MAX_DURABLE_OUTBOX_BATCH_COUNT}.`
      )
    const current = this.#requiredState()
    const rows = this.storage.sql
      .exec<OutboxRow>(
        `SELECT sequence, state_checksum, payload_json
         FROM durable_command_outbox
         WHERE sequence > ?
         ORDER BY sequence
         LIMIT ?`,
        current.publishedSequence,
        limit
      )
      .toArray()
    if (current.publishedSequence < current.sequence && rows.length === 0)
      fail('CORRUPT_JOURNAL', 'The durable command outbox has a missing entry.')
    rows.forEach((row, index) => {
      if (row.sequence !== current.publishedSequence + index + 1)
        fail('CORRUPT_JOURNAL', 'The durable command outbox is not contiguous.')
      assertChecksum('stored outbox checksum', row.state_checksum)
      assertJson('stored outbox payload', row.payload_json, MAX_LEGACY_DURABLE_COMMAND_JSON_BYTES)
    })
    return rows.map((row) => ({
      payloadJson: row.payload_json,
      sequence: row.sequence,
      stateChecksum: row.state_checksum
    }))
  }

  acknowledge(input: {
    authorityEpoch: string
    stateChecksum: string
    throughSequence: number
  }): DurableCommandJournalState {
    assertIdentifier('authority epoch', input.authorityEpoch)
    assertChecksum('acknowledged state checksum', input.stateChecksum)
    assertSequence('acknowledged sequence', input.throughSequence)

    return this.storage.transactionSync(() => {
      const current = this.#requiredState()
      if (current.authorityEpoch !== input.authorityEpoch)
        fail('AUTHORITY_MISMATCH', 'The outbox acknowledgement authority epoch is stale.')
      if (input.throughSequence === current.publishedSequence) {
        if (input.stateChecksum !== current.publishedChecksum)
          fail('INVALID_ACKNOWLEDGEMENT', 'The repeated acknowledgement checksum differs.')
        return current
      }
      if (
        input.throughSequence < current.publishedSequence ||
        input.throughSequence > current.sequence
      )
        fail(
          'INVALID_ACKNOWLEDGEMENT',
          'The acknowledgement sequence is outside the pending range.'
        )
      if (input.throughSequence - current.publishedSequence > MAX_DURABLE_OUTBOX_BATCH_COUNT)
        fail('INVALID_ACKNOWLEDGEMENT', 'The acknowledgement exceeds one bounded outbox batch.')

      const rows = this.storage.sql
        .exec<OutboxRow>(
          `SELECT sequence, state_checksum, payload_json
           FROM durable_command_outbox
           WHERE sequence > ? AND sequence <= ?
           ORDER BY sequence`,
          current.publishedSequence,
          input.throughSequence
        )
        .toArray()
      const expectedCount = input.throughSequence - current.publishedSequence
      if (rows.length !== expectedCount)
        fail('CORRUPT_JOURNAL', 'The acknowledged outbox range is incomplete.')
      rows.forEach((row, index) => {
        if (row.sequence !== current.publishedSequence + index + 1)
          fail('CORRUPT_JOURNAL', 'The acknowledged outbox range is not contiguous.')
      })
      if (rows.at(-1)?.state_checksum !== input.stateChecksum)
        fail('INVALID_ACKNOWLEDGEMENT', 'The acknowledgement checksum does not match its sequence.')

      this.storage.sql.exec(
        `UPDATE durable_session_authority
         SET published_sequence = ?, published_checksum = ?
         WHERE id = 1`,
        input.throughSequence,
        input.stateChecksum
      )
      this.storage.sql.exec(
        'DELETE FROM durable_command_outbox WHERE sequence <= ?',
        input.throughSequence
      )
      return this.#requiredState()
    })
  }

  /** Acknowledges an accepted room write-set prefix using its terminal durable receipt. */
  acknowledgeCheckpoint(
    input: Parameters<DurableCommandJournal['acknowledge']>[0]
  ): DurableCommandJournalState {
    return this.storage.transactionSync(() => this.acknowledgeCheckpointInTransaction(input))
  }

  /** Shares the room snapshot compaction transaction; the caller must hold transactionSync. */
  acknowledgeCheckpointInTransaction(
    input: Parameters<DurableCommandJournal['acknowledgeCheckpoint']>[0]
  ): DurableCommandJournalState {
    assertIdentifier('authority epoch', input.authorityEpoch)
    assertChecksum('acknowledged state checksum', input.stateChecksum)
    assertSequence('acknowledged sequence', input.throughSequence)

    const current = this.#requiredState()
    if (current.authorityEpoch !== input.authorityEpoch)
      fail('AUTHORITY_MISMATCH', 'The checkpoint acknowledgement authority epoch is stale.')
    if (input.throughSequence === current.publishedSequence) {
      if (input.stateChecksum !== current.publishedChecksum)
        fail('INVALID_ACKNOWLEDGEMENT', 'The repeated acknowledgement checksum differs.')
      return current
    }
    if (
      input.throughSequence < current.publishedSequence ||
      input.throughSequence > current.sequence
    )
      fail('INVALID_ACKNOWLEDGEMENT', 'The acknowledgement sequence is outside the pending range.')
    const receipt = this.storage.sql
      .exec<{ state_checksum: string }>(
        'SELECT state_checksum FROM durable_command_receipts WHERE sequence = ?',
        input.throughSequence
      )
      .toArray()[0]
    if (!receipt) fail('CORRUPT_JOURNAL', 'The acknowledged checkpoint receipt is missing.')
    if (receipt.state_checksum !== input.stateChecksum)
      fail('INVALID_ACKNOWLEDGEMENT', 'The acknowledgement checksum does not match its sequence.')

    this.storage.sql.exec(
      `UPDATE durable_session_authority
         SET published_sequence = ?, published_checksum = ?
         WHERE id = 1`,
      input.throughSequence,
      input.stateChecksum
    )
    this.storage.sql.exec(
      'DELETE FROM durable_command_outbox WHERE sequence <= ?',
      input.throughSequence
    )
    return this.#requiredState()
  }

  beginDrain(input: {
    authorityEpoch: string
    finalSequence: number
    finalStateChecksum: string
  }): DurableCommandJournalState {
    assertIdentifier('authority epoch', input.authorityEpoch)
    assertSequence('final sequence', input.finalSequence)
    assertChecksum('final state checksum', input.finalStateChecksum)

    return this.storage.transactionSync(() => {
      const current = this.#requiredState()
      if (current.authorityEpoch !== input.authorityEpoch)
        fail('AUTHORITY_MISMATCH', 'The drain authority epoch is stale.')
      if (
        current.sequence !== input.finalSequence ||
        current.stateChecksum !== input.finalStateChecksum
      )
        fail('STALE_STATE', 'The drain fence does not match current Session state.')
      if (current.status !== 'ACTIVE') {
        if (
          current.drainFinalSequence === input.finalSequence &&
          current.drainFinalChecksum === input.finalStateChecksum
        )
          return current
        fail('DRAIN_IN_PROGRESS', 'The Session already has a different drain fence.')
      }
      this.storage.sql.exec(
        `UPDATE durable_session_authority
         SET status = 'DRAINING', drain_final_sequence = ?, drain_final_checksum = ?
         WHERE id = 1`,
        input.finalSequence,
        input.finalStateChecksum
      )
      return this.#requiredState()
    })
  }

  release(input: {
    authorityEpoch: string
    finalSequence: number
    finalStateChecksum: string
  }): DurableCommandJournalState {
    assertIdentifier('authority epoch', input.authorityEpoch)
    assertSequence('final sequence', input.finalSequence)
    assertChecksum('final state checksum', input.finalStateChecksum)

    return this.storage.transactionSync(() => {
      const current = this.#requiredState()
      if (current.authorityEpoch !== input.authorityEpoch)
        fail('AUTHORITY_MISMATCH', 'The release authority epoch is stale.')
      if (current.status === 'ACTIVE')
        fail('NOT_DRAINING', 'The Session authority must begin draining before release.')
      if (
        current.drainFinalSequence !== input.finalSequence ||
        current.drainFinalChecksum !== input.finalStateChecksum
      )
        fail('AUTHORITY_MISMATCH', 'The release does not match the durable drain fence.')
      if (current.status === 'RELEASED') return current
      if (
        current.publishedSequence !== input.finalSequence ||
        current.publishedChecksum !== input.finalStateChecksum
      )
        fail('RELEASE_BLOCKED', 'The final durable command state has not been published.')
      this.storage.sql.exec("UPDATE durable_session_authority SET status = 'RELEASED' WHERE id = 1")
      return this.#requiredState()
    })
  }

  #authorityRow(): AuthorityRow | undefined {
    return this.storage.sql
      .exec<AuthorityRow>(
        `SELECT authority_epoch, state_checksum, state_json, sequence,
                published_sequence, published_checksum, status,
                drain_final_sequence, drain_final_checksum
         FROM durable_session_authority
         WHERE id = 1`
      )
      .toArray()[0]
  }

  #receiptRow(commandId: string): ReceiptRow | undefined {
    return this.storage.sql
      .exec<ReceiptRow>(
        `SELECT command_id, actor_id, fingerprint, sequence,
                state_checksum, receipt_json, checkpoint_before_ack
         FROM durable_command_receipts
         WHERE command_id = ?`,
        commandId
      )
      .toArray()[0]
  }

  #requiredState(): DurableCommandJournalState {
    const row = this.#authorityRow()
    if (!row) fail('NOT_ACTIVATED', 'The durable Session authority is not active.')
    return stateFromRow(row, this.storage)
  }
}
