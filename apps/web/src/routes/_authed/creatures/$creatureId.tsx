import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getCreature, getCreatureDraft } from '#app/data/creatures/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/creatures/$creatureId')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    const activeCreatureQuery = getCreature(params.creatureId, client)
    await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeCreatureQuery),
      context.queryClient.ensureQueryData(getCreatureDraft(params.creatureId, client))
    ])
  },
  component: CreatureRoute
})

function CreatureRoute() {
  return <Outlet />
}
