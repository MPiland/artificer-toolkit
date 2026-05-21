import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/creatures/$creaturePublicId/edit')({
  loader: ({ params }) => {
    throw redirect({
      params: buildCreatureRouteParams(parseAuthoredRouteId(params.creaturePublicId), 'item'),
      replace: true,
      to: '/creatures/$creaturePublicId/$creatureSlug/edit'
    })
  }
})
