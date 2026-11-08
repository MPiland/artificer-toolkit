// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { readActiveEncounterSession } from './activeReads'

/**
 * The Builder-owned Character collections and draft: a Character with a large inventory or spell
 * list must not make the tabletop's session read heavier, so the read checks the build checksum
 * and never hydrates them.
 */
const CHARACTER_STRUCTURE_TABLES = [
  'characterDrafts',
  'characterInventoryItems',
  'characterCurrencyGroups',
  'characterClassSpellStates',
  'characterSpellCustomizations',
  'characterCreatureInstances',
  'characterVehicleInstances',
  'characterNotes',
  'characterNoteGroups',
  'characterExtraEquipment'
]

/**
 * Measured on this fixture (two Characters, one custom enemy). 2026-10-27: the GM's read was 113 KB
 * with each Character's structure hydrated twice and about 75 KB without; the System document is
 * 34 KB of it. 2026-11-07 (PERF-6.T9): the GM read 89 documents for 28 distinct ones (78 KB), for
 * every port re-reads the Campaign, memberships, assignments and Character play; served once per
 * transaction, the GM reads 30 (51 KB) and a player 30 (51 KB).
 */
const SESSION_READ_DOCUMENTS = 34
const SESSION_READ_BYTES = 56_000

describe('Encounter session read budget', () => {
  it('reads no Character structure and stays within its document and byte budgets for the GM and a player', async () => {
    const fixture = await setupCharacterRun({}, undefined, true)
    await fixture.t.run((ctx) => activateFixtureRun(ctx, fixture.run.id))
    for (const member of [fixture.owner, fixture.player]) {
      const totals = createDatabaseIoTotals()
      const state = await member.caller.run((ctx) =>
        readActiveEncounterSession(
          { ...ctx, db: countDatabaseIo(ctx.db, totals) },
          fixture.campaign.id
        )
      )
      expect(state.encounter?.actors.length).toBeGreaterThan(0)
      expect(
        Object.keys(totals.reads.byTable).filter((table) =>
          CHARACTER_STRUCTURE_TABLES.includes(table)
        )
      ).toEqual([])
      expect(totals.reads.documents).toBeLessThanOrEqual(SESSION_READ_DOCUMENTS)
      expect(totals.reads.bytes).toBeLessThanOrEqual(SESSION_READ_BYTES)
    }
  }, 120000)
})
