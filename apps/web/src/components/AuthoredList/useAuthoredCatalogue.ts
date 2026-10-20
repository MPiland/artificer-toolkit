import { api } from '@artificer-toolkit/apis/convex/api'
import type { ContentSnapshotKind } from '@artificer-toolkit/schema/api/contentSnapshots'
import { usePaginatedQuery } from 'convex/react'
import { useMemo } from 'react'
import {
  authoredCatalogueCategoryFormatters,
  mapAuthoredCatalogueItems
} from '#app/data/authoredCatalogue'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import { useContentCatalogue } from '#app/data/contentSnapshots/useContentCatalogue'
import { useLoadAllPages } from '#app/data/useLoadAllPages'

/**
 * Every visible row of one authored kind for `AuthoredListPage`, read from content snapshots
 * (ADR 0036) so the list costs no Convex reads beyond the live manifest. Drafts are private,
 * mutable and small, so they stay a Convex query.
 */
export function useAuthoredCatalogue(subjectKind: ContentSnapshotKind) {
  const catalogue = useContentCatalogue(subjectKind)
  const drafts = usePaginatedQuery(
    api.content.drafts.list,
    { subjectKind },
    { initialNumItems: 48 }
  )
  useLoadAllPages(drafts, 48)

  const items = useMemo(
    () => (catalogue.items ? mapAuthoredCatalogueItems(catalogue.items, subjectKind) : []),
    [catalogue.items, subjectKind]
  )

  return {
    items,
    draftItems: mapDraftSummariesToAuthoredItems(drafts.results, {
      categoryAttributeKey: authoredCatalogueCategoryFormatters[subjectKind]
        ? 'Category'
        : undefined,
      formatCategory: authoredCatalogueCategoryFormatters[subjectKind],
      ...(subjectKind === 'SPELL'
        ? {
            formatSchool: (schoolId) =>
              catalogue.summary?.spellFacets?.schools.find((school) => school.id === schoolId)
                ?.label ?? schoolId
          }
        : {})
    }),
    summary: catalogue.summary,
    draftLoading: drafts.status !== 'Exhausted',
    loading: catalogue.isPending,
    updating: catalogue.updating,
    error: catalogue.isError ? 'Could not load this catalogue.' : undefined
  }
}
