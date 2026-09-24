import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useAuthoredCatalogWindow } from './useAuthoredCatalogWindow'

it('keeps legacy browsing requests search-free while native search controls change', () => {
  const buildRequest = vi.fn(({ query }: { query: string }) => ({ query }))
  const listing = {
    data: {
      pages: [{ items: [], drafts: [], page: { totalCount: 12 }, summary: { activeCount: 12 } }]
    },
    fetchNextPage: vi.fn(async () => undefined),
    fetchPreviousPage: vi.fn(async () => undefined),
    hasNextPage: false,
    hasPreviousPage: false,
    isError: false,
    isFetchingNextPage: false,
    isFetchingPreviousPage: false,
    isPending: false
  }
  const { result } = renderHook(() =>
    useAuthoredCatalogWindow({
      searchSubjectKind: 'BACKGROUND',
      initialSort: 'name',
      buildRequest,
      buildFilters: () => [],
      mapItems: () => [],
      mapDrafts: () => [],
      summarize: () => '12 backgrounds',
      useList: () => listing
    })
  )
  act(() => result.current.catalog.controls.onQueryChange('scholar'))
  expect(result.current.catalog.controls.query).toBe('scholar')
  expect(result.current.catalog.searchSubjectKind).toBe('BACKGROUND')
  expect(buildRequest.mock.calls.every(([input]) => input.query === '')).toBe(true)
})
