import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { SocialListingDto } from '@artificer-toolkit/schema/api/socialHub'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import type { SocialHubSearch } from '../socialSearch'
import { SocialDiscoveryView } from './SocialDiscoveryView'
import { SocialHostingView } from './SocialHostingView'

const mocks = vi.hoisted(() => ({
  calls: vi.fn(),
  browse: {
    results: [] as SocialListingDto[],
    status: 'Exhausted' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  search: {
    results: [] as SocialListingDto[],
    status: 'Exhausted' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  owned: {
    results: [] as SocialListingDto[],
    status: 'Exhausted' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  throwError: false
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: (reference: unknown, args: unknown, options: unknown) => {
    mocks.calls(reference, args, options)
    if (mocks.throwError) throw new Error('Unavailable')
    if (typeof args === 'string' || (typeof args === 'object' && args !== null && 'query' in args))
      return mocks.search
    if (typeof args === 'object' && args !== null && Object.keys(args).length === 0)
      return mocks.owned
    return mocks.browse
  }
}))

const search = (overrides: Partial<SocialHubSearch> = {}): SocialHubSearch => ({
  view: 'discover',
  ...overrides
})

describe('Social discovery and hosting views', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.throwError = false
    mocks.browse.status = 'Exhausted'
    mocks.search.status = 'Exhausted'
    mocks.owned.status = 'Exhausted'
    mocks.browse.results = []
    mocks.search.results = []
    mocks.owned.results = []
  })

  it('uses browse for whitespace and trimmed search for nonempty keywords', () => {
    const onSearchChange = vi.fn()
    const { rerender } = renderWithAppProviders(
      <SocialDiscoveryView search={search({ query: '   ' })} onSearchChange={onSearchChange} />
    )
    expect(mocks.calls).toHaveBeenCalledWith(
      api.social.discoveryLists.browse,
      {},
      { initialNumItems: 8 }
    )
    expect(mocks.calls).toHaveBeenCalledWith(api.social.discoveryLists.search, 'skip', {
      initialNumItems: 8
    })

    rerender(
      <SocialDiscoveryView
        search={search({ query: '  ruins  ' })}
        onSearchChange={onSearchChange}
      />
    )
    expect(mocks.calls).toHaveBeenCalledWith(
      api.social.discoveryLists.search,
      { query: 'ruins' },
      { initialNumItems: 8 }
    )
    expect(mocks.calls).toHaveBeenCalledWith(api.social.discoveryLists.browse, 'skip', {
      initialNumItems: 8
    })
  })

  it('forwards filters and loads another empty page', async () => {
    mocks.browse.status = 'CanLoadMore'
    const user = userEvent.setup()
    renderWithAppProviders(
      <SocialDiscoveryView
        search={search({
          systemId: '11111111-1111-4111-8111-111111111111',
          city: 'Austin'
        })}
        onSearchChange={vi.fn()}
      />
    )
    expect(mocks.calls).toHaveBeenCalledWith(
      api.social.discoveryLists.browse,
      { systemId: '11111111-1111-4111-8111-111111111111', city: 'Austin' },
      { initialNumItems: 8 }
    )
    expect(screen.getByRole('button', { name: 'Load more tables' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Load more tables' }))
    expect(mocks.browse.loadMore).toHaveBeenCalledWith(8)
    expect(screen.queryByText('No tables match')).not.toBeInTheDocument()
  })

  it('shows discovery empty only when exhausted', () => {
    renderWithAppProviders(<SocialDiscoveryView search={search()} onSearchChange={vi.fn()} />)
    expect(screen.getByText('No tables match')).toBeVisible()
  })

  it('paginates owned listings and keeps the native error recoverable', async () => {
    mocks.owned.status = 'CanLoadMore'
    const user = userEvent.setup()
    renderWithAppProviders(<SocialHostingView />)
    await user.click(screen.getByRole('button', { name: 'Load more hosted listings' }))
    expect(mocks.owned.loadMore).toHaveBeenCalledWith(8)

    mocks.throwError = true
    renderWithAppProviders(<SocialDiscoveryView search={search()} onSearchChange={vi.fn()} />)
    expect(screen.getByText('Could not load listings. Try again.')).toBeVisible()
    expect(
      screen.getByRole('textbox', {
        name: 'Search table titles and summaries'
      })
    ).toBeEnabled()
    mocks.throwError = false
    await user.click(screen.getByRole('button', { name: 'Retry search' }))
    expect(await screen.findByText('No tables match')).toBeVisible()
  })
})
