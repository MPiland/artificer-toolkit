import { notifications } from '@mantine/notifications'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildClassListFilters,
  classListAttributeColumns,
  classListSortOptions,
  mapClassListToAuthoredItems,
  summarizeClassList
} from '#app/data/classes/classListMapper'
import { useDuplicateClassMutation } from '#app/data/classes/mutations'
import { getClassList } from '#app/data/classes/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/classes/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getClassList(createServerApi(context.accessToken))),
  component: ClassesRoute
})

function ClassesRoute() {
  const navigate = useNavigate()
  const { data } = useSuspenseQuery(getClassList())
  const duplicateMutation = useDuplicateClassMutation()

  async function handleDuplicate(classId: string) {
    try {
      const response = await duplicateMutation.mutateAsync(classId)
      notifications.show({
        color: 'green',
        message: 'Class duplicated as an owned draft.'
      })
      if (response?.subjectId) {
        await navigate({ to: '/classes/$classId/edit', params: { classId: response.subjectId } })
      }
    } catch {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that class yet.'
      })
    }
  }

  return (
    <AuthoredListPage
      title='Classes'
      summary={summarizeClassList(data)}
      createLabel='Create Class'
      items={mapClassListToAuthoredItems(data)}
      filters={buildClassListFilters(data)}
      attributeColumns={classListAttributeColumns}
      sortOptions={classListSortOptions}
      onCreate={() => navigate({ to: '/classes/new' })}
      onView={(item) => navigate({ to: '/classes/$classId/edit', params: { classId: item.id } })}
      onEdit={(item) => navigate({ to: '/classes/$classId/edit', params: { classId: item.id } })}
      onCopy={(item) => void handleDuplicate(item.id)}
    />
  )
}
