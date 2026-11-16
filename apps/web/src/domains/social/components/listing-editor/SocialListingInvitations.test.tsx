import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  campaignInviteDtoSchema,
  type CampaignInviteDto
} from '@artificer-toolkit/schema/api/campaignCore'
import type { SocialListingInvitationListInput } from '@artificer-toolkit/schema/api/socialAdmissionLists'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SocialListingInvitations } from './SocialListingInvitations'
const pages = vi.hoisted(() => ({
  pending: vi.fn(),
  history: vi.fn(),
  calls: vi.fn(),
  pendingResults: [] as CampaignInviteDto[],
  reloading: false
}))

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
    // New arguments restart pagination, as Convex does: no results until the first page returns.
    if (pages.reloading) return { results: [], status: 'LoadingFirstPage', loadMore: vi.fn() }
    return {
      results: args.group === 'PENDING' ? pages.pendingResults : [],
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

  it('focuses the linked row again when a horizon refresh remounts it', async () => {
    const invitation = campaignInviteDtoSchema.parse({
      invitePublicId: 'aaaaaaaa-1111-4111-8111-111111111111',
      listingPublicId: 'bbbbbbbb-2222-4222-8222-222222222222',
      hostProfilePublicId: 'cccccccc-3333-4333-8333-333333333333',
      hostUsername: 'Host',
      recipientUsername: 'Player',
      listingTitle: 'Linked table',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      createdAt: new Date(Date.now() - 2000).toISOString(),
      respondedAt: null,
      version: 0
    })
    pages.pendingResults = [invitation]
    renderWithAppProviders(
      <SocialListingInvitations
        invitePublicId={invitation.invitePublicId}
        listingPublicId={invitation.listingPublicId}
      />
    )
    const first = screen.getByRole('article')
    expect(first).toHaveFocus()

    // Returning to the tab refreshes the horizon; the new arguments empty the list before it refills.
    pages.reloading = true
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    pages.reloading = false
    await new Promise((resolve) => setTimeout(resolve, 5))
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    const remounted = screen.getByRole('article')
    expect(remounted).not.toBe(first)
    await waitFor(() => expect(remounted).toHaveFocus())
  })
})
