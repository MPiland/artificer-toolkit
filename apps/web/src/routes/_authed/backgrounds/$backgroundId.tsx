import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getBackground } from '#app/data/backgrounds/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(
    getBackground(params.backgroundId, createServerApi(context.accessToken))
  ),
  component: BackgroundRoute
})

function BackgroundRoute() {
  return <Outlet />
}
