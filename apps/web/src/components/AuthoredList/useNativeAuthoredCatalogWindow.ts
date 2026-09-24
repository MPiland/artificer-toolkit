import { api } from '@artificer-toolkit/apis/convex/api'
import type { AuthoredCatalogueReadInput } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { usePaginatedQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import {
  authoredCatalogueCategoryFormatters,
  mapAuthoredCatalogueItems
} from '#app/data/authoredCatalogue'
import { mapDraftSummariesToAuthoredItems } from '#app/data/authoredListDrafts'
import { useAuthoredCatalogueWindow } from '#app/data/useAuthoredCatalogueWindow'
import type { AuthoredListCatalogWindow, AuthoredListFilterValues } from './AuthoredList.types'

export function useNativeAuthoredCatalogWindow(
  subjectKind: AuthoredCatalogueReadInput['subjectKind']
) {
  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState<AuthoredListFilterValues>({})
  const [sort, setSort] = useState('name')
  const source =
    filterValues.source === 'MASTER' || filterValues.source === 'OWNED'
      ? filterValues.source
      : undefined
  const category = filterValues.category || undefined
  const classId = subjectKind === 'SPELL' ? filterValues.class || undefined : undefined
  const level =
    subjectKind === 'SPELL' && filterValues.level ? Number(filterValues.level) : undefined
  const magicSchoolId = subjectKind === 'SPELL' ? filterValues.school || undefined : undefined
  const listing = useAuthoredCatalogueWindow({
    subjectKind,
    ...(classId ? { classId } : {}),
    ...(level !== undefined ? { level } : {}),
    ...(magicSchoolId ? { magicSchoolId } : {}),
    source,
    category,
    sort:
      subjectKind === 'SPELL' && (sort === 'level' || sort === 'school')
        ? sort
        : sort === 'category'
          ? 'category'
          : subjectKind === 'CLASS' || subjectKind === 'RACE'
            ? 'family'
            : undefined
  })
  const summary = useQuery(
    convexQuery(api.content.catalogue.summary, {
      subjectKind,
      source,
      category,
      ...(classId ? { classId } : {}),
      ...(level !== undefined ? { level } : {}),
      ...(magicSchoolId ? { magicSchoolId } : {})
    })
  )
  const drafts = usePaginatedQuery(
    api.content.drafts.list,
    { subjectKind },
    { initialNumItems: 48 }
  )
  useEffect(() => {
    if (drafts.status === 'CanLoadMore') drafts.loadMore(48)
  }, [drafts.status, drafts.loadMore])

  const catalog: AuthoredListCatalogWindow = {
    searchSubjectKind: subjectKind,
    activeCount: summary.data?.activeCount ?? 0,
    totalCount: summary.data?.totalCount ?? 0,
    controls: {
      filterValues,
      onClearFilters: () => setFilterValues({}),
      onFilterChange: (key, value) => setFilterValues((current) => ({ ...current, [key]: value })),
      onQueryChange: setQuery,
      onSortChange: setSort,
      query,
      sort
    },
    fetchNextPage: listing.fetchNextPage,
    fetchPreviousPage: listing.fetchPreviousPage,
    hasNextPage: listing.hasNextPage,
    hasPreviousPage: listing.hasPreviousPage,
    isFetchingNextPage: listing.isFetchingNextPage,
    isFetchingPreviousPage: listing.isFetchingPreviousPage
  }

  return {
    catalog,
    items: mapAuthoredCatalogueItems(listing.items, subjectKind),
    draftItems: mapDraftSummariesToAuthoredItems(drafts.results, {
      categoryAttributeKey: authoredCatalogueCategoryFormatters[subjectKind]
        ? 'Category'
        : undefined,
      formatCategory: authoredCatalogueCategoryFormatters[subjectKind],
      ...(subjectKind === 'SPELL'
        ? {
            formatSchool: (schoolId) =>
              summary.data?.spellFacets?.schools.find((school) => String(school.id) === schoolId)
                ?.label ?? schoolId
          }
        : {})
    }),
    summary: summary.data,
    draftLoading: drafts.status !== 'Exhausted',
    loading: listing.isPending || summary.isPending,
    error: listing.isError || summary.isError ? 'Could not load this catalogue.' : undefined
  }
}
