import assert from 'node:assert/strict'
import {
  developmentReceiptLedgerInspectionSchema,
  developmentReceiptLedgerNativePageSchema,
  developmentReceiptLedgerNativeWindowSchema,
  developmentReceiptLedgerRemovalSchema,
  developmentReceiptLedgerRetirementInspectionSchema,
  developmentReceiptLedgerSeedResultSchema,
  type DevelopmentReceiptLedgerInspection,
  type DevelopmentReceiptLedgerScope,
  type DevelopmentReceiptLedgerSeedResult
} from '@artificer-toolkit/schema/api/developmentReceiptLedger'
import type { CharacterHistoryEntryDto } from '@artificer-toolkit/schema/api/characterHistory'
import {
  liveSessionCheckpointHistoryEntrySchema,
  liveSessionCheckpointHistoryKeyFields
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  RECEIPT_LEDGER_MAX_BYTES,
  RECEIPT_LEDGER_MAX_PARTS
} from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { developmentCli } from './developmentCli'

export async function verifyDevelopmentReceiptLedgers({
  cli,
  authUserId,
  ...scope
}: DevelopmentReceiptLedgerScope & { cli: typeof developmentCli; authUserId: string }) {
  const seeded: DevelopmentReceiptLedgerSeedResult[] = []
  const seededOrdinals: number[] = []
  async function inspect(ordinal: number) {
    return developmentReceiptLedgerInspectionSchema.parse(
      await cli('characters/developmentReceiptLedgers:inspect', { ...scope, ordinal }, false)
    )
  }
  let accountDeleted = false
  const prove = async () => {
    for (let ordinal = 0; ordinal < 3; ordinal++) {
      // Maximal fixture writes exceed 4 MiB including headers; space them past the native
      // deployment's one-second write-rate window. Workload proofs retain their own cadence.
      if (ordinal > 0) await new Promise((resolve) => setTimeout(resolve, 1250))
      const raw = await cli(
        'characters/developmentReceiptLedgers:seed',
        { ...scope, ordinal, rollback: false },
        false
      )
      seededOrdinals.push(ordinal)
      const result = developmentReceiptLedgerSeedResultSchema.parse(raw)
      const identity = `${scope.characterId.slice(0, -2)}${ordinal.toString(16).padStart(2, '0')}`
      assert.equal(result.ledgerId, identity)
      assert.equal(result.commandId, identity)
      assert.equal(result.byteLength, RECEIPT_LEDGER_MAX_BYTES)
      seeded.push(result)
    }
    const before: DevelopmentReceiptLedgerInspection[] = []
    for (let ordinal = 0; ordinal < 3; ordinal++) {
      const state = await inspect(ordinal)
      assert.deepEqual(state, {
        headerExists: true,
        ledgerExists: true,
        partCount: RECEIPT_LEDGER_MAX_PARTS
      })
      before.push(state)
    }

    await new Promise((resolve) => setTimeout(resolve, 1250))
    developmentReceiptLedgerRemovalSchema.parse(
      await cli(
        'characters/developmentReceiptLedgers:verifySeedRollback',
        { ...scope, ordinal: 3 },
        false
      )
    )
    assert.deepEqual(await inspect(3), { headerExists: false, ledgerExists: false, partCount: 0 })

    function assertMaximalEntry(history: CharacterHistoryEntryDto) {
      const ordinal = seeded.findIndex((receipt) => receipt.eventId === history.eventId)
      assert.ok(ordinal >= 0, 'Native receipt paging returned an unknown event.')
      const receipt = seeded[ordinal]!
      assert.equal(history.actorId, scope.userId)
      assert.equal(history.eventType, 'RECEIPT_LEDGER_PROOF')
      assert.equal(history.occurredAt, '2026-09-30T00:00:00.000Z')
      assert.ok(
        history.result === undefined,
        'Native receipt paging returned an unexpected result.'
      )
      assert.ok(history.summary.length > 0, 'Native receipt paging returned an empty summary.')
      assert.ok(
        !new RegExp(`[^${String.fromCharCode(65 + ordinal)}]`).test(history.summary),
        'Native receipt paging changed the summary content.'
      )
      const value = {
        id: history.eventId,
        characterId: scope.characterId,
        commandId: receipt.commandId,
        actorId: scope.userId,
        occurredAt: history.occurredAt,
        commandFingerprint: checksumCanonicalJson({
          characterId: scope.characterId,
          userId: scope.userId,
          ordinal
        }),
        historyJson: history,
        historyChecksum: checksumRuleDocument(history)
      }
      const entry = liveSessionCheckpointHistoryEntrySchema.parse({
        table: 'characterCommandReceipts',
        key: liveSessionCheckpointHistoryKeyFields.characterCommandReceipts.map(
          (field) => value[field]
        ),
        value,
        checksum: checksumCanonicalJson(value)
      })
      assert.equal(
        new TextEncoder().encode(canonicalizeJson([entry])).byteLength,
        RECEIPT_LEDGER_MAX_BYTES,
        'Native receipt paging did not return the complete maximal payload.'
      )
    }

    async function readAll() {
      const events: string[] = []
      const cursors = new Set<string>()
      let cursor: string | null = null
      let firstWindow: { cursor: string; eventId: string } | null = null
      let secondWindow: { cursor: string; eventId: string } | null = null
      for (let pages = 1; pages <= 8; pages++) {
        const raw = await cli(
          'characters/developmentReceiptLedgers:page',
          { ...scope, paginationOpts: { numItems: 48, cursor } },
          false
        )
        const result = developmentReceiptLedgerNativePageSchema.parse(raw)
        assert.equal(result.characterId, scope.characterId)
        assert.ok(result.page.length <= 1, 'Native receipt paging exceeded one hydrated row.')
        if ('pageStatus' in result)
          assert.notEqual(
            result.pageStatus,
            'SplitRequired',
            'Ordinary receipt paging requires a native split.'
          )
        for (const entry of result.page) {
          assertMaximalEntry(entry)
          assert.ok(!events.includes(entry.eventId), 'Native receipt paging repeated an event.')
          events.push(entry.eventId)
        }
        if (result.page[0]) {
          if (!firstWindow)
            firstWindow = { cursor: result.continueCursor, eventId: result.page[0].eventId }
          else if (!secondWindow)
            secondWindow = { cursor: result.continueCursor, eventId: result.page[0].eventId }
        }
        if (result.isDone) {
          assert.deepEqual([...events].sort(), seeded.map((entry) => entry.eventId).sort())
          return { events, pages, firstWindow, secondWindow, cursor: result.continueCursor }
        }
        assert.ok(
          result.continueCursor !== cursor && !cursors.has(result.continueCursor),
          'Native receipt pagination did not advance its opaque cursor.'
        )
        cursors.add(result.continueCursor)
        cursor = result.continueCursor
      }
      throw new Error('Native receipt pagination did not complete within eight pages.')
    }

    const initial = await readAll()
    const replay = await readAll()
    assert.deepEqual(
      replay.events,
      initial.events,
      'Repeated native receipt reads changed page order.'
    )
    assert.ok(initial.firstWindow, 'Native receipt paging produced no window cursor.')
    const window = developmentReceiptLedgerNativePageSchema.parse(
      await cli(
        'characters/developmentReceiptLedgers:page',
        {
          ...scope,
          paginationOpts: { numItems: 48, cursor: null, endCursor: initial.firstWindow.cursor }
        },
        false
      )
    )
    assert.equal(window.characterId, scope.characterId)
    assert.equal(window.page.length, 1, 'The bounded native cursor window lost its first event.')
    assert.equal(window.page[0]!.eventId, initial.firstWindow.eventId)
    assertMaximalEntry(window.page[0]!)
    // Native end-cursor windows may legitimately carry split metadata; preserve it without rejection.
    assert.ok(initial.secondWindow, 'Native receipt paging produced no second window cursor.')
    const windowInput = {
      ...scope,
      paginationOpts: { numItems: 48, cursor: null, endCursor: initial.secondWindow.cursor }
    }
    const rawWindow = developmentReceiptLedgerNativeWindowSchema.parse(
      await cli('characters/developmentReceiptLedgers:nativeWindow', windowInput, false)
    )
    assert.deepEqual(
      rawWindow.headerIds,
      [initial.firstWindow.eventId, initial.secondWindow.eventId],
      'The native end-cursor window did not return exactly two scalar headers.'
    )
    await assert.rejects(cli('characters/developmentReceiptLedgers:page', windowInput, false))

    for (let ordinal = 0; ordinal < 3; ordinal++)
      assert.deepEqual(await inspect(ordinal), before[ordinal])
    assert.deepEqual(await inspect(3), { headerExists: false, ledgerExists: false, partCount: 0 })
    const retirementInput = { ...scope, authUserId }
    const readRetirement = async () =>
      developmentReceiptLedgerRetirementInspectionSchema.parse(
        await cli('characters/developmentReceiptRetirement:inspect', retirementInput, false)
      )
    const beforeRetirement = await readRetirement()
    assert.equal(beforeRetirement.headerCount, 3)
    assert.equal(beforeRetirement.jobExists, false)
    developmentReceiptLedgerRemovalSchema.parse(
      await cli('characters/developmentReceiptRetirement:verifyRollback', scope, false)
    )
    assert.deepEqual(
      await readRetirement(),
      beforeRetirement,
      'Native private retirement did not roll back.'
    )
    await cli('accountDeletion:schedule', { authUserId }, false)
    accountDeleted = true
    const deadline = Date.now() + 60_000
    let retired = await readRetirement()
    while (retired.profileExists) {
      assert.ok(Date.now() < deadline, 'Native staged account deletion did not finish.')
      await new Promise((resolve) => setTimeout(resolve, 250))
      retired = await readRetirement()
    }
    assert.equal(retired.characterExists, false)
    assert.equal(retired.headerCount, 0)
    while (retired.jobExists || retired.storagePresent) {
      assert.ok(Date.now() < deadline, 'Native deferred private payload purge did not finish.')
      await new Promise((resolve) => setTimeout(resolve, 250))
      retired = await readRetirement()
    }
    for (let attempt = 0; attempt < 2; attempt++)
      await cli('characters/receiptCleanup:purge', { characterId: scope.characterId }, false)
    assert.deepEqual(await readRetirement(), retired, 'Completed native purge retry changed state.')
    return {
      ledgers: seeded.length,
      bytesPerLedger: RECEIPT_LEDGER_MAX_BYTES,
      pages: initial.pages,
      replayPages: replay.pages,
      nativeWindow: {
        rows: rawWindow.headerIds.length,
        isDone: rawWindow.isDone,
        continueCursor: rawWindow.continueCursor,
        splitCursor: rawWindow.splitCursor,
        pageStatus: rawWindow.pageStatus,
        hydrationRejected: true
      },
      rollback: 'PASS',
      cursorWindow: 'PASS',
      reads: 'PASS',
      privateRetirement: {
        rollback: 'PASS',
        logicalDeletion: 'PASS',
        deferredPurge: 'PASS',
        retry: 'PASS'
      }
    }
  }
  const outcome = await prove().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  )
  const cleanupFailures: unknown[] = []
  for (const ordinal of accountDeleted ? [] : seededOrdinals) {
    try {
      developmentReceiptLedgerRemovalSchema.parse(
        await cli('characters/developmentReceiptLedgers:remove', { ...scope, ordinal }, false)
      )
      assert.deepEqual(await inspect(ordinal), {
        headerExists: false,
        ledgerExists: false,
        partCount: 0
      })
    } catch (error) {
      cleanupFailures.push(error)
    }
  }
  if (cleanupFailures.length)
    throw new AggregateError(
      outcome.ok ? cleanupFailures : [outcome.error, ...cleanupFailures],
      'Receipt ledger proof fixture cleanup failed.'
    )
  if (!outcome.ok) throw outcome.error
  return outcome.value
}
