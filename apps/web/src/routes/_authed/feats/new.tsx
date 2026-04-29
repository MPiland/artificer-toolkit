import { createFileRoute } from '@tanstack/react-router'
import { getEffectReferenceData } from '#app/data/effects'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { FeatCreatePage } from '#domains/feats'

export const Route = createFileRoute('/_authed/feats/new')({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(getSystemList(createServerApi(context.accessToken))),
    context.queryClient.ensureQueryData(getEffectReferenceData(createServerApi(context.accessToken)))
  ]),
  component: NewFeatRoute
})

function NewFeatRoute() {
  const { user } = Route.useRouteContext()

  return <FeatCreatePage userId={user?.id ?? 'unknown-user'} />
}
