import { createFileRoute } from '@tanstack/react-router'
import {
  getCampaignDetail,
  getCampaignRouteIdentity,
  getCampaignSession
} from '#app/data/campaigns/queries'
import { createServerApi } from '#app/lib/api'
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

    const client = createServerApi()
    const identity = await context.queryClient.ensureQueryData(
      getCampaignRouteIdentity(params.campaignPublicId, client)
    )
    if (!identity) throw new Error('Campaign not found.')

    const campaign = await context.queryClient.ensureQueryData(
      getCampaignDetail(identity.subjectId, client)
    )
    await context.queryClient.ensureQueryData(
      getCampaignSession(campaign.id, sessionNumber, client)
    )
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
      currentUserId={user?.id ?? ''}
      sessionNumber={sessionNumber}
    />
  )
}
