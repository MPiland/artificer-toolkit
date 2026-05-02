import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { CreatureCreatePage } from '#domains/creatures'

export const Route = createFileRoute('/_authed/creatures/new')({
  loader: async ({ context }) => {
    const client = createServerApi(context.accessToken)
    await context.queryClient.ensureQueryData(getSystemList(client))
  },
  component: NewCreatureRoute
})

function NewCreatureRoute() {
  const { user } = Route.useRouteContext()

  return <CreatureCreatePage userId={user?.id ?? 'unknown-user'} />
}
