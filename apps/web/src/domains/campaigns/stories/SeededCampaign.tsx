import { Suspense, type ReactNode } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { useCampaignDetail, useGetCampaignList } from '#app/data/campaigns/queries'
import { STORY_CAMPAIGN } from '../../../../../apis/tests/developmentReviewDataScenarios'

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
 * Renders `children` with the story Campaign as the web app reads it. The seeded Campaign's id is
 * random, so it is found by name in the story account's own list (D221).
 */
export function SeededCampaign({
  children
}: {
  children: (campaign: CampaignDetailDto) => ReactNode
}) {
  const { data: campaigns } = useGetCampaignList()
  const seeded = campaigns?.find(({ name }) => name === STORY_CAMPAIGN.name)
  if (campaigns && !seeded) throw new Error(`The story account hosts no "${STORY_CAMPAIGN.name}".`)
  return seeded ? (
    <Suspense fallback={null}>
      <SeededCampaignDetail campaignId={seeded.id}>{children}</SeededCampaignDetail>
    </Suspense>
  ) : null
}
