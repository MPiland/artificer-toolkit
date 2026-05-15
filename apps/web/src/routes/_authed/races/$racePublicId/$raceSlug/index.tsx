import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { RaceDetailPage } from '#domains/races/pages/RaceDetailPage'

export const Route = createFileRoute('/_authed/races/$racePublicId/$raceSlug/')({
  component: RaceDetailRoute
})

function RaceDetailRoute() {
  const parentRoute = getRouteApi('/_authed/races/$racePublicId/$raceSlug')
  const {
    draft, parentResponse, raceId, references, response, view
  } = parentRoute.useLoaderData()

  return <RaceDetailPage draft={draft} parentResponse={parentResponse} raceId={raceId} references={references} response={response} view={view} />
}
