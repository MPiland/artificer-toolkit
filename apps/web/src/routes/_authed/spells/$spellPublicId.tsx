import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredDetailPath } from '#app/routing/authoredLegacyRoutes'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/spells/$spellPublicId')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredDetailPath(location.pathname, 'spells')) return null

    throw redirect({
      params: buildSpellRouteParams(parseAuthoredRouteId(params.spellPublicId), 'item'),
      replace: true,
      to: '/spells/$spellPublicId/$spellSlug'
    })
  },
  component: () => <Outlet />
})
