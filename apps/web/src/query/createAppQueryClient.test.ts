import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConvexQueryClient, convexQuery } from '@convex-dev/react-query'
import { QueryObserver } from '@tanstack/react-query'
import { ConvexReactClient } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { SystemListPageDto } from '@artificer-toolkit/schema/api/systems'
import { createAppQueryClient } from './createAppQueryClient'

afterEach(() => vi.restoreAllMocks())

describe('app query client Convex bridge', () => {
  it('subscribes, reuses loader data, applies pushed results and unsubscribes on cache clear', async () => {
    const client = new ConvexReactClient('https://example.convex.cloud')
    let result: SystemListPageDto = { page: [], isDone: false, continueCursor: 'next-page' }
    const callbacks = new Set<() => void>()
    const unsubscribe = vi.fn()
    vi.spyOn(client, 'watchQuery').mockReturnValue({
      localQueryResult: () => result,
      journal: () => undefined,
      onUpdate: (callback) => {
        callbacks.add(callback)
        return () => {
          callbacks.delete(callback)
          unsubscribe()
        }
      }
    })
    const fetch = vi.spyOn(client, 'query').mockImplementation(async () => result)
    const convex = new ConvexQueryClient(client)
    const queryClient = createAppQueryClient(convex)
    const options = convexQuery(api.content.systems.list, { cursor: null, limit: 10 })
    try {
      expect(await queryClient.ensureQueryData(options)).toEqual(result)
      expect(await queryClient.fetchQuery(options)).toEqual(result)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(client.watchQuery).toHaveBeenCalledWith(options.queryKey[1], options.queryKey[2], {})

      result = { page: [], isDone: true, continueCursor: '' }
      for (const callback of callbacks) callback()
      expect(queryClient.getQueryData(options.queryKey)).toEqual(result)
      expect(fetch).toHaveBeenCalledTimes(1)

      queryClient.clear()
      expect(unsubscribe).toHaveBeenCalledTimes(1)
      expect(callbacks.size).toBe(0)
    } finally {
      queryClient.clear()
      convex.unsubscribe?.()
      await client.close()
    }
  })

  it('preserves explicit non-Convex queries and keeps separate app caches isolated', async () => {
    const client = new ConvexReactClient('https://example.convex.cloud')
    const convex = new ConvexQueryClient(client)
    const first = createAppQueryClient(convex)
    const second = createAppQueryClient()
    try {
      const options = { queryKey: ['transitional-domain'], queryFn: async () => ({ label: 'One' }) }
      expect(await first.fetchQuery(options)).toEqual({ label: 'One' })
      expect(second.getQueryData(options.queryKey)).toBeUndefined()
      expect(first.getDefaultOptions().queries?.retry).toBe(1)
      expect(convex.ssrQueryMode).toBe('consistent')
    } finally {
      first.clear()
      second.clear()
      convex.unsubscribe?.()
      await client.close()
    }
  })

  it('keeps the current subscription when a delayed observer removes an evicted query instance', async () => {
    vi.useFakeTimers()
    const client = new ConvexReactClient('https://example.convex.cloud')
    const initial = { page: [], isDone: true, continueCursor: '' }
    const updated = { page: [], isDone: false, continueCursor: 'next-page' }
    let currentResult = initial
    const callbacks = new Map<number, () => void>()
    const unsubscriptions = [vi.fn(), vi.fn()]
    let watchIndex = 0
    vi.spyOn(client, 'watchQuery').mockImplementation(() => {
      const index = watchIndex++
      return {
        localQueryResult: () => (index === 1 ? currentResult : initial),
        journal: () => undefined,
        onUpdate: (callback) => {
          callbacks.set(index, callback)
          return unsubscriptions[index]!
        }
      }
    })
    const query = vi.spyOn(client, 'query').mockResolvedValue(initial)
    const convex = new ConvexQueryClient(client)
    const queryClient = createAppQueryClient(convex)
    const options = {
      ...convexQuery(api.content.systems.list, { cursor: null, limit: 48 }),
      gcTime: 0,
      initialData: initial,
      staleTime: Infinity
    }
    const removedEvents: string[] = []
    const unsubscribeEvents = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'removed') removedEvents.push(event.query.queryHash)
    })
    // Rendering can build this query before its observer commits. With gcTime: 0,
    // it may leave the cache before the observer subscribes.
    const staleObserver = new QueryObserver(queryClient, options)
    try {
      await vi.advanceTimersByTimeAsync(0)
      expect(removedEvents).toHaveLength(1)

      const currentObserver = new QueryObserver(queryClient, options)
      const stopCurrent = currentObserver.subscribe(() => {})
      const stopStale = staleObserver.subscribe(() => {})
      expect(query).not.toHaveBeenCalled()
      stopStale()
      await vi.advanceTimersByTimeAsync(0)
      // TanStack Query only removes (and announces) the instance that is still in the cache, so the
      // evicted instance's late removal is silent and the current one stays subscribed.
      expect(removedEvents).toHaveLength(1)
      expect(unsubscriptions[1]).not.toHaveBeenCalled()

      currentResult = updated
      callbacks.get(1)!()
      expect(queryClient.getQueryData(options.queryKey)).toEqual(updated)
      stopCurrent()

      await vi.advanceTimersByTimeAsync(0)
      expect(unsubscriptions[0]).toHaveBeenCalledTimes(1)
      expect(unsubscriptions[1]).toHaveBeenCalledTimes(1)
    } finally {
      unsubscribeEvents()
      queryClient.clear()
      convex.unsubscribe?.()
      await client.close()
      vi.useRealTimers()
    }
  })
})
