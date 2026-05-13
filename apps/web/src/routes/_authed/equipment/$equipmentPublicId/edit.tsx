import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'
import { parseAuthoredRouteId } from '#app/routing/authoredRouteHandles'

export const Route = createFileRoute('/_authed/equipment/$equipmentPublicId/edit')({
  loader: ({ params }) => {
    throw redirect({
      params: buildEquipmentRouteParams(parseAuthoredRouteId(params.equipmentPublicId), 'item'),
      replace: true,
      to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
    })
  }
})
