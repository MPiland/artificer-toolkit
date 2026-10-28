import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { AuthoredCataloguePage } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { CampaignPartyInventoryListInput } from '@artificer-toolkit/schema/api/campaignInventoryPages'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { api } from '../_generated/api'
import {
  corruptPublishedVersionPayload,
  importedSubject,
  importSeededSubjects,
  publicationFixture
} from '../../tests/fixtures/publication'

const equipmentOptions = makeFunctionReference<
  'query',
  CampaignPartyInventoryListInput,
  AuthoredCataloguePage
>('campaigns/partyInventory:equipmentOptions')
async function setup() {
  const definitions = Array.from({ length: 49 }, (_, index) => ({
    ...club,
    id: crypto.randomUUID(),
    label: `Club ${index}`
  }))
  const base = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    Array.from({ length: Math.ceil(definitions.length / 10) }, (_, batch) =>
      definitions
        .slice(batch * 10, (batch + 1) * 10)
        .map((entry) => importedSubject({ subjectKind: 'EQUIPMENT', ...entry, document: entry }))
    )
  )
  const campaign = await base.first.caller.mutation(api.campaigns.create.create, {
    name: 'Equipment options',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  return { base, campaign, definitions }
}
describe('native Campaign equipment definition options', () => {
  it('pages enabled official Equipment and rejects an outsider or corrupt publication', async () => {
    const { base, campaign, definitions } = await setup()
    const excluded = definitions[0]!
    await base.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', excluded.id))
        .unique()
      if (!root) throw new Error('Missing excluded Equipment root')
      const sourceId = crypto.randomUUID()
      await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: sourceId })
      await ctx.db.patch(root._id, { contentSourceId: sourceId })
      await ctx.db.patch(root.currentVersionId, { contentSourceId: sourceId })
    })
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'EQUIPMENT', ...club, document: club })]
    })
    const draft = await base.first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: club.id
    })
    if (!draft.updatedAt) throw new Error('Missing private Equipment draft')
    await base.first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'EQUIPMENT',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
    const page: AuthoredCataloguePage['page'] = []
    let cursor: string | null = null
    while (true) {
      const result: AuthoredCataloguePage = await base.first.caller.query(equipmentOptions, {
        campaignId: campaign.id,
        paginationOpts: { cursor, numItems: 8 }
      })
      page.push(...result.page)
      if (result.isDone) break
      cursor = result.continueCursor
    }
    expect(new Set(page.map((entry) => entry.id))).toEqual(
      new Set([club.id, ...definitions.slice(1).map((entry) => entry.id)])
    )
    expect(new Set(page.map((entry) => entry.id)).size).toBe(49)
    expect(page.every((entry) => entry.provenance.kind === 'MASTER')).toBe(true)
    await expect(
      base.second.caller.query(equipmentOptions, {
        campaignId: campaign.id,
        paginationOpts: { cursor: null, numItems: 8 }
      })
    ).rejects.toThrow('not found')
    // The picker reads root catalogue facts alone (D163): a corrupt payload is never loaded, while
    // facts bound to another checksum are rejected.
    await base.t.run((ctx) => corruptPublishedVersionPayload(ctx, definitions[1]!.id))
    const firstPage = {
      campaignId: campaign.id,
      paginationOpts: { cursor: null, numItems: 8 }
    }
    expect(
      (await base.first.caller.query(equipmentOptions, firstPage)).page.length
    ).toBeGreaterThan(0)
    await base.t.run(async (ctx) => {
      const [root, other] = await Promise.all(
        [definitions[1]!.id, definitions[2]!.id].map((id) =>
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
        )
      )
      if (!root?.catalogue || !other) throw new Error('Missing stale Equipment root')
      await ctx.db.patch(root._id, { catalogue: { ...root.catalogue, checksum: other.checksum } })
    })
    await expect(base.first.caller.query(equipmentOptions, firstPage)).rejects.toThrow(
      'catalogue facts are missing or stale'
    )
  })
})
