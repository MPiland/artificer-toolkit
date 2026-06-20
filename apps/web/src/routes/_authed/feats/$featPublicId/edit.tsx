import { createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredEditPath } from '#app/routing/authoredLegacyRoutes'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/feats/$featPublicId/edit')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredEditPath(location.pathname, 'feats')) return null

    throw redirect({
      params: buildFeatRouteParams(parseAuthoredRouteId(params.featPublicId), 'item'),
      replace: true,
      to: '/feats/$featPublicId/$featSlug/edit'
    })
  }
})
