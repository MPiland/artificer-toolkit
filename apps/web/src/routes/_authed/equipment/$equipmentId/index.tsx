import { createFileRoute } from '@tanstack/react-router'
import { getEquipment, getEquipmentDraft } from '#app/data/equipment/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { EquipmentDetailPage } from '#domains/equipment/pages/EquipmentDetailPage'

export const Route = createFileRoute('/_authed/equipment/$equipmentId/')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    const activeEquipmentQuery = getEquipment(params.equipmentId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeEquipmentQuery),
      context.queryClient.ensureQueryData(getEquipmentDraft(params.equipmentId, client))
    ])

    return { draft, response }
  },
  component: EquipmentDetailRoute
})

function EquipmentDetailRoute() {
  const { draft, response } = Route.useLoaderData()
  const { equipmentId } = Route.useParams()

  return <EquipmentDetailPage draft={draft} equipmentId={equipmentId} response={response} />
}
