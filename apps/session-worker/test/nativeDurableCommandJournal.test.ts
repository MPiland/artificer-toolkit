import { evictDurableObject, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect, it } from 'vitest'

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
      undoJson: JSON.stringify({ hitPoints: 11 - sequence }),
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

it('rehydrates Unicode state and undo JSON larger than one SQLite row through replay and drain', async () => {
  const test = fixture()
  const beforeJson = largeUnicodeJson('before')
  const afterJson = largeUnicodeJson('after')
  const sceneId = crypto.randomUUID()
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
    const committed = test.commit(journal, 1, {
      nextStateJson: afterJson,
      receiptJson: JSON.stringify({
        delta: { scope: 'SCENE', result: { delta: { kind: 'TOKEN_MOVED' }, sceneId } }
      }),
      undoJson: beforeJson
    })
    if (committed.kind !== 'COMMITTED') throw new Error('Expected a fresh command commit.')
    expect(committed.state.stateJson).toBe(afterJson)
    expect(committed.receipt.undoJson).toBe(beforeJson)
    expect(test.commit(journal, 1)).toEqual({ kind: 'REPLAY', receipt: committed.receipt })
    expect(
      state.storage.sql
        .exec<{ undo_json: string }>(
          'SELECT undo_json FROM durable_command_receipts WHERE command_id = ?',
          'command-1'
        )
        .one().undo_json
    ).toBe('')
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
    ).toMatchObject({ kind: 'REPLAY', receipt: { undoJson: beforeJson } })
    expect(journal.latestUnmatchedSceneTokenMove(sceneId)?.undoJson).toBe(beforeJson)
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
      test.commit(journal, 1, {
        nextStateJson: largeUnicodeJson('replacement'),
        undoJson: largeUnicodeJson('undo')
      })
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
    const maxInlineUndoJson = JSON.stringify('界'.repeat(256 * 1024 - 2))
    expect(new TextEncoder().encode(nearRowLimitJson).byteLength).toBeGreaterThan(1_990_000)
    expect(new TextEncoder().encode(nearRowLimitJson).byteLength).toBeLessThan(2_000_000)
    expect(new TextEncoder().encode(acceptedReceiptJson).byteLength).toBe(
      MAX_DURABLE_COMMAND_JSON_BYTES
    )
    expect(maxInlineUndoJson.length).toBe(256 * 1024)
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
    const accepted = test.commit(journal, 1, {
      receiptJson: acceptedReceiptJson,
      undoJson: maxInlineUndoJson
    })
    if (accepted.kind !== 'COMMITTED') throw new Error('Expected a bounded command commit.')
    expect(accepted.receipt.receiptJson).toBe(acceptedReceiptJson)
    expect(accepted.receipt.undoJson).toBe(maxInlineUndoJson)
    expect(
      state.storage.sql
        .exec<{ undo_json: string }>(
          'SELECT undo_json FROM durable_command_receipts WHERE command_id = ?',
          'command-1'
        )
        .one().undo_json
    ).toBe(maxInlineUndoJson)
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
