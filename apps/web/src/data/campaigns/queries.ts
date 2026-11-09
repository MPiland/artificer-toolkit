import type { CampaignSummaryDto } from '@artificer-toolkit/schema/api/campaignCore'
import { usePaginatedQuery } from 'convex/react'
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery, type QueryClient } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useLoadAllPages } from '#app/data/useLoadAllPages'

export function useGetCampaignList(enabled = true) {
  const campaigns = usePaginatedQuery(convexApi.campaigns.queries.list, enabled ? {} : 'skip', {
    initialNumItems: 8
  })

  useLoadAllPages(campaigns, 8, enabled)

  const isLoading = enabled && campaigns.status !== 'Exhausted'
  const data: CampaignSummaryDto[] | undefined =
    !enabled || isLoading ? undefined : campaigns.results

  // ponytail: eligibility requires all summaries; add server filtering only for large lists.
  return { data, isLoading }
}

export function getCampaignDetail(campaignId: string) {
  return convexQuery(convexApi.campaigns.queries.get, { id: campaignId.toLowerCase() })
}

/**
 * Drops every cached query for the Campaign, which ends its Convex subscriptions. An unmounted
 * query otherwise keeps its subscription for the cache's gcTime, so a departure would rerun each
 * of them only to answer CAMPAIGN_NOT_FOUND (D216). A query a mounted component still observes is
 * kept, since removing it would only resubscribe it.
 */
export function removeCampaignQueries(queryClient: QueryClient, campaignId: string) {
  const id = campaignId.toLowerCase()
  queryClient.removeQueries({
    predicate: (query) =>
      query.getObserversCount() === 0 &&
      query.queryKey[0] === 'convexQuery' &&
      JSON.stringify(query.queryKey).toLowerCase().includes(id)
  })
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
