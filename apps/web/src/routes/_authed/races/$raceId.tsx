import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getAuthoredContentReferenceData } from '#app/data/contentReferences'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getRace, getRaceDraft } from '#app/data/races/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/races/$raceId')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const activeRaceQuery = getRace(params.raceId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeRaceQuery),
      context.queryClient.ensureQueryData(getRaceDraft(params.raceId, client))
    ])
    const references = await context.queryClient.ensureQueryData(
      getAuthoredContentReferenceData(response?.item.systemId ?? draft?.systemId, client)
    )

    return { draft, references, response }
  },
  component: RaceRoute
})

function RaceRoute() {
  return <Outlet />
}
