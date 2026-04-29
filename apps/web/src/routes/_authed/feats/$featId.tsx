import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getEffectReferenceData } from '#app/data/effects'
import { getFeat, getFeatDraft } from '#app/data/feats/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/feats/$featId')({
  loader: ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    return Promise.all([
      context.queryClient.ensureQueryData(getFeat(params.featId, client)),
      context.queryClient.ensureQueryData(getFeatDraft(params.featId, client)),
      context.queryClient.ensureQueryData(getEffectReferenceData(client))
    ])
  },
  component: FeatRoute
})

function FeatRoute() {
  return <Outlet />
}
