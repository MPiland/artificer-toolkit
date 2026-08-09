import { createFileRoute, redirect } from '@tanstack/react-router'
import { getEquipment, getEquipmentDraft } from '#app/data/equipment/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'
import type { EquipmentEditLoaderData } from '#app/routes/-routeLoaderData'
import { loadAuthoredRouteSystem } from '#app/routes/-authoredRouteSystem'
import { AuthoringLayout } from '#forms'
import { equipmentAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/equipment/$equipmentPublicId/$equipmentSlug/edit')({
  context: () => createAuthoredFormRouteContext('equipment', 'edit'),
  loader: async ({ context, params }): Promise<EquipmentEditLoaderData> => {
    const client = createServerApi()
    const equipmentId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.equipment.list(),
      publicId: params.equipmentPublicId,
      queryClient: context.queryClient,
      subjectKind: 'EQUIPMENT'
    })
    const activeEquipmentQuery = getEquipment(equipmentId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeEquipmentQuery),
      context.queryClient.ensureQueryData(getEquipmentDraft(equipmentId, client))
    ])
    const routeSubject = getAuthoredRouteSubject(equipmentId, response, draft)
    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.equipmentPublicId, params.equipmentSlug, routeSubject)
    ) {
      throw redirect({
        params: buildEquipmentRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
      })
    }

    const parsedDraft = equipmentAuthoringInputDtoSchema.safeParse(draft?.payload)
    const currentEquipment = parsedDraft.success ? parsedDraft.data : response?.item
    const system = await loadAuthoredRouteSystem(
      context.queryClient,
      client,
      currentEquipment?.systemId
    )
    const parentResponse =
      currentEquipment?.category === 'VARIANT'
        ? await ensureOptionalActiveContent(
            context.queryClient,
            getEquipment(currentEquipment.parentEquipmentId, client)
          )
        : null

    return createAuthoredFormRouteLoaderData({
      breadcrumbLabel: routeSubject?.label,
      draft,
      parentResponse,
      response,
      subjectId: equipmentId,
      system
    })
  },
  component: AuthoringLayout
})
