import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { BackgroundCreatePage } from '#domains/backgrounds'

export const Route = createFileRoute('/_authed/backgrounds/new')({
  loader: ({ context }) => context.queryClient.ensureQueryData(
    getSystemList(createServerApi(context.accessToken))
  ),
  component: NewBackgroundRoute
})

function NewBackgroundRoute() {
  const { user } = Route.useRouteContext()

  return <BackgroundCreatePage userId={user?.id ?? 'unknown-user'} />
}
