import { createFileRoute } from '@tanstack/react-router'
import { EquipmentDetailPage } from '#domains/equipment'

export const Route = createFileRoute('/_authed/equipment/$equipmentId/')({
  component: EquipmentViewRoute
})

function EquipmentViewRoute() {
  const { user } = Route.useRouteContext()
  const { equipmentId } = Route.useParams()

  return <EquipmentDetailPage equipmentId={equipmentId} mode='view' userId={user?.id ?? 'unknown-user'} />
}
