import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useNativeAuthoredCatalogWindow } from '#components/AuthoredList/useNativeAuthoredCatalogWindow'
import {
  buildRaceListFilters,
  raceListAttributeColumns,
  raceListSortOptions
} from '#app/data/races/raceListMapper'
import { getRace } from '#app/data/races/queries'
import { useDuplicateRaceMutation } from '#app/data/races/mutations'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'

const raceDetailMeta = ['heritages', 'races', 'speeds']
export function RaceCataloguePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useNativeAuthoredCatalogWindow('RACE')
  const duplicateMutation = useDuplicateRaceMutation()
  const operations = createAuthoredOperations('RACE', useConvex())
  const deleteAction = useAuthoredDeleteAction({
    deleteActive: operations.deleteActive,
    deleteDraft: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.races.detailRoot,
    domainLabel: 'Race',
    domainQueryKey: queryKeys.content.races.all(),
    draftQueryKey: queryKeys.content.races.draft
  })

  return (
    <>
      <AuthoredListPage
        title='Races'
        summary={
          listing.summary
            ? `${listing.summary.activeCount} races / ${listing.summary.masterCount} SRD / ${listing.summary.ownedCount} homebrew`
            : 'Loading races...'
        }
        createLabel='Create Race'
        items={listing.items}
        draftItems={listing.draftItems}
        draftLoading={listing.draftLoading}
        filters={buildRaceListFilters(listing.summary?.categories ?? [])}
        attributeColumns={raceListAttributeColumns}
        sortOptions={raceListSortOptions}
        catalog={listing.catalog}
        error={listing.error}
        loading={listing.loading}
        onCreate={() => navigate({ to: '/races/new' })}
        onView={(item) =>
          navigate({
            params: buildRaceRouteParams(item.publicId, item.name),
            search: authoredDetailSearchFor(item.contentState === 'draft' ? 'draft' : 'active'),
            to: '/races/$racePublicId/$raceSlug'
          })
        }
        onViewIntent={(item) => {
          void queryClient.prefetchQuery(
            getRace({
              id: item.id,
              meta: raceDetailMeta,
              view: item.contentState === 'draft' ? 'draft' : 'active'
            })
          )
        }}
        onEdit={(item) =>
          navigate({
            params: buildRaceRouteParams(item.publicId, item.name),
            to: '/races/$racePublicId/$raceSlug/edit'
          })
        }
        onCopy={(item) =>
          void duplicateMutation
            .mutateAsync(item.id)
            .then(async (response) => {
              notifications.show({ color: 'green', message: 'Race duplicated as owned content.' })
              if (response?.subjectId) {
                await navigate({
                  params: buildRaceRouteParams(response.publicId, response.label),
                  to: '/races/$racePublicId/$raceSlug/edit'
                })
              }
            })
            .catch(() =>
              notifications.show({ color: 'red', message: 'Could not duplicate that race yet.' })
            )
        }
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
