import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { SocialInvitationListInput } from '@artificer-toolkit/schema/api/socialAdmissionLists'
import {
  campaignInviteDtoSchema,
  type CampaignInviteDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SocialInvitationsView } from './SocialInvitationsView'

const mocks = vi.hoisted(() => ({
  pending: {
    results: [] as CampaignInviteDto[],
    status: 'CanLoadMore' as 'CanLoadMore' | 'Exhausted',
    loadMore: vi.fn()
  },
  history: {
    results: [] as CampaignInviteDto[],
    status: 'CanLoadMore' as 'CanLoadMore' | 'Exhausted',
    loadMore: vi.fn()
  },
  direct: undefined as unknown,
  directError: false,
  calls: vi.fn(),
  pages: vi.fn()
}))
vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (...args: unknown[]) => {
    mocks.calls(...args)
    return { queryKey: ['invite'] }
  }
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({ data: mocks.direct, isError: mocks.directError })
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: (ref: unknown, args: Pick<SocialInvitationListInput, 'group' | 'asOf'>) => {
    mocks.pages(ref, args)
    return args.group === 'PENDING' ? mocks.pending : mocks.history
  },
  useMutation: () => vi.fn()
}))

describe('SocialInvitationsView', () => {
  it('withholds expired pending actions before the horizon refresh completes', () => {
    mocks.pending.results = [
      campaignInviteDtoSchema.parse({
        invitePublicId: 'aaaaaaaa-1111-4111-8111-111111111111',
        listingPublicId: 'bbbbbbbb-2222-4222-8222-222222222222',
        hostProfilePublicId: 'cccccccc-3333-4333-8333-333333333333',
        hostUsername: 'Host',
        recipientUsername: 'Player',
        listingTitle: 'Expired table',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        createdAt: new Date(Date.now() - 2000).toISOString(),
        respondedAt: null,
        version: 0
      })
    ]
    renderWithAppProviders(<SocialInvitationsView />)
    expect(screen.getByText('Expired table')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument()
  })
  it('focuses the deep-linked row again when a list reload remounts it', () => {
    const invitation = campaignInviteDtoSchema.parse({
      invitePublicId: 'aaaaaaaa-0000-4000-8000-000000000004',
      listingPublicId: '00000000-0000-4000-8000-000000000002',
      listingTitle: 'The Glass Harbor',
      hostProfilePublicId: '00000000-0000-4000-8000-000000000005',
      hostUsername: 'harbormaster',
      recipientUsername: 'pathfinder',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      respondedAt: null,
      createdAt: new Date().toISOString(),
      version: 1
    })
    const view = <SocialInvitationsView invitePublicId={invitation.invitePublicId} />
    mocks.pending.results = [invitation]
    const { rerender } = renderWithAppProviders(view)
    expect(screen.getByRole('article')).toHaveFocus()
    mocks.pending.results = []
    rerender(view)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    mocks.pending.results = [invitation]
    rerender(view)
    expect(screen.getByRole('article')).toHaveFocus()
  })
  it.each(['EXPIRED', 'REVOKED'] as const)(
    'explains a %s invitation opened by its link and offers no actions',
    (status) => {
      const invitation = campaignInviteDtoSchema.parse({
        invitePublicId: 'aaaaaaaa-0000-4000-8000-000000000004',
        listingPublicId: '00000000-0000-4000-8000-000000000002',
        listingTitle: 'The Glass Harbor',
        hostProfilePublicId: '00000000-0000-4000-8000-000000000005',
        hostUsername: 'harbormaster',
        recipientUsername: 'pathfinder',
        status,
        expiresAt: '2024-04-08T18:30:00.000Z',
        respondedAt: null,
        createdAt: '2024-04-01T11:30:00.000Z',
        version: 1
      })
      mocks.direct = invitation
      renderWithAppProviders(
        <SocialInvitationsView invitePublicId={invitation.invitePublicId.toUpperCase()} />
      )
      expect(screen.getByRole('article')).toBeVisible()
      expect(
        screen.getByText('Sorry, this invitation has either been revoked or expired.')
      ).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
    }
  )
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pending.results = []
    mocks.history.results = []
    mocks.pending.status = 'CanLoadMore'
    mocks.history.status = 'CanLoadMore'
    mocks.direct = undefined
    mocks.directError = false
  })
  it('continues empty pages without moving the shared pagination horizon', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<SocialInvitationsView />)
    expect(screen.getByRole('button', { name: 'Load more pending invitations' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Load more invitation history' })).toBeVisible()
    const asOf: unknown = mocks.pages.mock.calls[0]?.[1].asOf
    await user.click(screen.getByRole('button', { name: 'Load more pending invitations' }))
    await user.click(screen.getByRole('button', { name: 'Load more invitation history' }))
    expect(mocks.pending.loadMore).toHaveBeenCalledWith(24)
    expect(mocks.history.loadMore).toHaveBeenCalledWith(24)
    expect(mocks.pages).toHaveBeenCalledWith(api.social.admissionLists.listReceivedInvitations, {
      group: 'PENDING',
      asOf
    })
    expect(mocks.pages).toHaveBeenCalledWith(api.social.admissionLists.listReceivedInvitations, {
      group: 'HISTORY',
      asOf
    })
    expect(new Set(mocks.pages.mock.calls.map((call) => call[1].asOf)).size).toBe(1)
  })
})
