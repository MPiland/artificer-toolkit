import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/races/$racePublicId/edit')({
  loader: ({ params }) => {
    throw redirect({
      params: buildRaceRouteParams(parseAuthoredRouteId(params.racePublicId), 'item'),
      replace: true,
      to: '/races/$racePublicId/$raceSlug/edit'
    })
  }
})
