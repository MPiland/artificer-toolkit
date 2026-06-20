import { createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredEditPath } from '#app/routing/authoredLegacyRoutes'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundPublicId/edit')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredEditPath(location.pathname, 'backgrounds')) return null

    throw redirect({
      params: buildBackgroundRouteParams(parseAuthoredRouteId(params.backgroundPublicId), 'item'),
      replace: true,
      to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
    })
  }
})
