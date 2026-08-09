import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCampaignDetail, getCampaignRouteIdentity } from '#app/data/campaigns/queries'
import { createServerApi } from '#app/lib/api'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import { isCanonicalAuthoredRouteHandle } from '#app/routing/authoredRouteHandles'
import { CampaignDetailPage } from '#domains/campaigns'

export const Route = createFileRoute('/_authed/campaigns/$campaignPublicId/$campaignSlug/')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const identity = await context.queryClient.ensureQueryData(
      getCampaignRouteIdentity(params.campaignPublicId, client)
    )
    if (!identity) throw new Error('Campaign not found.')

    const campaign = await context.queryClient.ensureQueryData(
      getCampaignDetail(identity.subjectId, client)
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

  return <CampaignDetailPage campaignId={campaignId} currentUserId={user?.id ?? ''} />
}
