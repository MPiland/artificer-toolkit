import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useAuthoredCatalogWindow } from '#components/AuthoredList/useAuthoredCatalogWindow'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import { createServerApi } from '#lib/api'
import { getSpell, getSpellList, useGetSpellList } from '#app/data/spells/queries'
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
import type { SpellListRequestDto } from '#app/lib/api'

const spellDetailMeta = ['classes', 'conditionTypes', 'damageTypes', 'magicSchools']
const spellCatalogueRequest = {
  direction: 'FORWARD',
  limit: 48,
  sort: 'name'
} satisfies SpellListRequestDto

export const Route = createFileRoute('/_authed/spells/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureInfiniteQueryData(
      getSpellList(spellCatalogueRequest, createServerApi())
    )
  },
  component: SpellsRoute
})

function SpellsRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useAuthoredCatalogWindow({
    buildFilters: buildSpellListFilters,
    buildRequest: ({ filterValues, query, sort }): SpellListRequestDto => ({
      ...spellCatalogueRequest,
      classId: filterValues.class ?? undefined,
      level: filterValues.level == null ? undefined : Number(filterValues.level),
      magicSchoolId: filterValues.school ?? undefined,
      query: query || undefined,
      sort: sort === 'level' || sort === 'school' ? sort : 'name'
    }),
    initialSort: 'name',
    mapDrafts: (response) => {
      const spellMeta = response.meta as {
        schools?: Array<{ id: string | number; label?: string }>
      }
      return mapDraftSummariesToAuthoredItems(response.drafts, {
        formatSchool: (schoolId) => {
          if (!schoolId) return undefined
          const school = (spellMeta.schools ?? []).find((entry) => String(entry.id) === schoolId)
          return school?.label ?? schoolId
        }
      })
    },
    mapItems: mapSpellListToAuthoredItems,
    summarize: summarizeSpellList,
    useList: useGetSpellList
  })
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
  return (
    <>
      <AuthoredListPage
        title='Spells'
        summary={listing.summary ?? 'Loading spells...'}
        createLabel='Create Spell'
        items={listing.items}
        draftItems={listing.draftItems}
        filters={listing.filters}
        attributeColumns={spellListAttributeColumns}
        sortOptions={spellListSortOptions}
        catalog={listing.catalog}
        error={listing.error}
        loading={listing.loading}
        onCreate={() => navigate({ to: '/spells/new' })}
        onView={(item) =>
          navigate({
            params: buildSpellRouteParams(item.publicId, item.name),
            search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
            to: '/spells/$spellPublicId/$spellSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(
            getSpell({
              id: item.id,
              meta: spellDetailMeta,
              view: item.contentState === 'draft' ? 'draft' : 'active'
            })
          )
        }}
        onEdit={(item) =>
          navigate({
            params: buildSpellRouteParams(item.publicId, item.name),
            to: '/spells/$spellPublicId/$spellSlug/edit'
          })
        }
        onCopy={(item) => duplicateMutation.mutate(item.id)}
        onDelete={(item) =>
          deleteAction.requestDelete({
            id: item.id,
            kind: item.contentState === 'draft' ? 'draft' : 'active',
            label: item.name
          })
        }
      />
      {deleteAction.confirmation}
    </>
  )
}
