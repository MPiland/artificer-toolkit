import { useMemo, useState } from 'react'

import type {
  AuthoredListCatalogWindow,
  AuthoredListFilter,
  AuthoredListFilterValues,
  AuthoredListItem
} from './AuthoredList.types'

interface AuthoredCatalogPageShape {
  drafts: unknown[]
  items: unknown[]
  page: {
    totalCount: number
  }
  summary: {
    activeCount: number
  }
}

interface AuthoredCatalogQueryResult<TPage extends AuthoredCatalogPageShape> {
  data?: { pages: TPage[] }
  fetchNextPage: () => Promise<unknown>
  fetchPreviousPage: () => Promise<unknown>
  hasNextPage: boolean
  hasPreviousPage: boolean
  isError: boolean
  isFetchingNextPage: boolean
  isFetchingPreviousPage: boolean
  isPending: boolean
}

export function useAuthoredCatalogWindow<TPage extends AuthoredCatalogPageShape, TRequest>(input: {
  searchSubjectKind?: AuthoredListCatalogWindow['searchSubjectKind']
  buildFilters: (page: TPage) => AuthoredListFilter[]
  buildRequest: (state: {
    filterValues: AuthoredListFilterValues
    query: string
    sort: string
  }) => TRequest
  initialSort: string
  mapDrafts: (page: TPage) => AuthoredListItem[]
  mapItems: (page: TPage) => AuthoredListItem[]
  summarize: (page: TPage) => string
  useList: (request: TRequest) => AuthoredCatalogQueryResult<TPage>
}) {
  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState<AuthoredListFilterValues>({})
  const [sort, setSort] = useState(input.initialSort)
  const request = input.buildRequest({
    filterValues,
    query: input.searchSubjectKind ? '' : query,
    sort
  })
  const listing = input.useList(request)
  const firstPage = listing.data?.pages[0]
  const filters = useMemo(
    () => (firstPage ? input.buildFilters(firstPage) : []),
    [firstPage, input]
  )
  const items = useMemo(
    () => listing.data?.pages.flatMap((page) => input.mapItems(page)) ?? [],
    [input, listing.data?.pages]
  )
  const draftItems = useMemo(
    () => (firstPage ? input.mapDrafts(firstPage) : []),
    [firstPage, input]
  )
  const emptyFilterValues = useMemo(
    () =>
      filters.reduce<AuthoredListFilterValues>((values, filter) => {
        values[filter.key] = null
        return values
      }, {}),
    [filters]
  )
  const catalog = useMemo<AuthoredListCatalogWindow>(
    () => ({
      searchSubjectKind: input.searchSubjectKind,
      activeCount: firstPage?.summary.activeCount ?? 0,
      controls: {
        filterValues,
        onClearFilters: () => setFilterValues(emptyFilterValues),
        onFilterChange: (key, value) => {
          setFilterValues((current) => ({ ...current, [key]: value }))
        },
        onQueryChange: setQuery,
        onSortChange: setSort,
        query,
        sort
      },
      fetchNextPage: () => {
        void listing.fetchNextPage()
      },
      fetchPreviousPage: () => {
        void listing.fetchPreviousPage()
      },
      hasNextPage: listing.hasNextPage,
      hasPreviousPage: listing.hasPreviousPage,
      isFetchingNextPage: listing.isFetchingNextPage,
      isFetchingPreviousPage: listing.isFetchingPreviousPage,
      totalCount: firstPage?.page.totalCount ?? 0
    }),
    [emptyFilterValues, filterValues, firstPage, input.searchSubjectKind, listing, query, sort]
  )

  return {
    catalog,
    draftItems,
    error: listing.isError ? 'Could not load this catalogue.' : undefined,
    filters,
    items,
    loading: listing.isPending,
    summary: firstPage ? input.summarize(firstPage) : undefined
  }
}
