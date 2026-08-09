import { createFileRoute } from '@tanstack/react-router'
import { CampaignInviteAcceptPage } from '#domains/campaigns'

export const Route = createFileRoute('/_authed/campaigns/invite/$token')({
  component: CampaignInviteAcceptRoute
})

function CampaignInviteAcceptRoute() {
  const { token } = Route.useParams()
  return <CampaignInviteAcceptPage token={token} />
}
