import type { CampaignSummaryDto } from '@artificer-toolkit/schema/api/campaignCore'
import { usePaginatedQuery } from 'convex/react'
import { useEffect } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'

export function useGetCampaignList(enabled = true) {
  const campaigns = usePaginatedQuery(convexApi.campaigns.queries.list, enabled ? {} : 'skip', {
    initialNumItems: 8
  })

  useEffect(() => {
    if (enabled && campaigns.status === 'CanLoadMore') campaigns.loadMore(8)
  }, [campaigns.loadMore, campaigns.status, enabled])

  const isLoading = enabled && campaigns.status !== 'Exhausted'
  const data: CampaignSummaryDto[] | undefined =
    !enabled || isLoading ? undefined : campaigns.results

  // ponytail: eligibility requires all summaries; add server filtering only for large lists.
  return { data, isLoading }
}

export function getCampaignDetail(campaignId: string) {
  return convexQuery(convexApi.campaigns.queries.get, { id: campaignId.toLowerCase() })
}

export function useCampaignDetail(campaignId: string) {
  const result = useSuspenseQuery(getCampaignDetail(campaignId))
  if (result.error?.message.includes('Campaign not found.')) throw result.error
  return result.data
}

export function useCampaignDetailOrNull(campaignId: string) {
  const result = useSuspenseQuery(getCampaignDetail(campaignId))
  return result.error?.message.includes('Campaign not found.') ? null : result.data
}

export function getCampaignConversations(campaignId: string) {
  return convexQuery(convexApi.campaigns.conversations.list, { campaignId })
}

export function getCampaignChat(
  campaignId: string,
  room: 'TABLE' | 'PARTY' | 'DIRECT',
  directUserId?: string
) {
  return convexQuery(convexApi.campaigns.chat.list, {
    campaignId,
    room,
    ...(room === 'DIRECT' && directUserId ? { directUserId } : {}),
    limit: 50
  })
}

export function getCampaignSession(campaignId: string, sessionNumber: number) {
  return convexQuery(convexApi.campaigns.sessions.get, { campaignId, sessionNumber })
}

export function getCampaignClock(campaignId: string) {
  return convexQuery(convexApi.campaigns.clock.get, { campaignId })
}

/** Campaign GM only: Characters whose recovery boundary passed while combat held the clock. */
export function getCampaignClockRecoveryPrompts(campaignId: string) {
  return convexQuery(convexApi.campaigns.clock.recoveryPrompts, { campaignId })
}

/** Non-null while the live room holds authority; other pages then show its last checkpoint. */
export function getCampaignLiveAuthority(campaignId: string | undefined) {
  return {
    ...convexQuery(
      convexApi.campaigns.queries.liveAuthority,
      campaignId ? { id: campaignId } : 'skip'
    ),
    gcTime: 0
  }
}
