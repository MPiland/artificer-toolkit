import { describe, expect, it } from 'vitest'
import type { CampaignPartyItemPage } from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { api } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { items } from './partyInventoryPages'

// RELIABILITY-21.2: four concurrent item pages ran 815-937 ms on CI and starved the custody proof's
// next mutation past Convex's 1 s limit. Each row re-resolved the Campaign's catalogue binding, so a
// full 8-row page read the 34 KB System document 8 times (404 KB per page before the fix). A page
// resolves the binding once.
const ROWS = 8
const PAGE_BUDGET_BYTES = 192 * 1024

type Handler = (ctx: QueryCtx, args: unknown) => Promise<CampaignPartyItemPage>

function handlerOf(registered: object): Handler {
  if (!('_handler' in registered) || typeof registered._handler !== 'function')
    throw new Error('Missing registered query handler.')
  return registered._handler as Handler
}

describe('party inventory items read budget', () => {
  it('resolves the catalogue binding once for a full page of held official Equipment', async () => {
    const equipment = srdEquipment.filter((entry) => entry.category !== 'VARIANT').slice(0, ROWS)
    const subjects = equipment.map((entry) =>
      importedSubject({ subjectKind: 'EQUIPMENT', ...entry, document: entry })
    )
    const base = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [subjects]
    )
    const campaign = await base.first.caller.mutation(api.campaigns.create.create, {
      name: 'Party inventory budget',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    for (const [version, entry] of equipment.entries())
      await base.first.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: {
          kind: 'ITEM_ADD',
          campaignId: campaign.id,
          equipmentId: entry.id,
          quantity: 1,
          expectedOwnerVersion: version,
          idempotencyKey: crypto.randomUUID()
        }
      })
    const handler = handlerOf(items)
    const totals = createDatabaseIoTotals()
    const result = await base.first.caller.run((ctx) =>
      handler({ ...ctx, db: countDatabaseIo(ctx.db, totals) } as unknown as QueryCtx, {
        campaignId: campaign.id,
        paginationOpts: { cursor: null, numItems: 48 }
      })
    )
    console.info('party items page reads', JSON.stringify(totals.reads))
    expect(result.page.map((row) => row.label).sort()).toEqual(
      equipment.map((entry) => entry.label).sort()
    )
    expect(totals.reads.byTable.systems?.documents).toBe(1)
    expect(totals.reads.bytes).toBeLessThanOrEqual(PAGE_BUDGET_BYTES)
  }, 300_000)
})
