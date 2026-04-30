import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getEffectReferenceData } from '#app/data/effects'
import { getEquipment, getEquipmentDraft } from '#app/data/equipment/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/equipment/$equipmentId')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    const [response, draft] = await Promise.all([
      context.queryClient.ensureQueryData(getEquipment(params.equipmentId, client)),
      context.queryClient.ensureQueryData(getEquipmentDraft(params.equipmentId, client))
    ])
    const systemId = draft?.systemId ?? response?.item.systemId
    if (systemId) {
      await context.queryClient.ensureQueryData(getEffectReferenceData(systemId, client))
    }
  },
  component: EquipmentRoute
})

function EquipmentRoute() {
  return <Outlet />
}
