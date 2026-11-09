import { describe, expect, it } from 'vitest'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { fixture } from '../../tests/fixtures/characters'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { importedSubject, syncImportedDerived } from '../../tests/fixtures/publication'
import { internal } from '../_generated/api'
import { captureAcquiredEquipmentRules } from './acquiredEquipmentRules'

const SPELLS = srdSpells.slice(0, 30)

// PERF-6.T11: the open-grant sweep and the pinning pass read each Spell's root and its content
// source; the capture serves each identical read once. Measured for 30 Spells: 184 reads before, 94 after.
const CAPTURE_READ_DOCUMENTS = 100

describe('acquired Equipment capture read budget', () => {
  it('pins an open all-Spells grant without repeating root or content source reads', async () => {
    const { t } = await fixture()
    const wand = {
      ...club,
      id: crypto.randomUUID(),
      label: 'Wand of every Spell',
      features: [
        {
          id: crypto.randomUUID(),
          label: 'Every Spell',
          description: '',
          availableAtLevel: 1,
          order: 0,
          grants: {
            spells: [
              {
                id: crypto.randomUUID(),
                grantKind: 'SPELL_GRANT' as const,
                selectionKind: 'GRANTED' as const,
                scalingKind: 'NONE' as const,
                authoringModeKind: 'ALL' as const,
                attributes: ['CAST_AT_WILL' as const],
                order: 0
              }
            ]
          }
        }
      ]
    }
    const subjects = [
      importedSubject({ subjectKind: 'EQUIPMENT', ...wand, document: wand }),
      ...SPELLS.map((document) => importedSubject({ subjectKind: 'SPELL', ...document, document }))
    ]
    for (let start = 0; start < subjects.length; start += 10)
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: subjects.slice(start, start + 10)
      })
    await syncImportedDerived(t, subjects)

    const totals = createDatabaseIoTotals()
    const retained = await t.run(async (ctx) => {
      const spellRoots = (await ctx.db.query('authoredRoots').collect()).filter(
        (root) => root.subjectKind === 'SPELL'
      )
      return captureAcquiredEquipmentRules(
        { ...ctx, db: countDatabaseIo(ctx.db, totals) },
        {
          equipmentId: wand.id,
          systemId: wand.systemId,
          userId: null,
          sourceIds: new Set([SRD_CONTENT_SOURCE.id]),
          spellRoots: async () => spellRoots
        }
      )
    })
    expect(
      acquiredEquipmentRulesSchema.parse(JSON.parse(retained)).sources.map((s) => s.subjectKind)
    ).toEqual(['EQUIPMENT', ...SPELLS.map(() => 'SPELL')])
    expect(totals.reads.documents).toBeLessThanOrEqual(CAPTURE_READ_DOCUMENTS)
  })
})
