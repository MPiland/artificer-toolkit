import { describe, expect, it, vi } from 'vitest'
import { fixture } from '../../tests/fixtures/socialWriters'
import { search } from './discoveryLists'

describe('native search range boundary', () => {
  it.each(['native-split', null])(
    'handles an oversized native range with split cursor %s before joins',
    async (splitCursor) => {
      const base = await fixture()
      if (!('_handler' in search) || typeof search._handler !== 'function')
        throw new Error('Missing registered query handler.')
      const handler = search._handler
      await base.other.caller.run(async (ctx) => {
        const listing = await ctx.db.query('socialListings').first()
        if (!listing) throw new Error('Missing Social listing fixture.')
        // Platform fake only: convex-test incorrectly enforces maximumRowsRead on search, so it can
        // never return the native oversized-result boundary. Everything else (viewer authorization,
        // blocks, redaction, listing rows) is the real code over seeded data. The page rows are real
        // listings; this is not evidence of native rank or split generation.
        const paginate = vi.fn().mockResolvedValue({
          page: Array.from({ length: 9 }, () => listing),
          continueCursor: 'native-end',
          isDone: false,
          splitCursor,
          pageStatus: null
        })
        const readTable = ctx.db.query.bind(ctx.db)
        const query = vi.spyOn(ctx.db, 'query').mockImplementation((table) => {
          const reader = readTable(table)
          vi.spyOn(reader, 'withSearchIndex').mockImplementation((index, build) => {
            const native = readTable(table).withSearchIndex(index, build)
            vi.spyOn(native, 'paginate').mockImplementation(paginate)
            return native
          })
          return reader
        })
        const result = handler(ctx, {
          query: 'table',
          paginationOpts: { cursor: null, endCursor: 'native-end', numItems: 8 }
        })
        if (splitCursor)
          await expect(result).resolves.toEqual({
            page: [],
            continueCursor: 'native-end',
            isDone: false,
            splitCursor,
            pageStatus: 'SplitRequired'
          })
        else
          await expect(result).rejects.toThrow('Social search page grew too large. Restart search.')
        expect(paginate).toHaveBeenCalledOnce()
        // Only the backfill check and the search read Listings; any row hydration would read Campaigns.
        expect(query.mock.calls.map(([table]) => table)).not.toContain('campaigns')
        expect(query.mock.calls.filter(([table]) => table === 'socialListings')).toHaveLength(2)
      })
    }
  )
})
