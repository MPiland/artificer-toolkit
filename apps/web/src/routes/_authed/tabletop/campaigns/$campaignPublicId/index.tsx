import { createFileRoute, notFound } from '@tanstack/react-router'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { CampaignTabletopWindow } from '#domains/campaigns'

export const Route = createFileRoute('/_authed/tabletop/campaigns/$campaignPublicId/')({
  loader: async ({ context, params }) => {
    const campaign = await context.queryClient
      .ensureQueryData(getCampaignDetail(params.campaignPublicId))
      .catch((error: unknown) => {
        if (error instanceof Error && error.message.includes('Campaign not found.'))
          throw notFound()
        throw error
      })
    return { campaignId: campaign.id }
  },
  component: CampaignTabletopRoute
})

function CampaignTabletopRoute() {
  const { campaignId } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  return <CampaignTabletopWindow campaignId={campaignId} currentUserId={user?.userId ?? ''} />
}
