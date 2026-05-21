import { createFileRoute, redirect } from '@tanstack/react-router'
import { getEquipment, getEquipmentDraft } from '#app/data/equipment/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle,
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'
import { EquipmentEditPage } from '#domains/equipment'

export const Route = createFileRoute('/_authed/equipment/$equipmentPublicId/$equipmentSlug/edit')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const equipmentId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.equipment.list(),
      publicId: params.equipmentPublicId,
      queryClient: context.queryClient,
      subjectKind: 'EQUIPMENT'
    })
    const activeEquipmentQuery = getEquipment(equipmentId, client)
    const [response, draft, systems] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeEquipmentQuery),
      context.queryClient.ensureQueryData(getEquipmentDraft(equipmentId, client)),
      context.queryClient.ensureQueryData(getSystemList(client))
    ])
    const routeSubject = getAuthoredRouteSubject(equipmentId, response, draft)
    if (routeSubject && !isCanonicalAuthoredRouteHandle(params.equipmentPublicId, params.equipmentSlug, routeSubject)) {
      throw redirect({
        params: buildEquipmentRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
      })
    }

    return {
      breadcrumbLabel: routeSubject?.label,
      draft,
      equipmentId,
      response,
      systems
    }
  },
  component: () => <EquipmentEditPage />
})
