import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { CreatureDetailPage } from '#domains/creatures/pages/CreatureDetailPage'

export const Route = createFileRoute('/_authed/creatures/$creatureId/')({
  component: CreatureDetailRoute
})

function CreatureDetailRoute() {
  const parentRoute = getRouteApi('/_authed/creatures/$creatureId')
  const { draft, response } = parentRoute.useLoaderData()
  const { creatureId } = parentRoute.useParams()

  return <CreatureDetailPage creatureId={creatureId} draft={draft} response={response} />
}
