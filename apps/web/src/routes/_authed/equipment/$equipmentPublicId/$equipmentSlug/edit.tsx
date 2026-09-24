import { createFileRoute, redirect } from '@tanstack/react-router'
import { equipmentResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getEquipment } from '#app/data/equipment/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
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
    const [active, working] = await Promise.all([
      context.queryClient.ensureQueryData(getEquipment(params.equipmentPublicId)),
      context.queryClient.ensureQueryData(
        getEquipment({ id: params.equipmentPublicId, view: 'draft' })
      )
    ])
    const response = equipmentResponseDtoSchema.parse(active)
    const draft = equipmentResponseDtoSchema.parse(working)?.draft ?? null
    const equipmentId = response?.item?.id ?? draft?.subjectId ?? params.equipmentPublicId
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
    const [system, parent] = await Promise.all([
      loadAuthoredRouteSystem(context.queryClient, currentEquipment?.systemId ?? draft?.systemId),
      currentEquipment?.category === 'VARIANT'
        ? context.queryClient.ensureQueryData(getEquipment(currentEquipment.parentEquipmentId))
        : null
    ])
    const parentResponse = equipmentResponseDtoSchema.parse(parent)

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
