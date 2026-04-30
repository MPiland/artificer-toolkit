import { createFileRoute } from '@tanstack/react-router'
import { getEffectReferenceData } from '#app/data/effects'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { EquipmentCreatePage } from '#domains/equipment'

export const Route = createFileRoute('/_authed/equipment/new')({
  loader: async ({ context }) => {
    const client = createServerApi(context.accessToken)
    const systems = await context.queryClient.ensureQueryData(getSystemList(client))
    await context.queryClient.ensureQueryData(getEffectReferenceData(systems[0]?.id, client))
  },
  component: NewEquipmentRoute
})

function NewEquipmentRoute() {
  const { user } = Route.useRouteContext()

  return <EquipmentCreatePage userId={user?.id ?? 'unknown-user'} />
}
