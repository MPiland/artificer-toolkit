import { createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredEditPath } from '#app/routing/authoredLegacyRoutes'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/classes/$classPublicId/edit')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredEditPath(location.pathname, 'classes')) return null

    throw redirect({
      params: buildClassRouteParams(parseAuthoredRouteId(params.classPublicId), 'item'),
      replace: true,
      to: '/classes/$classPublicId/$classSlug/edit'
    })
  }
})
