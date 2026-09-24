import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SocialListingInvitationListInput } from '@artificer-toolkit/schema/api/socialAdmissionLists'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SocialListingInvitations } from './SocialListingInvitations'
const pages = vi.hoisted(() => ({ pending: vi.fn(), history: vi.fn(), calls: vi.fn() }))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: () => ({ queryKey: ['listing-invites'] })
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({ data: undefined, isError: false })
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: (
    _ref: unknown,
    args: Omit<SocialListingInvitationListInput, 'paginationOpts'>
  ) => {
    pages.calls(args)
    return {
      results: [],
      status: 'CanLoadMore',
      loadMore: args.group === 'PENDING' ? pages.pending : pages.history
    }
  },
  useMutation: () => vi.fn()
}))

describe('SocialListingInvitations', () => {
  it('continues empty pages with one horizon and normalized listing scope', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <SocialListingInvitations listingPublicId='AAAAAAAA-0000-4000-8000-000000000002' />
    )
    expect(screen.getByRole('button', { name: 'Load more pending invitations' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Load more invitation history' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Load more pending invitations' }))
    await user.click(screen.getByRole('button', { name: 'Load more invitation history' }))
    expect(pages.pending).toHaveBeenCalledWith(24)
    expect(pages.history).toHaveBeenCalledWith(24)
    expect(pages.calls).toHaveBeenCalledWith(
      expect.objectContaining({ listingPublicId: 'aaaaaaaa-0000-4000-8000-000000000002' })
    )
    expect(new Set(pages.calls.mock.calls.map((call) => call[0].asOf)).size).toBe(1)
  })
})
