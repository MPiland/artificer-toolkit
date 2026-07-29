import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { getClass } from '#app/data/classes/queries'
import { queryKeys } from '#app/lib/queryKeys'
import type { Api } from '#app/lib/api'
import { resolveAuthoredRouteSubjectId } from './authoredRouteSubjectId'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })
}

describe('resolveAuthoredRouteSubjectId', () => {
  it('reuses the scoped list cache before calling the route-id API', async () => {
    const queryClient = createQueryClient()
    const resolve = vi.fn(async () => ({
      publicId: 'yakk',
      routeNumber: 1,
      subjectId: 'subject-from-api',
      subjectKind: 'CLASS'
    }))
    const client = {
      routeIds: { resolve }
    } as unknown as Api

    queryClient.setQueryData(queryKeys.content.classes.list(), {
      drafts: [],
      items: [
        {
          id: 'class-druid',
          publicId: 'YAKK'
        }
      ]
    })

    await expect(
      resolveAuthoredRouteSubjectId({
        client,
        listQueryKey: queryKeys.content.classes.list(),
        publicId: 'yakk',
        queryClient,
        subjectKind: 'CLASS'
      })
    ).resolves.toBe('class-druid')
    expect(resolve).not.toHaveBeenCalled()
  })

  it('keeps detail query entries separated by view and meta keys', () => {
    expect(queryKeys.content.classes.detail('class-druid')).not.toEqual(
      queryKeys.content.classes.detail('class-druid', { view: 'draft' })
    )
    expect(queryKeys.content.classes.detail('class-druid', { meta: ['a', 'b'] })).toEqual(
      queryKeys.content.classes.detail('class-druid', { meta: ['b', 'a'] })
    )
  })

  it('does not refetch detail when the loader uses the same resolved subject-id cache key', async () => {
    const queryClient = createQueryClient()
    const get = vi.fn(async () => {
      throw new Error('detail fetch should not run')
    })
    const client = {
      content: {
        classes: { get }
      }
    } as unknown as Api
    const detail = {
      item: {
        id: 'class-druid',
        label: 'Druid'
      }
    }

    queryClient.setQueryData(queryKeys.content.classes.detail('class-druid'), detail)

    await expect(queryClient.ensureQueryData(getClass('class-druid', client))).resolves.toBe(detail)
    expect(get).not.toHaveBeenCalled()
  })
})
