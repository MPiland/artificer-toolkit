import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getRace, getRaceDraft } from '#app/data/races/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/races/$raceId')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    await Promise.all([
      context.queryClient.ensureQueryData(getRace(params.raceId, client)),
      context.queryClient.ensureQueryData(getRaceDraft(params.raceId, client))
    ])
  },
  component: RaceRoute
})

function RaceRoute() {
  return <Outlet />
}
