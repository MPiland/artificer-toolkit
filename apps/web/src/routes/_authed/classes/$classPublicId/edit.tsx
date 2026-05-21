import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/classes/$classPublicId/edit')({
  loader: ({ params }) => {
    throw redirect({
      params: buildClassRouteParams(parseAuthoredRouteId(params.classPublicId), 'item'),
      replace: true,
      to: '/classes/$classPublicId/$classSlug/edit'
    })
  }
})
