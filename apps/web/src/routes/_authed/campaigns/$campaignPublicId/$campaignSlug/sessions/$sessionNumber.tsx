import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  getCampaignDetail,
  getCampaignRouteIdentity,
  getCampaignSession
} from '#app/data/campaigns/queries'
import { createServerApi } from '#app/lib/api'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import { normalizeAuthoredRouteSlug } from '#app/routing/authoredRouteHandles'
import { CampaignSessionWorkspace } from '#domains/campaigns'

export const Route = createFileRoute(
  '/_authed/campaigns/$campaignPublicId/$campaignSlug/sessions/$sessionNumber'
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
    if (normalizeAuthoredRouteSlug(campaign.name) !== params.campaignSlug) {
      throw redirect({
        params: {
          ...buildCampaignRouteParams(campaign.publicId, campaign.name),
          sessionNumber: String(sessionNumber)
        },
        replace: true,
        to: '/campaigns/$campaignPublicId/$campaignSlug/sessions/$sessionNumber'
      })
    }
    if (campaign.role !== 'OWNER') {
      throw redirect({
        params: buildCampaignRouteParams(campaign.publicId, campaign.name),
        replace: true,
        to: '/campaigns/$campaignPublicId/$campaignSlug'
      })
    }
    await context.queryClient.ensureQueryData(
      getCampaignSession(campaign.id, sessionNumber, client)
    )
    return { campaignId: campaign.id, sessionNumber }
  },
  component: CampaignSessionRoute
})

function CampaignSessionRoute() {
  const { campaignId, sessionNumber } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  return (
    <CampaignSessionWorkspace
      campaignId={campaignId}
      currentUserId={user?.id ?? ''}
      sessionNumber={sessionNumber}
    />
  )
}
