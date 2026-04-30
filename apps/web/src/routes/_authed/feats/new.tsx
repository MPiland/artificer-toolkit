import { createFileRoute } from '@tanstack/react-router'
import { getEffectReferenceData } from '#app/data/effects'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { FeatCreatePage } from '#domains/feats'
import { resolveCreateFeatSystemId } from '#domains/feats/featAuthoring.utils'

export const Route = createFileRoute('/_authed/feats/new')({
  loader: async ({ context }) => {
    const client = createServerApi(context.accessToken)
    const systems = await context.queryClient.ensureQueryData(getSystemList(client))
    const systemId = resolveCreateFeatSystemId(systems)

    await context.queryClient.ensureQueryData(getEffectReferenceData(systemId ?? undefined, client))
  },
  component: NewFeatRoute
})

function NewFeatRoute() {
  const { user } = Route.useRouteContext()

  return <FeatCreatePage userId={user?.id ?? 'unknown-user'} />
}
