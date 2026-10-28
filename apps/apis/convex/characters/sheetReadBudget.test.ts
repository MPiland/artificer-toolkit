import { describe, expect, it } from 'vitest'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { fixture } from '../../tests/fixtures/characters'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { loadCharacterSheet } from './sheetPreparation'

/**
 * Measured 2026-10-27 on this fixture (a level 1 Cleric beside all 321 SRD Spells): the Sheet read
 * scanned every Spell root, 326 roots and 1,272 KB; reading only the Cleric list's 105 Spells it
 * reads 110 roots and 487 KB. The System document is 34 KB of it.
 */
const SHEET_READ_BYTES = 600_000
const SHEET_READ_ROOTS = 150

describe('Character Sheet read budget', () => {
  it('reads only the Spells on the Character class lists', async () => {
    const base = await fixture()
    const spells = srdSpells.map((document) =>
      importedSubject({ subjectKind: 'SPELL', ...document, document })
    )
    for (let start = 0; start < spells.length; start += 10)
      await importSeededSubjects(base.t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: spells.slice(start, start + 10)
      })
    if (cleric.category !== 'BASE') throw new Error('Expected a base Class.')
    const sheet = await readySheetFixture(
      {
        base: cleric,
        spellcasting: {
          ...cleric.spellcasting!,
          spellLimits: [
            { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 0 }
          ]
        }
      },
      undefined,
      base
    )
    const totals = createDatabaseIoTotals()
    const loaded = await sheet.owner.caller.run(
      async (ctx) =>
        (await loadCharacterSheet(
          { ...ctx, db: countDatabaseIo(ctx.db, totals) },
          sheet.owner.userId,
          sheet.character.id
        )) !== null
    )
    expect(loaded).toBe(true)
    expect(totals.reads.byTable.authoredRoots?.documents).toBeLessThanOrEqual(SHEET_READ_ROOTS)
    expect(totals.reads.bytes).toBeLessThanOrEqual(SHEET_READ_BYTES)
  }, 120_000)
})
