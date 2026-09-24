import { createFileRoute, redirect } from '@tanstack/react-router'
import { equipmentResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getEquipment, useGetEquipment } from '#app/data/equipment/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'
import {
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from '#app/routing/authoredDetailSearch'
import type { EquipmentDetailLoaderData } from '#app/routes/-routeLoaderData'
import { EquipmentDetailPage } from '#domains/equipment/pages/EquipmentDetailPage'

const equipmentDetailMeta = ['classes', 'currencies', 'equipment', 'heritages', 'rarities']

export const Route = createFileRoute('/_authed/equipment/$equipmentPublicId/$equipmentSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({
    context,
    deps: search,
    location,
    params
  }): Promise<EquipmentDetailLoaderData> => {
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = equipmentResponseDtoSchema.parse(
      await context.queryClient.ensureQueryData(
        getEquipment({ id: params.equipmentPublicId, meta: equipmentDetailMeta, view })
      )
    )
    const draft = response?.draft ?? null
    const equipmentId = response?.item?.id ?? draft?.subjectId ?? params.equipmentPublicId
    const references = {
      classes: response?.meta?.classes ?? [],
      currencies: response?.meta?.currencies ?? [],
      equipment: response?.meta?.equipment ?? [],
      heritages: response?.meta?.heritages ?? [],
      rarities: response?.meta?.rarities ?? []
    }
    const routeSubject = getAuthoredRouteSubject(equipmentId, response, draft)
    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.equipmentPublicId, params.equipmentSlug, routeSubject)
    ) {
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
  const { equipmentId, view } = Route.useLoaderData()
  const { equipmentPublicId } = Route.useParams()
  const { data: response } = useGetEquipment({
    id: equipmentPublicId,
    meta: equipmentDetailMeta,
    view
  })

  return (
    <EquipmentDetailPage
      draft={response?.draft ?? null}
      equipmentId={equipmentId}
      references={{
        classes: response?.meta?.classes ?? [],
        currencies: response?.meta?.currencies ?? [],
        equipment: response?.meta?.equipment ?? [],
        heritages: response?.meta?.heritages ?? [],
        rarities: response?.meta?.rarities ?? []
      }}
      response={response}
      view={view}
    />
  )
}
