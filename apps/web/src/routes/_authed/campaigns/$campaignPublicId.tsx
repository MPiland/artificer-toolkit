import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCampaignDetail, getCampaignRouteIdentity } from '#app/data/campaigns/queries'
import { createServerApi } from '#app/lib/api'
import { isLegacyAuthoredDetailPath } from '#app/routing/authoredLegacyRoutes'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'

export const Route = createFileRoute('/_authed/campaigns/$campaignPublicId')({
  loader: async ({ context, location, params }) => {
    if (!isLegacyAuthoredDetailPath(location.pathname, 'campaigns')) return null

    const client = createServerApi()
    const identity = await context.queryClient.ensureQueryData(
      getCampaignRouteIdentity(params.campaignPublicId, client)
    )
    if (!identity) throw new Error('Campaign not found.')

    const campaign = await context.queryClient.ensureQueryData(
      getCampaignDetail(identity.subjectId, client)
    )

    throw redirect({
      params: buildCampaignRouteParams(campaign.publicId, campaign.name),
      replace: true,
      to: '/campaigns/$campaignPublicId/$campaignSlug'
    })
  },
  component: () => <Outlet />
})
