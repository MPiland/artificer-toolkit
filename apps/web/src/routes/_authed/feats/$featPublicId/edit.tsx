import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/feats/$featPublicId/edit')({
  loader: ({ params }) => {
    throw redirect({
      params: buildFeatRouteParams(parseAuthoredRouteId(params.featPublicId), 'item'),
      replace: true,
      to: '/feats/$featPublicId/$featSlug/edit'
    })
  }
})
