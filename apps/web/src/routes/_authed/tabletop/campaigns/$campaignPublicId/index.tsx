import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { ConvexError } from 'convex/values'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { CampaignTabletopWindow } from '#domains/campaigns'

export const Route = createFileRoute('/_authed/tabletop/campaigns/$campaignPublicId/')({
  loader: async ({ context, params }) => {
    const campaign = await context.queryClient
      .ensureQueryData(getCampaignDetail(params.campaignPublicId))
      .catch((error: unknown) => {
        if (
          error instanceof ConvexError &&
          domainRejectionErrorDataSchema.safeParse(error.data).data?.reason === 'CAMPAIGN_NOT_FOUND'
        )
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
