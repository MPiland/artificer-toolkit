import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  campaignRealtimeEnvelopeDtoSchema,
  getCampaignRealtimeTopic
} from '@artificer-toolkit/schema/api/campaigns'
import type { CampaignDetailDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { getSupabaseBrowserClient } from '#supabase/client'
import { getCampaignConversations } from './queries'

export function useCampaignRealtime(campaign: CampaignDetailDto, currentUserId: string) {
  const queryClient = useQueryClient()
  const conversations = useQuery(getCampaignConversations(campaign.id))

  useEffect(() => {
    const membership = campaign.memberships.find((candidate) => candidate.userId === currentUserId)
    if (!membership) return
    const client = getSupabaseBrowserClient()
    const scopes = [
      { scope: 'USER' as const, conversationId: undefined, directUserId: undefined },
      ...(campaign.capabilities.readTableChat
        ? [{ scope: 'TABLE' as const, conversationId: undefined, directUserId: undefined }]
        : []),
      ...(campaign.capabilities.readPartyChat
        ? [{ scope: 'PARTY' as const, conversationId: undefined, directUserId: undefined }]
        : []),
      ...(campaign.role === 'OWNER'
        ? [{ scope: 'OWNER' as const, conversationId: undefined, directUserId: undefined }]
        : []),
      ...(conversations.data ?? [])
        .filter((conversation) => conversation.kind === 'DIRECT')
        .map((conversation) => ({
          scope: 'DIRECT' as const,
          conversationId: conversation.id,
          directUserId: conversation.participantUserIds.find((userId) => userId !== currentUserId)
        }))
    ]
    const channels = scopes.map(({ scope, conversationId, directUserId }) =>
      client
        .channel(
          getCampaignRealtimeTopic({
            campaignId: campaign.id,
            scope,
            userId: currentUserId,
            accessStartedAt: membership.accessStartedAt,
            conversationId
          }),
          { config: { private: true } }
        )
        .on('broadcast', { event: 'committed' }, ({ payload }) => {
          const parsed = campaignRealtimeEnvelopeDtoSchema.safeParse(payload)
          if (!parsed.success || parsed.data.scope !== scope) return

          const { entity } = parsed.data
          if (entity === 'CHAT') {
            if (scope === 'TABLE' || scope === 'PARTY' || scope === 'DIRECT') {
              void queryClient.invalidateQueries({
                queryKey: queryKeys.campaigns.chat(campaign.id, scope, directUserId)
              })
              void queryClient.invalidateQueries({
                queryKey: queryKeys.campaigns.conversations(campaign.id)
              })
            }
            return
          }
          if (entity === 'NOTE') {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.campaigns.notebook(campaign.id)
            })
            void queryClient.invalidateQueries({
              queryKey: ['campaigns', campaign.id, 'sessions']
            })
          } else if (entity === 'SESSION') {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.campaigns.sessions(campaign.id)
            })
          } else if (entity === 'INVENTORY') {
            void queryClient.invalidateQueries({
              queryKey: ['campaigns', campaign.id, 'inventory']
            })
          } else if (entity === 'CONTENT') {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.campaigns.content(campaign.id)
            })
          } else if (entity === 'CLOCK') {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.campaigns.clock(campaign.id)
            })
          } else if (entity === 'CHARACTER') {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.characters.sheet(parsed.data.entityId)
            })
            void queryClient.invalidateQueries({
              queryKey: queryKeys.campaigns.detail(campaign.id)
            })
            void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.list() })
          } else if (entity === 'CAMPAIGN' || entity === 'MEMBERSHIP') {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.campaigns.detail(campaign.id)
            })
            void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.list() })
          }
        })
        .subscribe()
    )

    return () => {
      for (const channel of channels) void client.removeChannel(channel)
    }
  }, [
    campaign.capabilities.readPartyChat,
    campaign.capabilities.readTableChat,
    campaign.id,
    campaign.memberships,
    campaign.role,
    conversations.data,
    currentUserId,
    queryClient
  ])
}
