import { createFileRoute } from '@tanstack/react-router'
import { CampaignCreatePage } from '#domains/campaigns'

export const Route = createFileRoute('/_authed/campaigns/new')({
  component: CampaignCreatePage
})
