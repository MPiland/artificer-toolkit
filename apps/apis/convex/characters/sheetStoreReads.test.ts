import { describe, expect, it } from 'vitest'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { deriveAndStoreCharacterSheet } from './sheetSectionDerivation'

describe('Character Sheet store reads', () => {
  it('reads the System, sources and rules catalogues once for the fingerprint and the facts', async () => {
    const sheet = await readySheetFixture()
    // The commit already stored the Sheet; a store finds a stale derivation and no newer queued write.
    await sheet.t.run(async (ctx) => {
      for (const row of await ctx.db.query('characterSheetPendingStores').collect())
        await ctx.db.delete('characterSheetPendingStores', row._id)
      for (const row of await ctx.db.query('characterSheetDerivations').collect())
        await ctx.db.delete('characterSheetDerivations', row._id)
    })
    const totals = createDatabaseIoTotals()
    await sheet.owner.caller.run((ctx) =>
      deriveAndStoreCharacterSheet(
        { ...ctx, db: countDatabaseIo(ctx.db, totals) },
        sheet.character.id,
        crypto.randomUUID()
      )
    )
    expect(totals.reads.byTable.authoredVersionPayloadChunks?.documents).toBeGreaterThan(0)
    expect(totals.reads.byTable.systems?.documents).toBe(1)
    expect(totals.reads.byTable.contentSources?.documents).toBe(1)
    expect(totals.reads.byTable.rulesCatalogues?.documents).toBe(1)
  }, 120_000)
})
