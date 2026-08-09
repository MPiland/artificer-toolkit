import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCampaignDetail, getCampaignRouteIdentity } from '#app/data/campaigns/queries'
import { createServerApi } from '#app/lib/api'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import { normalizeAuthoredRouteSlug } from '#app/routing/authoredRouteHandles'
import { CampaignEncounterBuilderPage } from '#domains/campaigns'

export const Route = createFileRoute(
  '/_authed/campaigns/$campaignPublicId/$campaignSlug/encounters'
)({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const identity = await context.queryClient.ensureQueryData(
      getCampaignRouteIdentity(params.campaignPublicId, client)
    )
    if (!identity) throw new Error('Campaign not found.')

    const campaign = await context.queryClient.ensureQueryData(
      getCampaignDetail(identity.subjectId, client)
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
