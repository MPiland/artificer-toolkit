import { describe, expect, it } from 'vitest'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { handlerOf, inOwnTransaction } from '../../tests/fixtures/queryTransaction'
import { api } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { list as currencySystems } from './currencySystems'
import { currencies, items } from './vehicleInventory'
import { definitionOptions } from './vehicles'

// RELIABILITY-21.T26: three pages reloading at once ran these queries past 900 ms on CI, because each
// read through a `runQuery` hop into a second module graph that repeated validation, identity and
// authority (T18 removed the same hop from the party pages). User time was a third of execution time.
describe('Campaign Vehicle pages', () => {
  it.each([
    ['vehicles:definitionOptions', definitionOptions, false],
    ['currencySystems:list', currencySystems, false],
    ['vehicleInventory:items', items, true],
    ['vehicleInventory:currencies', currencies, true]
  ] as const)('%s reads in its own transaction', async (_name, registered, vehicleScoped) => {
    const base = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [[importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]]
    )
    const campaign = await base.first.caller.mutation(api.campaigns.create.create, {
      name: 'Vehicle page transaction',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const vehicle = await base.first.caller.mutation(api.campaigns.vehicles.create, {
      campaignId: campaign.id,
      vehicleDefinitionId: cart.id
    })
    const handler = handlerOf<{ page: unknown[] }>(registered)
    const result = await base.first.caller.run((ctx) =>
      handler(inOwnTransaction(ctx as unknown as QueryCtx), {
        campaignId: campaign.id,
        ...(vehicleScoped ? { vehicleId: vehicle.id } : {}),
        paginationOpts: { cursor: null, numItems: 8 }
      })
    )
    expect(Array.isArray(result.page)).toBe(true)
  })
})
