import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { FeatDetailPage } from '#domains/feats/pages/FeatDetailPage'

export const Route = createFileRoute('/_authed/feats/$featPublicId/$featSlug/')({
  component: FeatDetailRoute
})

function FeatDetailRoute() {
  const parentRoute = getRouteApi('/_authed/feats/$featPublicId/$featSlug')
  const {
    draft, featId, response, view
  } = parentRoute.useLoaderData()

  return <FeatDetailPage draft={draft} featId={featId} response={response} view={view} />
}
