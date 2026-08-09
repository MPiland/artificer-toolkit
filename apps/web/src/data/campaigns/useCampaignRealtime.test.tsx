import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { CampaignDetailDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { useCampaignRealtime } from './useCampaignRealtime'

const realtime = vi.hoisted(() => ({
  handler: undefined as ((event: { payload: unknown }) => void) | undefined,
  removeChannel: vi.fn()
}))

vi.mock('#supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    channel: () => {
      const channel = {
        on: (_type: string, _filter: unknown, handler: (event: { payload: unknown }) => void) => {
          realtime.handler = handler
          return channel
        },
        subscribe: () => channel
      }
      return channel
    },
    removeChannel: realtime.removeChannel
  })
}))

vi.mock('./queries', () => ({
  getCampaignConversations: (campaignId: string) => ({
    queryKey: ['campaigns', campaignId, 'conversations'],
    queryFn: async () => [],
    staleTime: Number.POSITIVE_INFINITY
  })
}))

const campaignId = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'
const characterId = '00000000-0000-4000-8000-000000000003'

const campaign = {
  id: campaignId,
  role: 'OWNER',
  capabilities: { readTableChat: false, readPartyChat: false },
  memberships: [
    {
      userId,
      role: 'OWNER',
      accessStartedAt: '2026-08-09T12:00:00.000Z'
    }
  ]
} as unknown as CampaignDetailDto

describe('useCampaignRealtime', () => {
  it('invalidates Character Sheet and clock queries from committed events', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    renderHook(() => useCampaignRealtime(campaign, userId), { wrapper })
    await waitFor(() => expect(realtime.handler).toBeDefined())

    act(() => {
      realtime.handler?.({
        payload: {
          scope: 'OWNER',
          entity: 'CHARACTER',
          entityId: characterId,
          event: 'UPDATED',
          eventId: '00000000-0000-4000-8000-000000000004',
          cursor: '1'
        }
      })
      realtime.handler?.({
        payload: {
          scope: 'OWNER',
          entity: 'CLOCK',
          entityId: campaignId,
          event: 'UPDATED',
          eventId: '00000000-0000-4000-8000-000000000005',
          cursor: '2'
        }
      })
    })

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.characters.sheet(characterId) })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.campaigns.clock(campaignId) })
    })
  })
})
