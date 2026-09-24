import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import { normalizeAuthoredRouteSlug } from '#app/routing/authoredRouteHandles'
import { CampaignEncounterBuilderPage } from '#domains/campaigns'

export const Route = createFileRoute(
  '/_authed/campaigns/$campaignPublicId/$campaignSlug/encounters'
)({
  loader: async ({ context, params }) => {
    const campaign = await context.queryClient.ensureQueryData(
      getCampaignDetail(params.campaignPublicId)
    )

    if (normalizeAuthoredRouteSlug(campaign.name) !== params.campaignSlug) {
      throw redirect({
        params: buildCampaignRouteParams(campaign.publicId, campaign.name),
        replace: true,
        to: '/campaigns/$campaignPublicId/$campaignSlug/encounters'
      })
    }

    return campaign.id
  },
  component: CampaignEncounterBuilderRoute
})

function CampaignEncounterBuilderRoute() {
  return <CampaignEncounterBuilderPage campaignId={Route.useLoaderData()} />
}
