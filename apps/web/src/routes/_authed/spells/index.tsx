import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvex } from 'convex/react'
import { AuthoredListPage } from '#components/AuthoredList'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import { useAuthoredCatalogue } from '#components/AuthoredList/useAuthoredCatalogue'
import { getSpell } from '#app/data/spells/queries'
import { createAuthoredOperations } from '#app/data/authoredOperations'
import {
  buildSpellFilters,
  spellListAttributeColumns,
  spellListSortOptions
} from '#app/data/spells/spellListMapper'
import { queryKeys } from '#app/lib/queryKeys'
import { authoredDetailSearchFor } from '#app/routing/authoredDetailSearch'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'

const spellDetailMeta = ['classes', 'conditionTypes', 'damageTypes', 'magicSchools']
export const Route = createFileRoute('/_authed/spells/')({
  component: SpellsRoute
})

function SpellsRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listing = useAuthoredCatalogue('SPELL')
  const operations = createAuthoredOperations('SPELL', useConvex())
  const duplicateMutation = useMutation({
    mutationFn: operations.duplicate,
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
    deleteActive: operations.deleteActive,
    deleteDraft: operations.discardDraft,
    detailSubjectQueryKey: queryKeys.content.spells.detailRoot,
    domainLabel: 'Spell',
    domainQueryKey: queryKeys.content.spells.all(),
    draftQueryKey: queryKeys.content.spells.draft
  })
  return (
    <>
      <AuthoredListPage
        title='Spells'
        summary={
          listing.summary
            ? `${listing.summary.activeCount} spells / ${listing.summary.masterCount} SRD / ${listing.summary.ownedCount} homebrew`
            : 'Loading spells...'
        }
        createLabel='Create Spell'
        items={listing.items}
        draftItems={listing.draftItems}
        draftLoading={listing.draftLoading}
        filters={buildSpellFilters(
          listing.summary?.spellFacets ?? { classes: [], levels: [], schools: [] }
        )}
        attributeColumns={spellListAttributeColumns}
        sortOptions={spellListSortOptions}
        updating={listing.updating}
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
              id: item.publicId,
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
