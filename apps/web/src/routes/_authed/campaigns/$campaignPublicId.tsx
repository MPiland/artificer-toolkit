import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { isLegacyAuthoredDetailPath } from '#app/routing/authoredLegacyRoutes'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'

export const Route = createFileRoute('/_authed/campaigns/$campaignPublicId')({
  loader: async ({ context, location, params }) => {
    if (!isLegacyAuthoredDetailPath(location.pathname, 'campaigns')) return null

    const campaign = await context.queryClient.ensureQueryData(
      getCampaignDetail(params.campaignPublicId)
    )

    throw redirect({
      params: buildCampaignRouteParams(campaign.publicId, campaign.name),
      replace: true,
      search: location.search,
      to: '/campaigns/$campaignPublicId/$campaignSlug'
    })
  },
  component: () => <Outlet />
})
