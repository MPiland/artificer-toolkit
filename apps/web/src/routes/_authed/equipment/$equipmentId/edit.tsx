import { createFileRoute } from '@tanstack/react-router'
import { getEquipment, getEquipmentDraft } from '#app/data/equipment/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { EquipmentEditPage } from '#domains/equipment'

export const Route = createFileRoute('/_authed/equipment/$equipmentId/edit')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const activeEquipmentQuery = getEquipment(params.equipmentId, client)
    const [response, draft, systems] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeEquipmentQuery),
      context.queryClient.ensureQueryData(getEquipmentDraft(params.equipmentId, client)),
      context.queryClient.ensureQueryData(getSystemList(client))
    ])

    return {
      draft,
      response,
      systems
    }
  },
  component: () => <EquipmentEditPage />
})
