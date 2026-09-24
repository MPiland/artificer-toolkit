import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import { isCanonicalAuthoredRouteHandle } from '#app/routing/authoredRouteHandles'
import { CampaignDetailPage } from '#domains/campaigns'

export const Route = createFileRoute('/_authed/campaigns/$campaignPublicId/$campaignSlug/')({
  loader: async ({ context, params }) => {
    const campaign = await context.queryClient.ensureQueryData(
      getCampaignDetail(params.campaignPublicId)
    )

    if (
      !isCanonicalAuthoredRouteHandle(params.campaignPublicId, params.campaignSlug, {
        id: campaign.id,
        publicId: campaign.publicId,
        label: campaign.name
      })
    ) {
      throw redirect({
        params: buildCampaignRouteParams(campaign.publicId, campaign.name),
        replace: true,
        to: '/campaigns/$campaignPublicId/$campaignSlug'
      })
    }

    return campaign.id
  },
  component: CampaignDetailRoute
})

function CampaignDetailRoute() {
  const campaignId = Route.useLoaderData()
  const { user } = Route.useRouteContext()

  return <CampaignDetailPage campaignId={campaignId} currentUserId={user?.userId ?? ''} />
}
