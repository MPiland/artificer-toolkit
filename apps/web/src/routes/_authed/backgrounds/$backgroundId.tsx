import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getBackground, getBackgroundDraft } from '#app/data/backgrounds/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundId')({
  loader: ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    return Promise.all([
      context.queryClient.ensureQueryData(getBackground(params.backgroundId, client)),
      context.queryClient.ensureQueryData(getBackgroundDraft(params.backgroundId, client))
    ])
  },
  component: BackgroundRoute
})

function BackgroundRoute() {
  return <Outlet />
}
