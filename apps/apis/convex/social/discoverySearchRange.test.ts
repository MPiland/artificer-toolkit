import { describe, expect, it, vi } from 'vitest'
import type { QueryCtx } from '../_generated/server'
import { search } from './discoveryLists'

vi.mock('./visibility', () => ({
  requireSocialViewer: vi.fn().mockResolvedValue({}),
  hasSocialBlock: vi.fn(),
  presentSocialProfile: vi.fn()
}))

describe('native search range boundary', () => {
  it.each(['native-split', null])(
    'handles an oversized native range with split cursor %s before joins',
    async (splitCursor) => {
      const paginate = vi.fn().mockResolvedValue({
        // convex-test incorrectly enforces maximumRowsRead on search. Inject the actual native
        // oversized-result boundary here; this is not evidence of native rank or split generation.
        page: Array.from({ length: 9 }, () => null),
        continueCursor: 'native-end',
        isDone: false,
        splitCursor,
        pageStatus: null
      })
      const database = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
          withSearchIndex: vi.fn().mockReturnValue({ paginate })
        })
      }
      // Only the database pagination seam is substituted; any attempted row hydration must fail.
      const ctx = { db: database } as unknown as QueryCtx
      if (!('_handler' in search) || typeof search._handler !== 'function')
        throw new Error('Missing registered query handler.')
      const result = search._handler(ctx, {
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
      expect(database.query).toHaveBeenCalledTimes(2)
    }
  )
})
