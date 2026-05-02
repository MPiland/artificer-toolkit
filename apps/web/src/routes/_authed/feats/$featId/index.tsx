import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { FeatDetailPage } from '#domains/feats/pages/FeatDetailPage'

export const Route = createFileRoute('/_authed/feats/$featId/')({
  component: FeatDetailRoute
})

function FeatDetailRoute() {
  const parentRoute = getRouteApi('/_authed/feats/$featId')
  const { draft, response } = parentRoute.useLoaderData()
  const { featId } = parentRoute.useParams()

  return <FeatDetailPage draft={draft} featId={featId} response={response} />
}
