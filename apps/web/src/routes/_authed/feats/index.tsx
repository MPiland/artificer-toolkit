import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useAuthoredCatalogue } from '#components/AuthoredList/useAuthoredCatalogue'
import {
  featListAttributeColumns,
  featListSortOptions,
  buildFeatListFilters
} from '#app/data/feats/featListMapper'
import { getFeat } from '#app/data/feats/queries'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'

export const Route = createFileRoute('/_authed/feats/')({
  component: FeatsRoute
})

function FeatsRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const operations = createAuthoredOperations('FEAT', useConvex())
  const listing = useAuthoredCatalogue('FEAT')
  const duplicateMutation = useMutation({
    mutationFn: operations.duplicate,
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.content.feats.all()
      })
      notifications.show({
        color: 'green',
        message: 'Feat duplicated as owned content.'
      })
      if (response?.subjectId) {
        await navigate({
          params: buildFeatRouteParams(response.publicId, response.label),
          to: '/feats/$featPublicId/$featSlug/edit'
        })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that feat yet.'
      })
    }
  })
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: operations.deleteActive,
    deleteDraft: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.feats.detailRoot,
    domainLabel: 'Feat',
    domainQueryKey: queryKeys.content.feats.all(),
    draftQueryKey: queryKeys.content.feats.draft
  })

  return (
    <>
      <AuthoredListPage
        title='Feats'
        summary={
          listing.summary
            ? `${listing.summary.activeCount} feats / ${listing.summary.masterCount} SRD / ${listing.summary.ownedCount} homebrew`
            : 'Loading feats...'
        }
        createLabel='Create Feat'
        items={listing.items}
        draftItems={listing.draftItems}
        draftLoading={listing.draftLoading}
        filters={buildFeatListFilters()}
        attributeColumns={featListAttributeColumns}
        sortOptions={featListSortOptions}
        updating={listing.updating}
        error={listing.error}
        loading={listing.loading}
        onCreate={() => navigate({ to: '/feats/new' })}
        onView={(item) =>
          navigate({
            params: buildFeatRouteParams(item.publicId, item.name),
            search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
            to: '/feats/$featPublicId/$featSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(
            getFeat({
              id: item.id,
              view: item.contentState === 'draft' ? 'draft' : 'active'
            })
          )
        }}
        onEdit={(item) =>
          navigate({
            params: buildFeatRouteParams(item.publicId, item.name),
            to: '/feats/$featPublicId/$featSlug/edit'
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
