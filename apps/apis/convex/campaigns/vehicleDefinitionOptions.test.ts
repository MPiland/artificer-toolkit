import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { AuthoredCataloguePage } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { CampaignVehicleListInput } from '@artificer-toolkit/schema/api/campaignVehiclePages'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { api } from '../_generated/api'
import {
  corruptPublishedVersionPayload,
  importedSubject,
  importSeededSubjects,
  publicationFixture
} from '../../tests/fixtures/publication'

const definitionOptions = makeFunctionReference<
  'query',
  CampaignVehicleListInput,
  AuthoredCataloguePage
>('campaigns/vehicles:definitionOptions')

async function setup() {
  const definitions = Array.from({ length: 49 }, (_, index) => ({
    ...cart,
    id: crypto.randomUUID(),
    label: 'Option ' + index.toString().padStart(2, '0')
  }))
  const base = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    Array.from({ length: Math.ceil(definitions.length / 10) }, (_, batch) =>
      definitions
        .slice(batch * 10, (batch + 1) * 10)
        .map((vehicle) =>
          importedSubject({ subjectKind: 'VEHICLE', ...vehicle, document: vehicle })
        )
    )
  )
  const campaign = await base.first.caller.mutation(api.campaigns.create.create, {
    name: 'Vehicle definition options',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  return { base, campaign, definitions }
}

describe('native Campaign Vehicle definition options', () => {
  it('preserves complete pagination and excludes unselected sources and private definitions', async () => {
    const { base, campaign, definitions } = await setup()
    const excluded = definitions[0]!
    await base.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', excluded.id))
        .unique()
      if (!root) throw new Error('Missing excluded Vehicle root')
      const sourceId = crypto.randomUUID()
      await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: sourceId })
      await ctx.db.patch(root._id, { contentSourceId: sourceId })
      await ctx.db.patch(root.currentVersionId, { contentSourceId: sourceId })
    })
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
    })
    const draft = await base.first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'VEHICLE',
      subjectId: cart.id
    })
    if (!draft.updatedAt) throw new Error('Missing private Vehicle draft revision')
    await base.first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'VEHICLE',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
    const page: AuthoredCataloguePage['page'] = []
    let cursor: string | null = null
    while (true) {
      const result: AuthoredCataloguePage = await base.first.caller.query(definitionOptions, {
        campaignId: campaign.id,
        paginationOpts: { cursor, numItems: 8 }
      })
      page.push(...result.page)
      if (result.isDone) break
      expect(result.continueCursor).not.toBe(cursor)
      cursor = result.continueCursor
    }
    expect(page.map((entry) => entry.id)).toEqual([
      cart.id,
      ...definitions.slice(1).map((entry) => entry.id)
    ])
    expect(new Set(page.map((entry) => entry.id)).size).toBe(49)
    expect(page.every((entry) => entry.provenance.kind === 'MASTER')).toBe(true)
    await expect(
      base.second.caller.query(definitionOptions, {
        campaignId: campaign.id,
        paginationOpts: { cursor: null, numItems: 8 }
      })
    ).rejects.toThrow('not found')
  })

  it('pages from root catalogue facts alone and rejects stale facts', async () => {
    // RELIABILITY-21.13: every row loaded, checksummed and parsed its published payload to read its
    // status. The picker reads root catalogue facts alone (D163), so no payload is loaded, while
    // facts bound to another checksum are rejected instead of silently omitting an option.
    const { base, campaign, definitions } = await setup()
    await base.t.run(async (ctx) => {
      for (const definition of definitions) await corruptPublishedVersionPayload(ctx, definition.id)
    })
    const page: AuthoredCataloguePage['page'] = []
    let cursor: string | null = null
    while (true) {
      const result: AuthoredCataloguePage = await base.first.caller.query(definitionOptions, {
        campaignId: campaign.id,
        paginationOpts: { cursor, numItems: 8 }
      })
      page.push(...result.page)
      if (result.isDone) break
      cursor = result.continueCursor
    }
    expect(new Set(page.map((entry) => entry.id))).toEqual(
      new Set(definitions.map((entry) => entry.id))
    )
    await base.t.run(async (ctx) => {
      const [root, other] = await Promise.all(
        [definitions[0]!.id, definitions[1]!.id].map((id) =>
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
        )
      )
      if (!root?.catalogue || !other) throw new Error('Missing stale Vehicle root')
      await ctx.db.patch(root._id, { catalogue: { ...root.catalogue, checksum: other.checksum } })
    })
    await expect(
      base.first.caller.query(definitionOptions, {
        campaignId: campaign.id,
        paginationOpts: { cursor: null, numItems: 8 }
      })
    ).rejects.toThrow('catalogue facts are missing or stale')
  })
})
