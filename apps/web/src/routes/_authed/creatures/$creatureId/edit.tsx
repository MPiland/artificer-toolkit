import { createFileRoute } from '@tanstack/react-router'
import { CreatureEditPage } from '#domains/creatures'

export const Route = createFileRoute('/_authed/creatures/$creatureId/edit')({
  component: CreatureEditRoute
})

function CreatureEditRoute() {
  const { user } = Route.useRouteContext()
  const { creatureId } = Route.useParams()

  return <CreatureEditPage creatureId={creatureId} mode='edit' userId={user?.id ?? 'unknown-user'} />
}
