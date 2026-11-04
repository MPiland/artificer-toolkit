import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { executeCharacterSheetCommandAcknowledgement } from './sheetCommands'

/**
 * Measured 2026-11-04 on a Campaign Character whose GM is another user: a Sheet HP change read 55
 * documents and about 230 KB before PERF-1.T5, 137 KB of it four reads of the one System document
 * (each checksummed again). It now reads the System once for its rules and once for the stored
 * Sheet's fingerprint, about 158 KB in all.
 */
const SYSTEM_READS = 2
const SHEET_COMMAND_READ_BYTES = 180_000

describe('Sheet command work budget', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reads the System and the Character sources once per Sheet HP change', async () => {
    const { player, character } = await setupCharacterRun()
    const damage = async (
      ctx: Parameters<typeof executeCharacterSheetCommandAcknowledgement>[0]
    ) => {
      const current = await player.caller.query(api.characters.sheet.get, { id: character.id })
      if (!current) throw new Error('Expected Character Sheet.')
      return executeCharacterSheetCommandAcknowledgement(ctx, player.userId, {
        id: character.id,
        command: {
          type: 'ADJUST_HIT_POINTS',
          commandId: crypto.randomUUID(),
          expectedVersion: current.meta.streamVersion,
          mode: 'DAMAGE',
          amount: 1
        }
      })
    }
    // The Builder commit only queues the Sheet's derivation (ADR 0041); a first command stores
    // the sections inline, so the metered one does the steady-state work.
    await player.caller.run((ctx) => damage(ctx))

    const totals = createDatabaseIoTotals()
    await player.caller.run((ctx) => damage({ ...ctx, db: countDatabaseIo(ctx.db, totals) }))

    expect(totals.reads.byTable.systems?.documents).toBeLessThanOrEqual(SYSTEM_READS)
    expect(totals.reads.byTable.campaignMemberships?.documents).toBe(1)
    expect(totals.reads.byTable.rulesCatalogues?.documents).toBe(1)
    expect(totals.reads.bytes).toBeLessThan(SHEET_COMMAND_READ_BYTES)
  })
})
