import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  SocialSearchInput,
  socialSearchBackfillInputSchema,
  socialSearchBackfillResultSchema
} from '@artificer-toolkit/schema/api/socialDiscovery'
import type { SocialListingPage } from '@artificer-toolkit/schema/api/socialListingList'
import { fixture, snapshot } from '../../tests/fixtures/socialAdmission'

const search = makeFunctionReference<'query', SocialSearchInput, SocialListingPage>(
  'social/discoveryLists:search'
)
const backfill = makeFunctionReference<
  'mutation',
  z.input<typeof socialSearchBackfillInputSchema>,
  z.infer<typeof socialSearchBackfillResultSchema>
>('social/searchBackfill:backfill')
const paginationOpts = { cursor: null, numItems: 8 }

describe('Social search metadata backfill', () => {
  it('refuses partial search then backfills bounded pages idempotently without business-state changes', async () => {
    const base = await fixture()
    await base.t.run(async (ctx) => {
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
        .unique()
      if (!listing) throw new Error('Missing listing.')
      const { _id, _creationTime, ...stored } = listing
      for (let index = 0; index < 8; index++)
        await ctx.db.insert('socialListings', { ...stored, id: crypto.randomUUID() })
    })
    const before = await snapshot(base)
    await expect(
      base.other.caller.query(search, { paginationOpts, query: 'table' })
    ).rejects.toThrow('backfill is incomplete')
    const first = await base.t.mutation(backfill, { paginationOpts })
    expect(first).toMatchObject({ processed: 8, isDone: false })
    await expect(
      base.other.caller.query(search, { paginationOpts, query: 'table' })
    ).rejects.toThrow('backfill is incomplete')
    expect(
      await base.t.mutation(backfill, {
        paginationOpts: { ...paginationOpts, cursor: first.continueCursor }
      })
    ).toMatchObject({ processed: 1, isDone: true })
    const after = await snapshot(base)
    expect(after).toEqual({
      ...before,
      listings: before.listings.map((row) => ({
        ...row,
        search: { version: 1, text: `${base.campaign.name} ${row.summary}` }
      }))
    })
    expect(
      (await base.other.caller.query(search, { paginationOpts, query: 'table' })).page
    ).toHaveLength(8)
    const replay = await base.t.mutation(backfill, { paginationOpts })
    await base.t.mutation(backfill, {
      paginationOpts: { ...paginationOpts, cursor: replay.continueCursor }
    })
    expect(await snapshot(base)).toEqual(after)
    await expect(
      base.t.mutation(backfill, { paginationOpts: { cursor: null, numItems: 9 } })
    ).rejects.toThrow()
  })

  it('rejects invalid Campaign source text without changing any stored state', async () => {
    const base = await fixture()
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign.')
      await ctx.db.patch(campaign._id, { name: '' })
    })
    const before = await snapshot(base)
    await expect(base.t.mutation(backfill, { paginationOpts })).rejects.toThrow()
    expect(await snapshot(base)).toEqual(before)
  })

  it('rolls back earlier page patches when an existing projection is stale', async () => {
    const base = await fixture()
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
        .unique()
      if (!row) throw new Error('Missing listing.')
      await ctx.db.patch(row._id, { id: '00000000-0000-4000-8000-000000000001' })
      const { _id, _creationTime, ...stored } = row
      await ctx.db.insert('socialListings', {
        ...stored,
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        search: { version: 1, text: 'Stale source text' }
      })
    })
    const before = await snapshot(base)
    await expect(base.t.mutation(backfill, { paginationOpts })).rejects.toThrow('metadata mismatch')
    expect(await snapshot(base)).toEqual(before)
  })
})
