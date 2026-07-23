import { notifications } from '@mantine/notifications'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import {
  buildEquipmentListFilters,
  equipmentListAttributeColumns,
  equipmentListSortOptions,
  formatEquipmentCategory,
  mapEquipmentListToAuthoredItems,
  summarizeEquipmentList
} from '#app/data/equipment/equipmentListMapper'
import { useDuplicateEquipmentMutation } from '#app/data/equipment/mutations'
import { getEquipment, getEquipmentList } from '#app/data/equipment/queries'
import { createServerApi } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'

const equipmentDetailMeta = ['equipment', 'rarities']

export const Route = createFileRoute('/_authed/equipment/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureQueryData(getEquipmentList(createServerApi()))
  },
  component: EquipmentRoute
})

function EquipmentRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getEquipmentList())
  const duplicateMutation = useDuplicateEquipmentMutation()
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: api.content.equipment.deleteActive,
    deleteDraft: api.content.equipment.discardDraft,
    detailSubjectQueryKey: queryKeys.content.equipment.detailRoot,
    domainLabel: 'Equipment',
    domainQueryKey: queryKeys.content.equipment.all(),
    draftQueryKey: queryKeys.content.equipment.draft
  })

  async function handleDuplicate(equipmentId: string) {
    try {
      const response = await duplicateMutation.mutateAsync(equipmentId)
      notifications.show({
        color: 'green',
        message: 'Equipment duplicated as an owned draft.'
      })
      if (response?.subjectId) {
        await navigate({
          params: buildEquipmentRouteParams(response.publicId, response.label),
          to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
        })
      }
    } catch {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that equipment yet.'
      })
    }
  }

  return (
    <>
      <AuthoredListPage
        title='Equipment'
        summary={summarizeEquipmentList(data)}
        createLabel='Create Equipment'
        items={mapEquipmentListToAuthoredItems(data)}
        draftItems={mapDraftSummariesToAuthoredItems(data.drafts, {
          categoryAttributeKey: 'Category',
          formatCategory: formatEquipmentCategory
        })}
        filters={buildEquipmentListFilters(data)}
        attributeColumns={equipmentListAttributeColumns}
        sortOptions={equipmentListSortOptions}
        onCreate={() => navigate({ to: '/equipment/new' })}
        onView={(item) => navigate({
          params: buildEquipmentRouteParams(item.publicId, item.name),
          search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
          to: '/equipment/$equipmentPublicId/$equipmentSlug'
        })}
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(getEquipment({
            id: item.id,
            meta: equipmentDetailMeta,
            view: item.contentState === 'draft' ? 'draft' : 'active'
          }))
        }}
        onEdit={(item) => navigate({
          params: buildEquipmentRouteParams(item.publicId, item.name),
          to: '/equipment/$equipmentPublicId/$equipmentSlug/edit'
        })}
        onCopy={(item) => void handleDuplicate(item.id)}
        onDelete={(item) => deleteAction.requestDelete({
          id: item.id,
          kind: item.contentState === 'draft' ? 'draft' : 'active',
          label: item.name
        })}
      />
      {deleteAction.confirmation}
    </>
  )
}
