import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { RaceDetailPage } from '#domains/races/pages/RaceDetailPage'

export const Route = createFileRoute('/_authed/races/$raceId/')({
  component: RaceDetailRoute
})

function RaceDetailRoute() {
  const parentRoute = getRouteApi('/_authed/races/$raceId')
  const { draft, response } = parentRoute.useLoaderData()
  const { raceId } = parentRoute.useParams()

  return <RaceDetailPage draft={draft} raceId={raceId} response={response} />
}
