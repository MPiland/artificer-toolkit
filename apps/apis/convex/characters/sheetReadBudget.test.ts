import { describe, expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { srdClasses } from '@artificer-toolkit/source-data/srd/classes/index.js'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { srdRaces } from '@artificer-toolkit/source-data/srd/races/index.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { fixture } from '../../tests/fixtures/characters'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { loadCharacterSheet } from './sheetPreparation'

/**
 * Measured 2026-10-28 on this fixture (a level 1 Life Domain Cleric beside the whole SRD): the Sheet
 * read was 2.6 MB, every Spell root and every Class publication; reading only the Cleric list's 105
 * Spells, and no Class catalogue once the subclass is chosen, it reads 110 roots, 15 publications
 * and 575 KB. The System document is 34 KB of it.
 */
const SHEET_READ_BYTES = 700_000
const SHEET_READ_ROOTS = 150
const SHEET_READ_PUBLICATIONS = 20

describe('Character Sheet read budget', () => {
  it('reads only the class-list Spells and no Class catalogue once the subclass is chosen', async () => {
    const base = await fixture()
    // The fixture imports its own Cleric and Life Domain.
    const subjects = [
      ...srdRaces.map((document) =>
        importedSubject({ subjectKind: 'RACE', ...document, document })
      ),
      ...srdClasses
        .filter((document) => document.id !== cleric.id && document.id !== lifeDomainCleric.id)
        .map((document) => importedSubject({ subjectKind: 'CLASS', ...document, document })),
      importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte }),
      ...srdEquipment.map((document) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
      ),
      ...srdSpells.map((document) =>
        importedSubject({ subjectKind: 'SPELL', ...document, document })
      )
    ]
    for (let start = 0; start < subjects.length; start += 10)
      await importSeededSubjects(base.t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: subjects.slice(start, start + 10)
      })
    if (cleric.category !== 'BASE') throw new Error('Expected a base Class.')
    const sheet = await readySheetFixture(
      {
        base: cleric,
        subclass: lifeDomainCleric,
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
    expect(totals.reads.byTable.authoredVersionPayloadChunks?.documents).toBeLessThanOrEqual(
      SHEET_READ_PUBLICATIONS
    )
    expect(totals.reads.bytes).toBeLessThanOrEqual(SHEET_READ_BYTES)
  }, 300_000)
})
