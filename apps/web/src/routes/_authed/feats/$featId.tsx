import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getEffectReferenceData } from '#app/data/effects'
import { getFeat } from '#app/data/feats/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/feats/$featId')({
  loader: ({ context, params }) => Promise.all([
    context.queryClient.ensureQueryData(getFeat(params.featId, createServerApi(context.accessToken))),
    context.queryClient.ensureQueryData(getEffectReferenceData(createServerApi(context.accessToken)))
  ]),
  component: FeatRoute
})

function FeatRoute() {
  return <Outlet />
}
