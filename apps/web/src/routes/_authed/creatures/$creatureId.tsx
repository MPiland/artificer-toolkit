import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getAuthoredContentReferenceData } from '#app/data/contentReferences'
import { getCreature, getCreatureDraft } from '#app/data/creatures/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/creatures/$creatureId')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const activeCreatureQuery = getCreature(params.creatureId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeCreatureQuery),
      context.queryClient.ensureQueryData(getCreatureDraft(params.creatureId, client))
    ])
    const references = await context.queryClient.ensureQueryData(
      getAuthoredContentReferenceData(response?.item.systemId ?? draft?.systemId, client)
    )

    return { draft, references, response }
  },
  component: CreatureRoute
})

function CreatureRoute() {
  return <Outlet />
}
