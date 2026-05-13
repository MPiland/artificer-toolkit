import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundPublicId/edit')({
  loader: ({ params }) => {
    throw redirect({
      params: buildBackgroundRouteParams(parseAuthoredRouteId(params.backgroundPublicId), 'item'),
      replace: true,
      to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
    })
  }
})
