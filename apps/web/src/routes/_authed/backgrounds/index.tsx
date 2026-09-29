import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useAuthoredCatalogue } from '#components/AuthoredList/useAuthoredCatalogue'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { getBackground } from '#app/data/backgrounds/queries'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'

const backgroundDetailMeta = ['currencies', 'equipment', 'languages', 'skills']
import {
  backgroundListAttributeColumns,
  backgroundListSortOptions,
  buildBackgroundListFilters
} from '#app/data/backgrounds/backgroundListMapper'

export const Route = createFileRoute('/_authed/backgrounds/')({
  component: BackgroundsRoute
})

function BackgroundsRoute() {
  const operations = createAuthoredOperations('BACKGROUND', useConvex())
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useAuthoredCatalogue('BACKGROUND')
  const duplicateMutation = useMutation({
    mutationFn: operations.duplicate,
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.backgrounds.all() })
      notifications.show({
        color: 'green',
        message: 'Background duplicated as owned content.'
      })
      if (response?.subjectId) {
        await navigate({
          params: buildBackgroundRouteParams(response.publicId, response.label),
          to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
        })
      }
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not duplicate that background yet.'
      })
    }
  })
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: operations.deleteActive,
    deleteDraft: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.backgrounds.detailRoot,
    domainLabel: 'Background',
    domainQueryKey: queryKeys.content.backgrounds.all(),
    draftQueryKey: queryKeys.content.backgrounds.draft
  })

  return (
    <>
      <AuthoredListPage
        title='Backgrounds'
        summary={
          listing.summary
            ? `${listing.summary.activeCount} backgrounds / ${listing.summary.masterCount} SRD / ${listing.summary.ownedCount} homebrew`
            : 'Loading backgrounds...'
        }
        createLabel='Create Background'
        items={listing.items}
        draftItems={listing.draftItems}
        draftLoading={listing.draftLoading}
        filters={buildBackgroundListFilters()}
        attributeColumns={backgroundListAttributeColumns}
        sortOptions={backgroundListSortOptions}
        updating={listing.updating}
        error={listing.error}
        loading={listing.loading}
        onCreate={() => navigate({ to: '/backgrounds/new' })}
        onView={(item) =>
          navigate({
            params: buildBackgroundRouteParams(item.publicId, item.name),
            search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
            to: '/backgrounds/$backgroundPublicId/$backgroundSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(
            getBackground({
              id: item.id,
              meta: backgroundDetailMeta,
              view: item.contentState === 'draft' ? 'draft' : 'active'
            })
          )
        }}
        onEdit={(item) =>
          navigate({
            params: buildBackgroundRouteParams(item.publicId, item.name),
            to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
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
