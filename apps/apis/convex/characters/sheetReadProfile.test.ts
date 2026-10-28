import { it } from 'vitest'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { internal } from '../_generated/api'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { fixture } from '../../tests/fixtures/characters'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { loadCharacterSheet } from './sheetPreparation'

it('profiles the Sheet read on the seeded SRD', async () => {
  const base = await fixture()
  console.log('SEED', JSON.stringify(await base.t.action(internal.content.seed.seed, {})))
  if (cleric.category !== 'BASE') throw new Error('Expected a base Class.')
  const sheet = await readySheetFixture(
    {
      base: cleric,
      subclass: lifeDomainCleric,
      spellcasting: {
        ...cleric.spellcasting!,
        spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 0 }]
      }
    },
    undefined,
    base
  )
  for (let run = 0; run < 3; run++) {
    const totals = createDatabaseIoTotals()
    const started = performance.now()
    await sheet.owner.caller.run(async (ctx) =>
      loadCharacterSheet(
        { ...ctx, db: countDatabaseIo(ctx.db, totals) },
        sheet.owner.userId,
        sheet.character.id
      )
    )
    console.log('PROFILE', Math.round(performance.now() - started), JSON.stringify(totals.reads))
  }
}, 600_000)
