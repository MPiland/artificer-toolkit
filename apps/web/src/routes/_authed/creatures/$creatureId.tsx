import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getCreature, getCreatureDraft } from '#app/data/creatures/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/creatures/$creatureId')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    await Promise.all([
      context.queryClient.ensureQueryData(getCreature(params.creatureId, client)),
      context.queryClient.ensureQueryData(getCreatureDraft(params.creatureId, client))
    ])
  },
  component: CreatureRoute
})

function CreatureRoute() {
  return <Outlet />
}
