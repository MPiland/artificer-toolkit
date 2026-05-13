import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/characters/$characterPublicId/edit')({
  loader: ({ params }) => {
    throw redirect({
      params: buildCharacterRouteParams(parseAuthoredRouteId(params.characterPublicId), 'item'),
      replace: true,
      to: '/characters/$characterPublicId/$characterSlug/edit'
    })
  }
})
