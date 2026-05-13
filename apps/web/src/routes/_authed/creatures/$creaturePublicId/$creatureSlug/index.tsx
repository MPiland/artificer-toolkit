import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { CreatureDetailPage } from '#domains/creatures/pages/CreatureDetailPage'

export const Route = createFileRoute('/_authed/creatures/$creaturePublicId/$creatureSlug/')({
  component: CreatureDetailRoute
})

function CreatureDetailRoute() {
  const parentRoute = getRouteApi('/_authed/creatures/$creaturePublicId/$creatureSlug')
  const {
    creatureId, draft, references, response, view
  } = parentRoute.useLoaderData()

  return <CreatureDetailPage creatureId={creatureId} draft={draft} references={references} response={response} view={view} />
}
