import { useQuery } from '@tanstack/react-query'
import type { LiveCampaignSummaryDto } from '@artificer-toolkit/schema/api/liveSessions'
import { getCampaignLiveAuthority } from '#app/data/campaigns/queries'
import { useCampaignLiveSession } from './useCampaignLiveSession'

/**
 * The room's live Campaign summary while the Campaign's table is running, otherwise null so the
 * page reads Convex again (ADR 0035 Amendment 19). Call it once per page container.
 */
export function useCampaignLiveSummary(
  campaignId: string | undefined
): LiveCampaignSummaryDto | null {
  const authority = useQuery(getCampaignLiveAuthority(campaignId))
  return useCampaignLiveSession({
    campaignId: campaignId ?? '',
    campaignSummary: true,
    enabled: Boolean(authority.data)
  }).campaignSummary
}
