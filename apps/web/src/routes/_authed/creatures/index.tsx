import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useAuthoredCatalogue } from '#components/AuthoredList/useAuthoredCatalogue'
import {
  buildCreatureListFilters,
  creatureListAttributeColumns,
  creatureListSortOptions
} from '#app/data/creatures/creatureListMapper'
import { getCreature } from '#app/data/creatures/queries'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'

const creatureDetailMeta = [
  'abilities',
  'challengeRatings',
  'conditionTypes',
  'creatureTypes',
  'damageTypes',
  'equipment',
  'speeds'
]
export const Route = createFileRoute('/_authed/creatures/')({
  component: CreaturesRoute
})

function CreaturesRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useAuthoredCatalogue('CREATURE')
  const operations = createAuthoredOperations('CREATURE', useConvex())
  const duplicateMutation = useMutation({
    mutationFn: operations.duplicate,
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.content.creatures.all()
      })
      notifications.show({
        color: 'green',
        message: 'Creature duplicated as owned content.'
      })
      if (response?.subjectId) {
        await navigate({
          params: buildCreatureRouteParams(response.publicId, response.label),
          to: '/creatures/$creaturePublicId/$creatureSlug/edit'
        })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that creature yet.'
      })
    }
  })
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: operations.deleteActive,
    deleteDraft: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.creatures.detailRoot,
    domainLabel: 'Creature',
    domainQueryKey: queryKeys.content.creatures.all(),
    draftQueryKey: queryKeys.content.creatures.draft
  })

  return (
    <>
      <AuthoredListPage
        title='Creatures'
        summary={
          listing.summary
            ? `${listing.summary.activeCount} creatures / ${listing.summary.masterCount} SRD / ${listing.summary.ownedCount} homebrew`
            : 'Loading creatures...'
        }
        createLabel='Create Creature'
        items={listing.items}
        draftItems={listing.draftItems}
        draftLoading={listing.draftLoading}
        filters={buildCreatureListFilters(listing.summary?.categories ?? [])}
        attributeColumns={creatureListAttributeColumns}
        sortOptions={creatureListSortOptions}
        updating={listing.updating}
        error={listing.error}
        loading={listing.loading}
        onCreate={() => navigate({ to: '/creatures/new' })}
        onView={(item) =>
          navigate({
            params: buildCreatureRouteParams(item.publicId, item.name),
            search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
            to: '/creatures/$creaturePublicId/$creatureSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(
            getCreature({
              id: item.publicId,
              meta: creatureDetailMeta,
              view: item.contentState === 'draft' ? 'draft' : 'active'
            })
          )
        }}
        onEdit={(item) =>
          navigate({
            params: buildCreatureRouteParams(item.publicId, item.name),
            to: '/creatures/$creaturePublicId/$creatureSlug/edit'
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
