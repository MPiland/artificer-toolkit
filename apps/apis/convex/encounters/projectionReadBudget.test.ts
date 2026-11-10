// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { handlerOf } from '../../tests/fixtures/queryTransaction'
import { get, pendingPrepared } from './projectionReads'

/**
 * Both reads re-check the Campaign, memberships and Character play through each port, so the same
 * documents are read many times; the transaction serves each identical read once (PERF-6.T11).
 * Measured on this fixture (two Characters, one custom enemy): the Run projection read 46 documents
 * (24 KB) for the GM and 50 (26 KB) for a player before, and 27 (16.5 KB) for each after. One prepared
 * Run reads 5 documents either way, so its budget guards the list as it stands.
 */
const PROJECTION_READ_DOCUMENTS = 30
const PROJECTION_READ_BYTES = 18_000
const PREPARED_READ_DOCUMENTS = 5

describe('Encounter projection read budgets', () => {
  it('reads the Run projection and the prepared list within their document budgets', async () => {
    const fixture = await setupCharacterRun({}, undefined, true)
    for (const member of [fixture.owner, fixture.player]) {
      const totals = createDatabaseIoTotals()
      const prepared = await member.caller.run((ctx) =>
        handlerOf<{ encounters: unknown[] }>(pendingPrepared)(
          { ...ctx, db: countDatabaseIo(ctx.db, totals) },
          { campaignId: fixture.campaign.id }
        )
      )
      expect(prepared).toBeDefined()
      expect(totals.reads.documents).toBeLessThanOrEqual(PREPARED_READ_DOCUMENTS)
    }
    await fixture.t.run((ctx) => activateFixtureRun(ctx, fixture.run.id))
    for (const member of [fixture.owner, fixture.player]) {
      const totals = createDatabaseIoTotals()
      const projection = await member.caller.run((ctx) =>
        handlerOf<{ id: string }>(get)(
          { ...ctx, db: countDatabaseIo(ctx.db, totals) },
          { encounterId: fixture.run.id }
        )
      )
      expect(projection.id).toBe(fixture.run.id)
      expect(totals.reads.documents).toBeLessThanOrEqual(PROJECTION_READ_DOCUMENTS)
      expect(totals.reads.bytes).toBeLessThanOrEqual(PROJECTION_READ_BYTES)
    }
  }, 120000)
})
