import { renderHook } from '@testing-library/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGetCampaignList } from './queries'

const mocks = vi.hoisted(() => ({
  page: { results: [{ id: 'campaign-1' }], status: 'CanLoadMore', loadMore: vi.fn() },
  usePaginatedQuery: vi.fn()
}))
vi.mock('convex/react', () => ({ usePaginatedQuery: mocks.usePaginatedQuery }))

describe('useGetCampaignList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.page.results = [{ id: 'campaign-1' }]
    mocks.page.status = 'CanLoadMore'
    mocks.usePaginatedQuery.mockImplementation(() => mocks.page)
  })

  it('drains every continuation and exposes the complete catalogue only when exhausted', () => {
    const hook = renderHook(() => useGetCampaignList())
    expect(mocks.usePaginatedQuery).toHaveBeenCalledWith(
      convexApi.campaigns.queries.list,
      {},
      { initialNumItems: 8 }
    )
    expect(hook.result.current).toEqual({ data: undefined, isLoading: true })
    expect(mocks.page.loadMore).toHaveBeenCalledWith(8)

    for (let page = 2; page <= 4; page++) {
      mocks.page.status = 'LoadingMore'
      hook.rerender()
      mocks.page.results.push({ id: 'campaign-' + page })
      mocks.page.status = page === 4 ? 'Exhausted' : 'CanLoadMore'
      hook.rerender()
      if (page !== 4) expect(hook.result.current.data).toBeUndefined()
    }
    expect(mocks.page.loadMore).toHaveBeenCalledTimes(3)
    expect(hook.result.current).toEqual({ data: mocks.page.results, isLoading: false })
    expect(hook.result.current.data).toHaveLength(4)
  })

  it('skips disabled queries without exposing retained results or loading more', () => {
    const hook = renderHook(() => useGetCampaignList(false))
    expect(mocks.usePaginatedQuery).toHaveBeenCalledWith(convexApi.campaigns.queries.list, 'skip', {
      initialNumItems: 8
    })
    expect(mocks.page.loadMore).not.toHaveBeenCalled()
    expect(hook.result.current).toEqual({ data: undefined, isLoading: false })
  })
})
