import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getCampaignRealtimeTopic } from '@artificer-toolkit/schema/api/campaigns'
import type { CampaignDetailDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { useCampaignRealtime } from './useCampaignRealtime'

const realtime = vi.hoisted(() => ({
  channels: [] as Array<{
    topic: string
    handler: ((event: { payload: unknown }) => void) | undefined
  }>,
  removeChannel: vi.fn()
}))

vi.mock('#supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    channel: (topic: string) => {
      const registeredChannel = {
        topic,
        handler: undefined as ((event: { payload: unknown }) => void) | undefined
      }
      realtime.channels.push(registeredChannel)
      const channel = {
        on: (_type: string, _filter: unknown, handler: (event: { payload: unknown }) => void) => {
          registeredChannel.handler = handler
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
  beforeEach(() => {
    realtime.channels = []
  })

  it('invalidates Character Sheet and clock queries from committed events', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    renderHook(() => useCampaignRealtime(campaign, userId), { wrapper })
    await waitFor(() => expect(realtime.channels).toHaveLength(2))
    const ownerHandler = realtime.channels.find((channel) =>
      channel.topic.includes(':owner:')
    )?.handler

    act(() => {
      ownerHandler?.({
        payload: {
          scope: 'OWNER',
          entity: 'CHARACTER',
          entityId: characterId,
          event: 'UPDATED',
          eventId: '00000000-0000-4000-8000-000000000004',
          cursor: '1'
        }
      })
      ownerHandler?.({
        payload: {
          scope: 'OWNER',
          entity: 'CLOCK',
          entityId: campaignId,
          event: 'UPDATED',
          eventId: '00000000-0000-4000-8000-000000000005',
          cursor: '2'
        }
      })
      ownerHandler?.({
        payload: {
          scope: 'OWNER',
          entity: 'CAMPAIGN',
          entityId: campaignId,
          event: 'UPDATED',
          eventId: '00000000-0000-4000-8000-000000000007',
          cursor: '3'
        }
      })
    })

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.characters.sheet(characterId) })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.campaigns.clock(campaignId) })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.socialHub.all() })
    })
  })

  it('subscribes a player to their USER topic and invalidates content from that handler', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const playerCampaign: CampaignDetailDto = {
      ...campaign,
      role: 'PLAYER',
      memberships: [{ ...campaign.memberships[0], role: 'PLAYER' }]
    }
    const expectedTopic = getCampaignRealtimeTopic({
      campaignId,
      scope: 'USER',
      userId,
      accessStartedAt: playerCampaign.memberships[0].accessStartedAt
    })

    renderHook(() => useCampaignRealtime(playerCampaign, userId), { wrapper })
    await waitFor(() => expect(realtime.channels).toHaveLength(1))
    expect(realtime.channels[0].topic).toBe(expectedTopic)

    act(() => {
      realtime.channels[0].handler?.({
        payload: {
          scope: 'USER',
          entity: 'CONTENT',
          entityId: campaignId,
          recipientUserId: userId,
          event: 'UPDATED',
          eventId: '00000000-0000-4000-8000-000000000006',
          cursor: '3'
        }
      })
    })

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledTimes(1)
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.campaigns.content(campaignId) })
    })
  })
})
