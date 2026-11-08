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
 *
 * PERF-6.T5 (2026-11-08): from 274 documents and 496 KB to 179 and 397 KB. Each Class list row
 * carries its Spell's selector entry and root identity, so the list reads rows only and the Spells
 * the Character references read roots. The rows' bytes are the selector content the Sheet shows.
 */
const SHEET_READ_BYTES = 400_000
const SHEET_READ_DOCUMENTS = 180
const SHEET_READ_ROOTS = 20
const SHEET_READ_PUBLICATIONS = 20

/** The whole SRD beside the fixture's own Cleric and Life Domain. */
async function importSrd(base: Awaited<ReturnType<typeof fixture>>) {
  const subjects = [
    ...srdRaces.map((document) => importedSubject({ subjectKind: 'RACE', ...document, document })),
    ...srdClasses
      .filter((document) => document.id !== cleric.id && document.id !== lifeDomainCleric.id)
      .map((document) => importedSubject({ subjectKind: 'CLASS', ...document, document })),
    importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte }),
    ...srdEquipment.map((document) =>
      importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
    ),
    ...srdSpells.map((document) => importedSubject({ subjectKind: 'SPELL', ...document, document }))
  ]
  for (let start = 0; start < subjects.length; start += 10)
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: subjects.slice(start, start + 10)
    })
}

/** A prepared Life Domain Cleric at this level with no cantrips to choose. */
function readyCleric(base: Awaited<ReturnType<typeof fixture>>, classLevel: number) {
  if (cleric.category !== 'BASE' || !cleric.spellcasting) throw new Error('Expected a base Class.')
  return readySheetFixture(
    {
      base: cleric,
      classLevel,
      subclass: lifeDomainCleric,
      spellcasting: {
        ...cleric.spellcasting,
        spellLimits: cleric.spellcasting.spellLimits.map((limit) => ({
          ...limit,
          cantripsLimit: 0
        }))
      }
    },
    undefined,
    base
  )
}

async function measureSheet(sheet: Awaited<ReturnType<typeof readyCleric>>) {
  const totals = createDatabaseIoTotals()
  // Only the Spells leave the run: the full read holds Sets, which convex-test cannot return.
  const spells = await sheet.owner.caller.run(
    async (ctx) =>
      (
        await loadCharacterSheet(
          { ...ctx, db: countDatabaseIo(ctx.db, totals) },
          sheet.owner.userId,
          sheet.character.id
        )
      )?.sheet.spells
  )
  if (!spells) throw new Error('Expected a Sheet.')
  return { spells, totals }
}

describe('Character Sheet read budget', () => {
  it('reads Class list rows, not Spell roots, and keeps the Sheet Spells', async () => {
    const base = await fixture()
    await importSrd(base)
    for (const classLevel of [1, 9]) {
      const sheet = await readyCleric(base, classLevel)
      const { spells, totals } = await measureSheet(sheet)
      console.info(
        `Cleric ${classLevel} Sheet read: ${totals.reads.documents} documents, ` +
          `${Math.round(totals.reads.bytes / 1000)} KB, ${spells.spells.length} Spells`,
        Object.entries(totals.reads.byTable)
          .sort(([, a], [, b]) => b.bytes - a.bytes)
          .map(([table, read]) => `${table} ${read.documents}/${read.distinct} ${read.bytes}`)
      )
      if (classLevel === 1) {
        expect(totals.reads.documents).toBeLessThanOrEqual(SHEET_READ_DOCUMENTS)
        expect(totals.reads.bytes).toBeLessThanOrEqual(SHEET_READ_BYTES)
      }
      expect(totals.reads.byTable.authoredRoots?.documents).toBeLessThanOrEqual(SHEET_READ_ROOTS)
      expect(totals.reads.byTable.authoredVersionPayloadChunks?.documents).toBeLessThanOrEqual(
        SHEET_READ_PUBLICATIONS
      )
      // The resolution scope reads every visible Spell root: the Spells it shows are the oracle.
      const fromRoots = await sheet.owner.caller.run(
        async (ctx) =>
          (
            await loadCharacterSheet(
              ctx,
              sheet.owner.userId,
              sheet.character.id,
              undefined,
              undefined,
              'resolution'
            )
          )?.sheet.spells
      )
      expect(spells.spells.length).toBeGreaterThan(classLevel === 1 ? 10 : 60)
      expect(spells).toEqual(fromRoots)
    }
  }, 600_000)
})
