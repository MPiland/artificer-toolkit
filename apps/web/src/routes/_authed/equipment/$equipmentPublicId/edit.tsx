import { createFileRoute, redirect } from '@tanstack/react-router'
import { isLegacyAuthoredEditPath } from '#app/routing/authoredLegacyRoutes'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/equipment/$equipmentPublicId/edit')({
  loader: ({ location, params }) => {
    if (!isLegacyAuthoredEditPath(location.pathname, 'equipment')) return null

    throw redirect({
      params: buildEquipmentRouteParams(parseAuthoredRouteId(params.equipmentPublicId), 'item'),
      replace: true,
      to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
    })
  }
})
