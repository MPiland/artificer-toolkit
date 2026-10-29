import { describe, expect, it } from 'vitest'
import type { AuthoredCataloguePage } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import {
  corruptPublishedVersionPayload,
  importedSubject,
  publicationFixture
} from '../../tests/fixtures/publication'
import { api } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { equipmentOptions } from './partyInventory'

// RELIABILITY-21.2: a 48-row page of the party inventory Equipment picker timed out at Convex's 1 s
// query limit on CI, because every row loaded, checksummed and parsed its full published payload to
// read its status (335 KB and 199 documents per page before the fix). The picker reads root
// catalogue facts alone (D163), so no payload is loaded.
const ROWS = 60
const PAGE_BUDGET_BYTES = 192 * 1024

type Handler = (ctx: QueryCtx, args: unknown) => Promise<AuthoredCataloguePage>

function handlerOf(registered: object): Handler {
  if (!('_handler' in registered) || typeof registered._handler !== 'function')
    throw new Error('Missing registered query handler.')
  return registered._handler as Handler
}

describe('party inventory Equipment options read budget', () => {
  it('pages official Equipment from root facts without loading any published payload', async () => {
    const equipment = srdEquipment.slice(0, ROWS)
    const subjects = equipment.map((entry) =>
      importedSubject({ subjectKind: 'EQUIPMENT', ...entry, document: entry })
    )
    const base = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      Array.from({ length: Math.ceil(subjects.length / 10) }, (_, batch) =>
        subjects.slice(batch * 10, (batch + 1) * 10)
      )
    )
    const campaign = await base.first.caller.mutation(api.campaigns.create.create, {
      name: 'Equipment options budget',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await base.t.run(async (ctx) => {
      for (const entry of equipment) await corruptPublishedVersionPayload(ctx, entry.id)
    })
    const handler = handlerOf(equipmentOptions)
    const page: AuthoredCataloguePage['page'] = []
    let cursor: string | null = null
    while (true) {
      const totals = createDatabaseIoTotals()
      const result: AuthoredCataloguePage = await base.first.caller.run((ctx) =>
        handler({ ...ctx, db: countDatabaseIo(ctx.db, totals) } as unknown as QueryCtx, {
          campaignId: campaign.id,
          paginationOpts: { cursor, numItems: 48 }
        })
      )
      console.info('equipment options page reads', JSON.stringify(totals.reads))
      expect(totals.reads.byTable.authoredVersionPayloadChunks).toBeUndefined()
      expect(totals.reads.bytes).toBeLessThanOrEqual(PAGE_BUDGET_BYTES)
      page.push(...result.page)
      if (result.isDone) break
      cursor = result.continueCursor
    }
    expect(new Set(page.map((entry) => entry.id))).toEqual(
      new Set(equipment.map((entry) => entry.id))
    )
  }, 300_000)
})
