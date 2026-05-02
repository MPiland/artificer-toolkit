import { QueryClient, queryOptions } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { ApiError } from '#app/lib/api'
import { ensureOptionalActiveContent } from './optionalActiveContent'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })
}

describe('ensureOptionalActiveContent', () => {
  it('returns and caches null when optional active content is missing', async () => {
    const queryClient = createTestQueryClient()
    const query = queryOptions({
      queryKey: ['content', 'vehicles', 'draft-only'],
      queryFn: async () => {
        throw new ApiError(404, 'Not found')
      }
    })

    await expect(ensureOptionalActiveContent(queryClient, query)).resolves.toBeNull()
    expect(queryClient.getQueryData(query.queryKey)).toBeNull()
  })

  it('rethrows non-404 API failures', async () => {
    const queryClient = createTestQueryClient()
    const query = queryOptions({
      queryKey: ['content', 'vehicles', 'server-error'],
      queryFn: async () => {
        throw new ApiError(500, 'Server error')
      }
    })

    await expect(ensureOptionalActiveContent(queryClient, query)).rejects.toMatchObject({
      status: 500
    })
  })

  it('returns active content when the query succeeds', async () => {
    const queryClient = createTestQueryClient()
    const query = queryOptions({
      queryKey: ['content', 'vehicles', 'active'],
      queryFn: async () => ({ item: { id: 'active' } })
    })

    await expect(ensureOptionalActiveContent(queryClient, query)).resolves.toEqual({
      item: { id: 'active' }
    })
  })
})
