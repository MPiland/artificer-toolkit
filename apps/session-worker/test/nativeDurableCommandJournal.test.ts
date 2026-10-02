import { evictDurableObject, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect, it, vi } from 'vitest'

import {
  DurableCommandJournal,
  DurableCommandJournalError,
  MAX_DURABLE_COMMAND_JSON_BYTES,
  MAX_DURABLE_OUTBOX_BATCH_COUNT
} from '../src/durableCommandJournal.js'

function fixture() {
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`journal:${crypto.randomUUID()}`)
  )
  const authorityEpoch = crypto.randomUUID()
  const actorId = crypto.randomUUID()
  const activate = (journal: DurableCommandJournal) =>
    journal.activate({
      authorityEpoch,
      snapshotChecksum: 'checksum-0',
      stateJson: JSON.stringify({ hitPoints: 10 })
    })
  const commit = (
    journal: DurableCommandJournal,
    sequence: number,
    overrides: Partial<Parameters<DurableCommandJournal['commit']>[0]> = {}
  ) =>
    journal.commit({
      actorId,
      authorityEpoch,
      commandId: `command-${sequence}`,
      expectedSequence: sequence - 1,
      expectedStateChecksum: `checksum-${sequence - 1}`,
      fingerprint: `fingerprint-${sequence}`,
      nextStateChecksum: `checksum-${sequence}`,
      nextStateJson: JSON.stringify({ hitPoints: 10 - sequence }),
      outboxPayloadJson: JSON.stringify({ sequence }),
      receiptJson: JSON.stringify({ accepted: true, sequence }),
      ...overrides
    })
  return { activate, actorId, authorityEpoch, commit, stub }
}

function expectJournalError(code: DurableCommandJournalError['code']) {
  void code
  return DurableCommandJournalError
}

function largeUnicodeJson(label: string): string {
  return JSON.stringify({ label, scene: `a${'🧙'.repeat(550_000)}` })
}

it('has no checkpoint deadline before the authority is activated', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    expect(journal.readCurrent()).toBeNull()
    expect(journal.oldestUnpublishedCommandTime()).toBeNull()
  })
})

it('keeps the oldest unpublished receipt time through partial checkpoints and eviction', async () => {
  const test = fixture()
  const firstAt = 1_800_000_000_000
  const secondAt = firstAt + 30_000
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    test.activate(journal)
    expect(journal.oldestUnpublishedCommandTime()).toBeNull()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(firstAt)
    try {
      test.commit(journal, 1, { outboxPayloadJson: undefined })
      expect(journal.oldestUnpublishedCommandTime()).toBe(firstAt)
      clock.mockReturnValue(secondAt)
      test.commit(journal, 2, { outboxPayloadJson: undefined })
      test.commit(journal, 1, { outboxPayloadJson: undefined })
      expect(journal.oldestUnpublishedCommandTime()).toBe(firstAt)
      journal.acknowledgeCheckpoint({
        authorityEpoch: test.authorityEpoch,
        throughSequence: 1,
        stateChecksum: 'checksum-1'
      })
      expect(journal.oldestUnpublishedCommandTime()).toBe(secondAt)
      clock.mockReturnValue(secondAt + 30_000)
      test.commit(journal, 3, { outboxPayloadJson: undefined })
      expect(journal.oldestUnpublishedCommandTime()).toBe(secondAt)
    } finally {
      clock.mockRestore()
    }
  })
  await evictDurableObject(test.stub)
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    expect(journal.oldestUnpublishedCommandTime()).toBe(secondAt)
    journal.acknowledgeCheckpoint({
      authorityEpoch: test.authorityEpoch,
      throughSequence: 3,
      stateChecksum: 'checksum-3'
    })
    expect(journal.oldestUnpublishedCommandTime()).toBeNull()
  })
})

it('migrates receipt timestamps once, drops retired undo copies, and retains the recovered deadline', async () => {
  const test = fixture()
  const createdAt = 1_800_000_000_000
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    test.activate(journal)
    const committed = test.commit(journal, 1, { outboxPayloadJson: undefined })
    expect(committed.receipt.checkpointBeforeAcknowledgement).toBe(false)
    state.storage.transactionSync(() => {
      state.storage.sql.exec(`
        ALTER TABLE durable_command_receipts RENAME TO receipts_before_timestamp;
        CREATE TABLE durable_command_receipts (
          command_id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          sequence INTEGER NOT NULL UNIQUE CHECK (sequence > 0),
          state_checksum TEXT NOT NULL,
          receipt_json TEXT NOT NULL,
          undo_json TEXT
        );
        INSERT INTO durable_command_receipts
          SELECT command_id, actor_id, fingerprint, sequence, state_checksum, receipt_json, '{}'
          FROM receipts_before_timestamp;
        DROP TABLE receipts_before_timestamp;
        INSERT INTO durable_command_json_chunks VALUES ('undo:command-1', 0, 1, '{}');
      `)
    })
    const clock = vi.spyOn(Date, 'now').mockReturnValue(createdAt)
    try {
      const migrated = new DurableCommandJournal(state.storage)
      expect(migrated.oldestUnpublishedCommandTime()).toBe(createdAt)
      expect(
        state.storage.sql
          .exec<{ count: number }>(
            `SELECT (SELECT COUNT(*) FROM pragma_table_info('durable_command_receipts')
                       WHERE name = 'undo_json')
               + (SELECT COUNT(*) FROM durable_command_json_chunks
                    WHERE document_key LIKE 'undo:%') AS count`
          )
          .one().count
      ).toBe(0)
      expect(
        migrated.lookupCommand({
          actorId: test.actorId,
          commandId: 'command-1',
          fingerprint: 'fingerprint-1'
        })
      ).toEqual({ kind: 'REPLAY', receipt: committed.receipt })
      clock.mockReturnValue(createdAt + 60_000)
      expect(new DurableCommandJournal(state.storage).oldestUnpublishedCommandTime()).toBe(
        createdAt
      )
    } finally {
      clock.mockRestore()
    }
  })
  await evictDurableObject(test.stub)
  await runInDurableObject(test.stub, (_instance, state) => {
    expect(new DurableCommandJournal(state.storage).oldestUnpublishedCommandTime()).toBe(createdAt)
  })
})

it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'refuses invalid unpublished timestamp %s',
  async (createdAt) => {
    const test = fixture()
    await runInDurableObject(test.stub, (_instance, state) => {
      const journal = new DurableCommandJournal(state.storage)
      test.activate(journal)
      test.commit(journal, 1, { outboxPayloadJson: undefined })
      state.storage.sql.exec('UPDATE durable_command_receipts SET created_at = ?', createdAt)
      expect(() => journal.oldestUnpublishedCommandTime()).toThrow(
        'The unpublished command timestamp is invalid.'
      )
    })
  }
)

it('commits without an outbox and rolls back an omitted-outbox commit with its outer SQLite transaction', async () => {
  const test = fixture()
  const saved = await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    const initial = test.activate(journal)
    const input = {
      actorId: test.actorId,
      authorityEpoch: test.authorityEpoch,
      checkpointBeforeAcknowledgement: true,
      commandId: 'checkpoint-command-1',
      expectedSequence: initial.sequence,
      expectedStateChecksum: initial.stateChecksum,
      fingerprint: 'checkpoint-fingerprint-1',
      nextStateChecksum: 'a'.repeat(64),
      nextStateJson: JSON.stringify({ hitPoints: 9 }),
      receiptJson: JSON.stringify({ accepted: true, sequence: 1 })
    }
    expect(() =>
      state.storage.transactionSync(() => {
        const committed = journal.commitInTransaction(input)
        expect(committed.kind).toBe('COMMITTED')
        expect(committed.receipt.checkpointBeforeAcknowledgement).toBe(true)
        expect(
          state.storage.sql
            .exec<{ checkpoint_before_ack: number }>(
              'SELECT checkpoint_before_ack FROM durable_command_receipts WHERE command_id = ?',
              input.commandId
            )
            .one().checkpoint_before_ack
        ).toBe(1)
        expect(journal.lookupCommand(input)).toEqual({
          kind: 'REPLAY',
          receipt: committed.receipt
        })
        throw new Error('Injected failure after receipt insertion.')
      })
    ).toThrow('Injected failure after receipt insertion.')
    expect(journal.readCurrent()).toEqual(initial)
    expect(journal.lookupCommand(input)).toEqual({ kind: 'MISSING' })
    expect(
      state.storage.sql
        .exec<{ count: number }>(
          `SELECT (SELECT COUNT(*) FROM durable_command_receipts)
             + (SELECT COUNT(*) FROM durable_command_outbox) AS count`
        )
        .one().count
    ).toBe(0)
    expect(
      state.storage.sql
        .exec<{ count: number }>(
          'SELECT COUNT(*) AS count FROM durable_command_receipts WHERE checkpoint_before_ack = 1'
        )
        .one().count
    ).toBe(0)
    const committed = journal.commit(input)
    expect(committed.kind).toBe('COMMITTED')
    expect(committed.receipt.checkpointBeforeAcknowledgement).toBe(true)
    expect(journal.readCurrent()).toMatchObject({
      sequence: 1,
      stateChecksum: input.nextStateChecksum
    })
    expect(journal.commit(input)).toEqual({ kind: 'REPLAY', receipt: committed.receipt })
    expect(
      state.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
        .one().count
    ).toBe(0)
    return { input, receipt: committed.receipt, current: journal.readCurrent() }
  })
  await evictDurableObject(test.stub)
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    expect(journal.readCurrent()).toEqual(saved.current)
    expect(journal.lookupCommand(saved.input)).toEqual({ kind: 'REPLAY', receipt: saved.receipt })
  })
})

it('acknowledges more than one outbox batch from receipts without changing the live head', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    test.activate(journal)
    const throughSequence = MAX_DURABLE_OUTBOX_BATCH_COUNT + 1
    for (let sequence = 1; sequence <= throughSequence + 1; sequence++)
      test.commit(journal, sequence, { outboxPayloadJson: undefined })
    expect(
      state.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
        .one().count
    ).toBe(0)
    const before = journal.readCurrent()!
    const acknowledgement = {
      authorityEpoch: test.authorityEpoch,
      throughSequence,
      stateChecksum: `checksum-${throughSequence}`
    }
    const published = journal.acknowledgeCheckpoint(acknowledgement)
    expect(published).toEqual({
      ...before,
      publishedSequence: throughSequence,
      publishedChecksum: acknowledgement.stateChecksum
    })
    expect(journal.acknowledgeCheckpoint(acknowledgement)).toEqual(published)
    expect(() =>
      journal.acknowledgeCheckpoint({ ...acknowledgement, stateChecksum: 'wrong' })
    ).toThrow('The repeated acknowledgement checksum differs.')
    expect(() =>
      journal.acknowledgeCheckpoint({ ...acknowledgement, throughSequence: throughSequence - 1 })
    ).toThrow('The acknowledgement sequence is outside the pending range.')
    expect(() =>
      journal.acknowledgeCheckpoint({ ...acknowledgement, throughSequence: before.sequence + 1 })
    ).toThrow('The acknowledgement sequence is outside the pending range.')
    expect(() =>
      journal.acknowledgeCheckpoint({ ...acknowledgement, authorityEpoch: 'foreign-epoch' })
    ).toThrow('The checkpoint acknowledgement authority epoch is stale.')
    for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
      expect(() =>
        journal.acknowledgeCheckpoint({ ...acknowledgement, throughSequence: invalid })
      ).toThrow(DurableCommandJournalError)
    expect(journal.readCurrent()).toEqual(published)
  })
})

it.each(['missing', 'mismatched'])(
  'rejects a %s terminal checkpoint receipt without changing state or pending publication',
  async (damage) => {
    const test = fixture()
    await runInDurableObject(test.stub, (_instance, state) => {
      const journal = new DurableCommandJournal(state.storage)
      test.activate(journal)
      test.commit(journal, 1)
      test.commit(journal, 2)
      if (damage === 'missing')
        state.storage.sql.exec('DELETE FROM durable_command_receipts WHERE sequence = 2')
      else
        state.storage.sql.exec(
          'UPDATE durable_command_receipts SET state_checksum = ? WHERE sequence = 2',
          'wrong'
        )
      const before = journal.readCurrent()
      const outbox = journal.listPending(2)
      const receipts = state.storage.sql
        .exec(
          'SELECT command_id, sequence, state_checksum FROM durable_command_receipts ORDER BY sequence'
        )
        .toArray()
      expect(() =>
        journal.acknowledgeCheckpoint({
          authorityEpoch: test.authorityEpoch,
          throughSequence: 2,
          stateChecksum: 'checksum-2'
        })
      ).toThrow(
        damage === 'missing'
          ? 'The acknowledged checkpoint receipt is missing.'
          : 'The acknowledgement checksum does not match its sequence.'
      )
      expect(journal.readCurrent()).toEqual(before)
      expect(journal.listPending(2)).toEqual(outbox)
      expect(
        state.storage.sql
          .exec(
            'SELECT command_id, sequence, state_checksum FROM durable_command_receipts ORDER BY sequence'
          )
          .toArray()
      ).toEqual(receipts)
    })
  }
)

it('retires transitional outbox rows only through the accepted checkpoint receipt', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    test.activate(journal)
    for (let sequence = 1; sequence <= 3; sequence++) test.commit(journal, sequence)
    const before = journal.readCurrent()
    const outbox = journal.listPending(3)
    const oldest = journal.oldestUnpublishedCommandTime()
    expect(() =>
      state.storage.transactionSync(() => {
        journal.acknowledgeCheckpointInTransaction({
          authorityEpoch: test.authorityEpoch,
          throughSequence: 2,
          stateChecksum: 'checksum-2'
        })
        expect(journal.readCurrent()).toMatchObject({ publishedSequence: 2 })
        expect(journal.listPending(3).map(({ sequence }) => sequence)).toEqual([3])
        throw new Error('Injected failure after checkpoint acknowledgement.')
      })
    ).toThrow('Injected failure after checkpoint acknowledgement.')
    expect(journal.readCurrent()).toEqual(before)
    expect(journal.listPending(3)).toEqual(outbox)
    expect(journal.oldestUnpublishedCommandTime()).toBe(oldest)
    expect(
      journal.acknowledgeCheckpoint({
        authorityEpoch: test.authorityEpoch,
        throughSequence: 2,
        stateChecksum: 'checksum-2'
      })
    ).toEqual({ ...before, publishedSequence: 2, publishedChecksum: 'checksum-2' })
    expect(journal.listPending(3).map(({ sequence }) => sequence)).toEqual([3])
  })
})

it('discards only an exact unused epoch and preserves committed state and replay evidence', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    const initial = journal.activate({
      authorityEpoch: test.authorityEpoch,
      snapshotChecksum: 'checksum-0',
      stateJson: largeUnicodeJson('provisional')
    })
    expect(() => journal.discardReplaceableAuthority(crypto.randomUUID())).toThrow(
      'The provisional authority epoch is stale.'
    )
    expect(journal.readCurrent()).toEqual(initial)
    journal.discardReplaceableAuthority(test.authorityEpoch)
    expect(journal.readCurrent()).toBeNull()
    expect(
      state.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_json_chunks')
        .one().count
    ).toBe(0)
    test.activate(journal)
    const committed = test.commit(journal, 1)
    if (committed.kind !== 'COMMITTED') throw new Error('Expected a fresh command commit.')
    expect(() => journal.discardReplaceableAuthority(test.authorityEpoch)).toThrow(
      'Committed Session authority cannot be discarded.'
    )
    expect(journal.readCurrent()).toEqual(committed.state)
    expect(test.commit(journal, 1)).toEqual({ kind: 'REPLAY', receipt: committed.receipt })
    expect(journal.listPending(1)).toHaveLength(1)
  })
})

it('discards a released epoch with its receipts so a fresh epoch can activate', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    test.activate(journal)
    const committed = test.commit(journal, 1)
    if (committed.kind !== 'COMMITTED') throw new Error('Expected a fresh command commit.')
    const fence = {
      authorityEpoch: test.authorityEpoch,
      finalSequence: 1,
      finalStateChecksum: 'checksum-1'
    }
    journal.beginDrain(fence)
    expect(() => journal.discardReplaceableAuthority(test.authorityEpoch)).toThrow(
      'Committed Session authority cannot be discarded.'
    )
    journal.acknowledge({
      authorityEpoch: test.authorityEpoch,
      stateChecksum: 'checksum-1',
      throughSequence: 1
    })
    journal.release(fence)
    journal.discardReplaceableAuthority(test.authorityEpoch)
    expect(journal.readCurrent()).toBeNull()
    expect(
      state.storage.sql
        .exec<{ count: number }>(
          `SELECT (SELECT COUNT(*) FROM durable_command_receipts)
             + (SELECT COUNT(*) FROM durable_command_json_chunks) AS count`
        )
        .one().count
    ).toBe(0)
    const replacementEpoch = crypto.randomUUID()
    expect(
      journal.activate({
        authorityEpoch: replacementEpoch,
        snapshotChecksum: 'checksum-0',
        stateJson: JSON.stringify({ hitPoints: 10 })
      })
    ).toMatchObject({ authorityEpoch: replacementEpoch, sequence: 0, status: 'ACTIVE' })
  })
})

it('replays an exact command, rejects mismatched reuse, and reconstructs from SQLite', async () => {
  const test = fixture()
  const committed = await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    test.activate(journal)
    const first = test.commit(journal, 1)
    const replay = test.commit(journal, 1)
    expect(first.kind).toBe('COMMITTED')
    expect(replay).toEqual({ kind: 'REPLAY', receipt: first.receipt })
    expect(
      journal.lookupCommand({
        actorId: test.actorId,
        commandId: 'command-1',
        fingerprint: 'fingerprint-1'
      })
    ).toEqual({ kind: 'REPLAY', receipt: first.receipt })
    expect(
      journal.lookupCommand({
        actorId: test.actorId,
        commandId: 'command-1',
        fingerprint: 'different'
      })
    ).toEqual({ kind: 'MISMATCHED_REUSE' })
    expect(() =>
      test.commit(journal, 1, { actorId: crypto.randomUUID(), fingerprint: 'different' })
    ).toThrowError(expectJournalError('COMMAND_ID_REUSE'))
    return first
  })

  await evictDurableObject(test.stub)
  await runInDurableObject(test.stub, (_instance, state) => {
    const reconstructed = new DurableCommandJournal(state.storage)
    expect(reconstructed.readCurrent()).toMatchObject({
      authorityEpoch: test.authorityEpoch,
      sequence: 1,
      stateChecksum: 'checksum-1',
      stateJson: JSON.stringify({ hitPoints: 9 })
    })
    expect(
      reconstructed.lookupCommand({
        actorId: test.actorId,
        commandId: 'command-1',
        fingerprint: 'fingerprint-1'
      })
    ).toEqual({ kind: 'REPLAY', receipt: committed.receipt })
  })
})

it('reads and acknowledges legacy inline receipts and outbox rows above the new write limit', async () => {
  const test = fixture()
  const legacyJson = JSON.stringify('界'.repeat(400_000))
  const legacyBytes = new TextEncoder().encode(legacyJson).byteLength
  expect(legacyBytes).toBeGreaterThan(MAX_DURABLE_COMMAND_JSON_BYTES)
  expect(legacyBytes).toBeLessThan(2_000_000)
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    test.activate(journal)
    test.commit(journal, 1)
    state.storage.sql.exec(
      'UPDATE durable_command_receipts SET receipt_json = ? WHERE command_id = ?',
      legacyJson,
      'command-1'
    )
    state.storage.sql.exec(
      'UPDATE durable_command_outbox SET payload_json = ? WHERE sequence = 1',
      legacyJson
    )
    expect(
      journal.lookupCommand({
        actorId: test.actorId,
        commandId: 'command-1',
        fingerprint: 'fingerprint-1'
      })
    ).toMatchObject({ kind: 'REPLAY', receipt: { receiptJson: legacyJson } })
    expect(test.commit(journal, 1)).toMatchObject({
      kind: 'REPLAY',
      receipt: { receiptJson: legacyJson }
    })
    expect(journal.listPending(1)[0]?.payloadJson).toBe(legacyJson)
    expect(
      journal.acknowledge({
        authorityEpoch: test.authorityEpoch,
        stateChecksum: 'checksum-1',
        throughSequence: 1
      })
    ).toMatchObject({ publishedSequence: 1 })
  })
})

it('rehydrates Unicode state JSON larger than one SQLite row through replay and drain', async () => {
  const test = fixture()
  const beforeJson = largeUnicodeJson('before')
  const afterJson = largeUnicodeJson('after')
  expect(new TextEncoder().encode(beforeJson).byteLength).toBeGreaterThan(
    MAX_DURABLE_COMMAND_JSON_BYTES
  )
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    const initial = journal.activate({
      authorityEpoch: test.authorityEpoch,
      snapshotChecksum: 'checksum-0',
      stateJson: beforeJson
    })
    expect(initial.stateJson).toBe(beforeJson)
    expect(
      state.storage.sql
        .exec<{ state_json: string }>(
          'SELECT state_json FROM durable_session_authority WHERE id = 1'
        )
        .one().state_json
    ).toBe('')
    const committed = test.commit(journal, 1, { nextStateJson: afterJson })
    if (committed.kind !== 'COMMITTED') throw new Error('Expected a fresh command commit.')
    expect(committed.state.stateJson).toBe(afterJson)
    expect(test.commit(journal, 1)).toEqual({ kind: 'REPLAY', receipt: committed.receipt })
  })
  await evictDurableObject(test.stub)
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    expect(journal.readCurrent()).toMatchObject({
      stateChecksum: 'checksum-1',
      stateJson: afterJson
    })
    expect(
      journal.lookupCommand({
        actorId: test.actorId,
        commandId: 'command-1',
        fingerprint: 'fingerprint-1'
      })
    ).toMatchObject({ kind: 'REPLAY', receipt: { commandId: 'command-1' } })
    expect(
      journal.beginDrain({
        authorityEpoch: test.authorityEpoch,
        finalSequence: 1,
        finalStateChecksum: 'checksum-1'
      })
    ).toMatchObject({ stateJson: afterJson, status: 'DRAINING' })
    journal.acknowledge({
      authorityEpoch: test.authorityEpoch,
      stateChecksum: 'checksum-1',
      throughSequence: 1
    })
    expect(
      journal.release({
        authorityEpoch: test.authorityEpoch,
        finalSequence: 1,
        finalStateChecksum: 'checksum-1'
      })
    ).toMatchObject({ stateJson: afterJson, status: 'RELEASED' })
  })
})

it('keeps unchanged chunked state untouched while changed state rewrites and recovers', async () => {
  const test = fixture()
  const beforeJson = largeUnicodeJson('unchanged')
  const afterJson = largeUnicodeJson('changed')
  const saved = await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    journal.activate({
      authorityEpoch: test.authorityEpoch,
      snapshotChecksum: 'checksum-0',
      stateJson: beforeJson
    })
    state.storage.sql.exec(`
      CREATE TRIGGER fail_test_chunk_insert
      BEFORE INSERT ON durable_command_json_chunks
      BEGIN SELECT RAISE(ABORT, 'forced chunk insertion failure'); END;
      CREATE TRIGGER fail_test_chunk_delete
      BEFORE DELETE ON durable_command_json_chunks
      BEGIN SELECT RAISE(ABORT, 'forced chunk deletion failure'); END;
    `)
    const first = test.commit(journal, 1, {
      nextStateJson: beforeJson,
      outboxPayloadJson: undefined
    })
    if (first.kind !== 'COMMITTED') throw new Error('Expected a fresh command commit.')
    expect(first.state).toMatchObject({
      sequence: 1,
      stateChecksum: 'checksum-1',
      stateJson: beforeJson
    })
    expect(() =>
      test.commit(journal, 2, {
        nextStateJson: afterJson,
        outboxPayloadJson: undefined
      })
    ).toThrow('forced chunk deletion failure')
    expect(journal.readCurrent()).toEqual(first.state)
    expect(
      journal.lookupCommand({
        actorId: test.actorId,
        commandId: 'command-2',
        fingerprint: 'fingerprint-2'
      })
    ).toEqual({ kind: 'MISSING' })
    state.storage.sql.exec(
      'DROP TRIGGER fail_test_chunk_insert; DROP TRIGGER fail_test_chunk_delete;'
    )
    const second = test.commit(journal, 2, {
      nextStateJson: afterJson,
      outboxPayloadJson: undefined
    })
    if (second.kind !== 'COMMITTED') throw new Error('Expected a fresh command commit.')
    expect(second.state.stateJson).toBe(afterJson)
    expect(
      state.storage.sql
        .exec<{ count: number }>(
          "SELECT COUNT(*) AS count FROM durable_command_json_chunks WHERE document_key = 'state'"
        )
        .one().count
    ).toBeGreaterThan(1)
    return { first: first.receipt, second: second.receipt }
  })
  await evictDurableObject(test.stub)
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    expect(journal.readCurrent()).toMatchObject({
      sequence: 2,
      stateChecksum: 'checksum-2',
      stateJson: afterJson
    })
    for (const receipt of [saved.first, saved.second])
      expect(journal.lookupCommand(receipt)).toEqual({ kind: 'REPLAY', receipt })
  })
})

it('rejects an incomplete chunked state as a corrupt journal', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    journal.activate({
      authorityEpoch: test.authorityEpoch,
      snapshotChecksum: 'checksum-0',
      stateJson: largeUnicodeJson('corrupt')
    })
    state.storage.sql.exec(
      "DELETE FROM durable_command_json_chunks WHERE document_key = 'state' AND part_index = 1"
    )
    let failure: unknown
    try {
      journal.readCurrent()
    } catch (error) {
      failure = error
    }
    expect(failure).toMatchObject({ code: 'CORRUPT_JOURNAL' })
  })
})

it('removes old state chunks when a later command writes an inline state', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    journal.activate({
      authorityEpoch: test.authorityEpoch,
      snapshotChecksum: 'checksum-0',
      stateJson: largeUnicodeJson('before-inline')
    })
    const committed = test.commit(journal, 1)
    if (committed.kind !== 'COMMITTED') throw new Error('Expected a fresh command commit.')
    expect(committed.state.stateJson).toBe(JSON.stringify({ hitPoints: 9 }))
    expect(
      state.storage.sql
        .exec<{ count: number }>(
          "SELECT COUNT(*) AS count FROM durable_command_json_chunks WHERE document_key = 'state'"
        )
        .one().count
    ).toBe(0)
    expect(
      state.storage.sql
        .exec<{ state_json: string }>(
          'SELECT state_json FROM durable_session_authority WHERE id = 1'
        )
        .one().state_json
    ).toBe(committed.state.stateJson)
  })
})

it('rolls back state, receipt, and outbox together when the transaction fails', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    const initial = journal.activate({
      authorityEpoch: test.authorityEpoch,
      snapshotChecksum: 'checksum-0',
      stateJson: largeUnicodeJson('initial')
    })
    const initialChunkCount = state.storage.sql
      .exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM durable_command_json_chunks WHERE document_key = 'state'"
      )
      .one().count
    expect(initialChunkCount).toBeGreaterThan(1)
    state.storage.sql.exec(`
      CREATE TRIGGER fail_test_outbox_insert
      BEFORE INSERT ON durable_command_outbox
      BEGIN
        SELECT RAISE(ABORT, 'forced outbox failure');
      END;
    `)
    expect(() =>
      test.commit(journal, 1, { nextStateJson: largeUnicodeJson('replacement') })
    ).toThrow()
    expect(journal.readCurrent()).toEqual(initial)
    expect(
      state.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_json_chunks')
        .one().count
    ).toBe(initialChunkCount)
    expect(
      state.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_receipts')
        .one().count
    ).toBe(0)
    expect(
      state.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM durable_command_outbox')
        .one().count
    ).toBe(0)
    state.storage.sql.exec('DROP TRIGGER fail_test_outbox_insert')
  })
})

it('returns bounded contiguous outbox batches and acknowledges exact sequence checksums', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    test.activate(journal)
    test.commit(journal, 1)
    test.commit(journal, 2)
    test.commit(journal, 3)

    expect(journal.listPending(2).map(({ sequence }) => sequence)).toEqual([1, 2])
    expect(() =>
      journal.acknowledge({
        authorityEpoch: test.authorityEpoch,
        stateChecksum: 'wrong',
        throughSequence: 2
      })
    ).toThrowError(expectJournalError('INVALID_ACKNOWLEDGEMENT'))
    expect(
      journal.acknowledge({
        authorityEpoch: test.authorityEpoch,
        stateChecksum: 'checksum-2',
        throughSequence: 2
      })
    ).toMatchObject({ publishedSequence: 2, publishedChecksum: 'checksum-2' })
    expect(journal.listPending(2).map(({ sequence }) => sequence)).toEqual([3])
    expect(
      journal.acknowledge({
        authorityEpoch: test.authorityEpoch,
        stateChecksum: 'checksum-2',
        throughSequence: 2
      })
    ).toMatchObject({ publishedSequence: 2 })

    test.commit(journal, 4)
    state.storage.sql.exec('DELETE FROM durable_command_outbox WHERE sequence = 3')
    expect(() => journal.listPending(2)).toThrowError(expectJournalError('CORRUPT_JOURNAL'))
  })
})

it('activates idempotently and rejects a different authority epoch or snapshot', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    const first = test.activate(journal)
    expect(test.activate(journal)).toEqual(first)
    expect(() =>
      journal.activate({
        authorityEpoch: crypto.randomUUID(),
        snapshotChecksum: 'checksum-0',
        stateJson: JSON.stringify({ hitPoints: 10 })
      })
    ).toThrowError(expectJournalError('AUTHORITY_MISMATCH'))
    expect(() =>
      journal.activate({
        authorityEpoch: test.authorityEpoch,
        snapshotChecksum: 'different-checksum',
        stateJson: JSON.stringify({ hitPoints: 10 })
      })
    ).toThrowError(expectJournalError('AUTHORITY_MISMATCH'))
  })
})

it('fences new commands during drain and releases only after the final publish', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    test.activate(journal)
    test.commit(journal, 1)
    expect(
      journal.beginDrain({
        authorityEpoch: test.authorityEpoch,
        finalSequence: 1,
        finalStateChecksum: 'checksum-1'
      })
    ).toMatchObject({ status: 'DRAINING', drainFinalSequence: 1 })
    expect(() => test.commit(journal, 2)).toThrowError(expectJournalError('DRAIN_IN_PROGRESS'))
    expect(() =>
      journal.release({
        authorityEpoch: test.authorityEpoch,
        finalSequence: 1,
        finalStateChecksum: 'checksum-1'
      })
    ).toThrowError(expectJournalError('RELEASE_BLOCKED'))
    journal.acknowledge({
      authorityEpoch: test.authorityEpoch,
      stateChecksum: 'checksum-1',
      throughSequence: 1
    })
    expect(
      journal.release({
        authorityEpoch: test.authorityEpoch,
        finalSequence: 1,
        finalStateChecksum: 'checksum-1'
      })
    ).toMatchObject({ status: 'RELEASED' })
  })
})

it('fails closed on oversized receipts and outbox JSON, JWTs, and unbounded batch requests', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    const journal = new DurableCommandJournal(state.storage)
    expect(() =>
      journal.activate({
        authorityEpoch: test.authorityEpoch,
        snapshotChecksum: 'checksum-0',
        stateJson: JSON.stringify({ token: 'eyJhbGciOiJIUzI1NiJ9.e30.signature' })
      })
    ).toThrowError(expectJournalError('INVALID_INPUT'))
    test.activate(journal)
    const nearRowLimitJson = JSON.stringify('界'.repeat(666_665))
    const acceptedReceiptJson = JSON.stringify('x'.repeat(MAX_DURABLE_COMMAND_JSON_BYTES - 2))
    expect(new TextEncoder().encode(nearRowLimitJson).byteLength).toBeGreaterThan(1_990_000)
    expect(new TextEncoder().encode(nearRowLimitJson).byteLength).toBeLessThan(2_000_000)
    expect(new TextEncoder().encode(acceptedReceiptJson).byteLength).toBe(
      MAX_DURABLE_COMMAND_JSON_BYTES
    )
    expect(() =>
      test.commit(journal, 1, {
        receiptJson: nearRowLimitJson
      })
    ).toThrowError(expectJournalError('INVALID_INPUT'))
    expect(() =>
      test.commit(journal, 1, {
        outboxPayloadJson: nearRowLimitJson
      })
    ).toThrowError(expectJournalError('INVALID_INPUT'))
    expect(journal.readCurrent()?.sequence).toBe(0)
    const accepted = test.commit(journal, 1, { receiptJson: acceptedReceiptJson })
    if (accepted.kind !== 'COMMITTED') throw new Error('Expected a bounded command commit.')
    expect(accepted.receipt.receiptJson).toBe(acceptedReceiptJson)
    expect(() => journal.listPending(MAX_DURABLE_OUTBOX_BATCH_COUNT + 1)).toThrowError(
      expectJournalError('INVALID_INPUT')
    )
    for (let sequence = 2; sequence <= MAX_DURABLE_OUTBOX_BATCH_COUNT + 1; sequence += 1)
      test.commit(journal, sequence)
    expect(() =>
      journal.acknowledge({
        authorityEpoch: test.authorityEpoch,
        stateChecksum: `checksum-${MAX_DURABLE_OUTBOX_BATCH_COUNT + 1}`,
        throughSequence: MAX_DURABLE_OUTBOX_BATCH_COUNT + 1
      })
    ).toThrowError(expectJournalError('INVALID_ACKNOWLEDGEMENT'))
  })
})


it('drops the retired external-commit table and its staged state', async () => {
  const test = fixture()
  await runInDurableObject(test.stub, (_instance, state) => {
    state.storage.sql.exec('CREATE TABLE durable_external_commit (id INTEGER PRIMARY KEY)')
    state.storage.sql.exec(
      "INSERT INTO durable_command_json_chunks VALUES ('external', 0, 1, '{}')"
    )
    new DurableCommandJournal(state.storage)
    expect(
      state.storage.sql
        .exec("SELECT name FROM sqlite_master WHERE name = 'durable_external_commit'")
        .toArray()
    ).toEqual([])
    expect(
      state.storage.sql
        .exec<{ count: number }>(
          "SELECT COUNT(*) AS count FROM durable_command_json_chunks WHERE document_key = 'external'"
        )
        .one().count
    ).toBe(0)
  })
})
