import { createFileRoute, notFound } from '@tanstack/react-router'
import { getCampaignDetail, getCampaignSession } from '#app/data/campaigns/queries'
import { CampaignTabletopWindow } from '#domains/campaigns'

export const Route = createFileRoute(
  '/_authed/tabletop/campaigns/$campaignPublicId/sessions/$sessionNumber'
)({
  loader: async ({ context, params }) => {
    if (!/^[1-9]\d*$/.test(params.sessionNumber)) {
      throw new Error('Session number must be a positive integer.')
    }
    const sessionNumber = Number(params.sessionNumber)
    if (!Number.isSafeInteger(sessionNumber)) {
      throw new Error('Session number is too large.')
    }

    const campaign = await context.queryClient
      .ensureQueryData(getCampaignDetail(params.campaignPublicId))
      .catch((error: unknown) => {
        if (error instanceof Error && error.message.includes('Campaign not found.'))
          throw notFound()
        throw error
      })
    await context.queryClient.ensureQueryData(getCampaignSession(campaign.id, sessionNumber))
    return { campaignId: campaign.id, sessionNumber }
  },
  component: CampaignTabletopRoute
})

function CampaignTabletopRoute() {
  const { campaignId, sessionNumber } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  return (
    <CampaignTabletopWindow
      campaignId={campaignId}
      currentUserId={user?.userId ?? ''}
      sessionNumber={sessionNumber}
    />
  )
}
