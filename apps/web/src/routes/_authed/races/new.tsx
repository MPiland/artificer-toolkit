import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { RaceCreatePage } from '#domains/races'

export const Route = createFileRoute('/_authed/races/new')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getSystemList(createServerApi(context.accessToken)))
  },
  component: NewRaceRoute
})

function NewRaceRoute() {
  const { user } = Route.useRouteContext()

  return <RaceCreatePage userId={user?.id ?? 'unknown-user'} />
}
