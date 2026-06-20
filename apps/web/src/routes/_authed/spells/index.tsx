import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import { createServerApi } from '#lib/api'
import { getSpell, getSpellList } from '#app/data/spells/queries'
import {
  buildSpellListFilters,
  mapSpellListToAuthoredItems,
  spellListAttributeColumns,
  spellListSortOptions,
  summarizeSpellList
} from '#app/data/spells/spellListMapper'
import { queryKeys } from '#app/lib/queryKeys'
import { api } from '#app/lib/api'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'

const spellDetailMeta = ['classes', 'conditionTypes', 'damageTypes', 'magicSchools']

export const Route = createFileRoute('/_authed/spells/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureQueryData(getSpellList(createServerApi()))
  },
  component: SpellsRoute
})

function SpellsRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(getSpellList())
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.content.spells.duplicate(id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.spells.all() })
      notifications.show({
        color: 'green',
        message: 'Spell duplicated as owned content.'
      })
      if (response?.subjectId) {
        await navigate({
          params: buildSpellRouteParams(response.publicId, response.label),
          to: '/spells/$spellPublicId/$spellSlug/edit'
        })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that spell yet.'
      })
    }
  })
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: api.content.spells.deleteActive,
    deleteDraft: api.content.spells.discardDraft,
    detailSubjectQueryKey: queryKeys.content.spells.detailRoot,
    domainLabel: 'Spell',
    domainQueryKey: queryKeys.content.spells.all(),
    draftQueryKey: queryKeys.content.spells.draft
  })
  const spellMeta = data.meta as { schools?: Array<{ id: string | number, label?: string }> }

  return (
    <>
      <AuthoredListPage
        title='Spells'
        summary={summarizeSpellList(data)}
        createLabel='Create Spell'
        items={mapSpellListToAuthoredItems(data)}
        draftItems={mapDraftSummariesToAuthoredItems(data.drafts, {
          formatSchool: (schoolId) => {
            if (!schoolId) return undefined
            const school = (spellMeta.schools ?? []).find((entry) => String(entry.id) === schoolId)
            return school?.label ?? schoolId
          }
        })}
        filters={buildSpellListFilters(data)}
        attributeColumns={spellListAttributeColumns}
        sortOptions={spellListSortOptions}
        onCreate={() => navigate({ to: '/spells/new' })}
        onView={(item) => navigate({
          params: buildSpellRouteParams(item.publicId, item.name),
          search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
          to: '/spells/$spellPublicId/$spellSlug'
        })}
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(getSpell({
            id: item.id,
            includeDraft: true,
            meta: spellDetailMeta,
            view: item.contentState === 'draft' ? 'draft' : 'active'
          }))
        }}
        onEdit={(item) => navigate({
          params: buildSpellRouteParams(item.publicId, item.name),
          to: '/spells/$spellPublicId/$spellSlug/edit'
        })}
        onCopy={(item) => duplicateMutation.mutate(item.id)}
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
