import { createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredEditPath } from '#app/routing/authoredLegacyRoutes'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/spells/$spellPublicId/edit')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredEditPath(location.pathname, 'spells')) return null

    throw redirect({
      params: buildSpellRouteParams(parseAuthoredRouteId(params.spellPublicId), 'item'),
      replace: true,
      to: '/spells/$spellPublicId/$spellSlug/edit'
    })
  }
})
