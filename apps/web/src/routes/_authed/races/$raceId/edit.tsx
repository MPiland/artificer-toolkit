import { createFileRoute } from '@tanstack/react-router'
import { RaceEditPage } from '#domains/races'

export const Route = createFileRoute('/_authed/races/$raceId/edit')({
  component: EditRaceRoute
})

function EditRaceRoute() {
  const { user } = Route.useRouteContext()
  const { raceId } = Route.useParams()

  return <RaceEditPage raceId={raceId} mode='edit' userId={user?.id ?? 'unknown-user'} />
}
