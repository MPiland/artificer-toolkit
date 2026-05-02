import { notifications } from '@mantine/notifications'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildEquipmentListFilters,
  equipmentListAttributeColumns,
  equipmentListSortOptions,
  mapEquipmentListToAuthoredItems,
  summarizeEquipmentList
} from '#app/data/equipment/equipmentListMapper'
import { useDuplicateEquipmentMutation } from '#app/data/equipment/mutations'
import { getEquipmentList } from '#app/data/equipment/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/equipment/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getEquipmentList(createServerApi(context.accessToken))),
  component: EquipmentRoute
})

function EquipmentRoute() {
  const navigate = useNavigate()
  const { data } = useSuspenseQuery(getEquipmentList())
  const duplicateMutation = useDuplicateEquipmentMutation()

  async function handleDuplicate(equipmentId: string) {
    try {
      const response = await duplicateMutation.mutateAsync(equipmentId)
      notifications.show({
        color: 'green',
        message: 'Equipment duplicated as an owned draft.'
      })
      if (response?.subjectId) {
        await navigate({ to: '/equipment/$equipmentId/edit', params: { equipmentId: response.subjectId } })
      }
    } catch {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that equipment yet.'
      })
    }
  }

  return (
    <AuthoredListPage
      title='Equipment'
      summary={summarizeEquipmentList(data)}
      createLabel='Create Equipment'
      items={mapEquipmentListToAuthoredItems(data)}
      filters={buildEquipmentListFilters(data)}
      attributeColumns={equipmentListAttributeColumns}
      sortOptions={equipmentListSortOptions}
      onCreate={() => navigate({ to: '/equipment/new' })}
      onView={(item) => navigate({ to: '/equipment/$equipmentId/edit', params: { equipmentId: item.id } })}
      onEdit={(item) => navigate({ to: '/equipment/$equipmentId/edit', params: { equipmentId: item.id } })}
      onCopy={(item) => void handleDuplicate(item.id)}
    />
  )
}
