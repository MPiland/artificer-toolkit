import { Suspense, type ReactNode } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { useCampaignDetail, useGetCampaignList } from '#app/data/campaigns/queries'
import {
  STORY_CAMPAIGN,
  type StoryCampaignSpec
} from '../../../../../apis/tests/developmentReviewDataScenarios'

function SeededCampaignDetail({
  campaignId,
  children
}: {
  campaignId: string
  children: (campaign: CampaignDetailDto) => ReactNode
}) {
  return children(useCampaignDetail(campaignId))
}

/**
 * Renders `children` with a seeded story Campaign as the web app reads it: the one the story account
 * hosts (the default), or the one it plays in (`STORY_PLAYER_CAMPAIGN`). The id is random, so it is
 * found by name in the story account's own list (D221).
 */
export function SeededCampaign({
  campaign = STORY_CAMPAIGN,
  children
}: {
  campaign?: Pick<StoryCampaignSpec, 'name'>
  children: (campaign: CampaignDetailDto) => ReactNode
}) {
  const { data: campaigns } = useGetCampaignList()
  const seeded = campaigns?.find(({ name }) => name === campaign.name)
  if (campaigns && !seeded) throw new Error(`The story account has no "${campaign.name}".`)
  return seeded ? (
    <Suspense fallback={null}>
      <SeededCampaignDetail campaignId={seeded.id}>{children}</SeededCampaignDetail>
    </Suspense>
  ) : null
}
