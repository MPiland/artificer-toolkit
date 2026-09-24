import { QueryClient } from '@tanstack/react-query'
import { isNotFound } from '@tanstack/react-router'
import { expect, it, vi } from 'vitest'
import { Route } from './_authed/tabletop/campaigns/$campaignPublicId/index'

vi.mock('#domains/campaigns', () => ({ CampaignTabletopWindow: () => null }))

it('renders missing Campaign access as not found while preserving unrelated loader failures', async () => {
  const loader = Route.options.loader
  if (typeof loader !== 'function') throw new Error('Missing Tabletop loader.')
  const queryClient = new QueryClient()
  const query = vi.spyOn(queryClient, 'ensureQueryData')
  const input = {
    context: { queryClient },
    params: { campaignPublicId: 'fixture' }
  } as Parameters<typeof loader>[0]
  query.mockRejectedValueOnce(
    new Error('[CONVEX Q(campaigns/queries:get)] Server Error\nUncaught Error: Campaign not found.')
  )
  await expect(loader(input)).rejects.toSatisfy(isNotFound)
  const failure = new Error('Stored Campaign authority mismatch.')
  query.mockRejectedValueOnce(failure)
  await expect(loader(input)).rejects.toBe(failure)
  query.mockRestore()
  queryClient.clear()
})
