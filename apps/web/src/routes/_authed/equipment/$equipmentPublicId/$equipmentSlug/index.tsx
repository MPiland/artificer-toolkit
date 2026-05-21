import { createFileRoute, redirect } from '@tanstack/react-router'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { getEquipment } from '#app/data/equipment/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle,
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'
import { validateAuthoredDetailSearch } from '#app/routing/authoredDetailSearch'
import { EquipmentDetailPage } from '#domains/equipment/pages/EquipmentDetailPage'

const equipmentDetailMeta = ['equipment', 'rarities']

export const Route = createFileRoute('/_authed/equipment/$equipmentPublicId/$equipmentSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, params }) => {
    const client = createServerApi()
    const equipmentId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.equipment.list(),
      publicId: params.equipmentPublicId,
      queryClient: context.queryClient,
      subjectKind: 'EQUIPMENT'
    })
    const view = search.view ?? 'active'
    const response = await ensureOptionalActiveContent(context.queryClient, getEquipment({
      id: equipmentId,
      includeDraft: true,
      meta: equipmentDetailMeta,
      view
    }, client))
    const draft = response?.draft ?? null
    const references: Pick<AuthoredContentReferenceData, 'equipment' | 'rarities'> = {
      equipment: response?.meta?.equipment ?? [],
      rarities: response?.meta?.rarities ?? []
    }
    const routeSubject = getAuthoredRouteSubject(equipmentId, response, draft)
    if (routeSubject && !isCanonicalAuthoredRouteHandle(params.equipmentPublicId, params.equipmentSlug, routeSubject)) {
      throw redirect({
        params: buildEquipmentRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/equipment/$equipmentPublicId/$equipmentSlug'
      })
    }

    return { breadcrumbLabel: routeSubject?.label, draft, equipmentId, references, response, view }
  },
  component: EquipmentDetailRoute
})

function EquipmentDetailRoute() {
  const {
    draft, equipmentId, references, response, view
  } = Route.useLoaderData()

  return <EquipmentDetailPage draft={draft} equipmentId={equipmentId} references={references} response={response} view={view} />
}
