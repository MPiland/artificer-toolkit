import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/spells/$spellPublicId/edit')({
  loader: ({ params }) => {
    throw redirect({
      params: buildSpellRouteParams(parseAuthoredRouteId(params.spellPublicId), 'item'),
      replace: true,
      to: '/spells/$spellPublicId/$spellSlug/edit'
    })
  }
})
