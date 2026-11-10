import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryObserver } from '@tanstack/react-query'
import { ConvexReactClient } from 'convex/react'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { getCampaignDetail, removeCampaignQueries } from './queries'

afterEach(() => vi.restoreAllMocks())

describe('removeCampaignQueries', () => {
  it('ends the Convex subscription of each unobserved query of the Campaign and no other', async () => {
    const client = new ConvexReactClient('https://example.convex.cloud')
    const active = new Set<string>()
    vi.spyOn(client, 'watchQuery').mockImplementation((_, args) => {
      const id = JSON.stringify(args)
      return {
        localQueryResult: () => ({ id }),
        journal: () => undefined,
        onUpdate: () => {
          active.add(id)
          return () => active.delete(id)
        }
      }
    })
    vi.spyOn(client, 'query').mockImplementation(async () => ({}))
    const convex = new ConvexQueryClient(client)
    const queryClient = createAppQueryClient(convex)
    const leaving = getCampaignDetail('CAMPAIGN-A')
    const staying = getCampaignDetail('campaign-b')
    try {
      await queryClient.fetchQuery(leaving)
      await queryClient.fetchQuery(staying)
      expect(active.size).toBe(2)

      removeCampaignQueries(queryClient, 'campaign-a')

      expect(queryClient.getQueryData(leaving.queryKey)).toBeUndefined()
      expect([...active]).toEqual([JSON.stringify({ id: 'campaign-b' })])
    } finally {
      queryClient.clear()
      convex.unsubscribe?.()
      await client.close()
    }
  })

  it('keeps a query a mounted observer still reads', async () => {
    const client = new ConvexReactClient('https://example.convex.cloud')
    const active = new Set<string>()
    vi.spyOn(client, 'watchQuery').mockImplementation((_, args) => ({
      localQueryResult: () => ({}),
      journal: () => undefined,
      onUpdate: () => {
        active.add(JSON.stringify(args))
        return () => active.delete(JSON.stringify(args))
      }
    }))
    vi.spyOn(client, 'query').mockImplementation(async () => ({}))
    const convex = new ConvexQueryClient(client)
    const queryClient = createAppQueryClient(convex)
    const observed = getCampaignDetail('campaign-a')
    const observer = new QueryObserver(queryClient, observed)
    const stop = observer.subscribe(() => undefined)
    try {
      await queryClient.fetchQuery(observed)
      removeCampaignQueries(queryClient, 'campaign-a')
      expect(active.size).toBe(1)
      stop()
      removeCampaignQueries(queryClient, 'campaign-a')
      expect(active.size).toBe(0)
    } finally {
      stop()
      queryClient.clear()
      convex.unsubscribe?.()
      await client.close()
    }
  })
})
