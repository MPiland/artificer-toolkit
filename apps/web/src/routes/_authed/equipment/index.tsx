import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildEquipmentListFilters,
  equipmentListAttributeColumns,
  equipmentListSortOptions,
  mapEquipmentListToAuthoredItems,
  summarizeEquipmentList
} from '#app/data/equipment/equipmentListMapper'
import { getEquipmentList } from '#app/data/equipment/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export const Route = createFileRoute('/_authed/equipment/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getEquipmentList(createServerApi(context.accessToken))),
  component: EquipmentRoute
})

function EquipmentRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getEquipmentList())
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.content.equipment.duplicate(id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
      notifications.show({
        color: 'green',
        message: 'Equipment duplicated as owned content.'
      })
      if (response?.subjectId) {
        await navigate({ to: '/equipment/$equipmentId/edit', params: { equipmentId: response.subjectId } })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that equipment yet.'
      })
    }
  })

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
      onView={(item) => navigate({ to: '/equipment/$equipmentId', params: { equipmentId: item.id } })}
      onEdit={(item) => navigate({ to: '/equipment/$equipmentId/edit', params: { equipmentId: item.id } })}
      onCopy={(item) => duplicateMutation.mutate(item.id)}
    />
  )
}
