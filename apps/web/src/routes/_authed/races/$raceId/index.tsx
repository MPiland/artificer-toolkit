import { createFileRoute } from '@tanstack/react-router'
import { RaceDetailPage } from '#domains/races'

export const Route = createFileRoute('/_authed/races/$raceId/')({
  component: RaceViewRoute
})

function RaceViewRoute() {
  const { user } = Route.useRouteContext()
  const { raceId } = Route.useParams()

  return <RaceDetailPage raceId={raceId} mode='view' userId={user?.id ?? 'unknown-user'} />
}
