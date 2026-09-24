import { createFileRoute } from '@tanstack/react-router'
import { CampaignListPage } from '#domains/campaigns'
import { campaignListSearchSchema } from '#domains/campaigns/campaignListSearch'

export const Route = createFileRoute('/_authed/campaigns/')({
  validateSearch: campaignListSearchSchema,
  component: CampaignListRoute
})

function CampaignListRoute() {
  const { campaignId } = Route.useSearch()
  return <CampaignListPage deletingCampaignId={campaignId} />
}
