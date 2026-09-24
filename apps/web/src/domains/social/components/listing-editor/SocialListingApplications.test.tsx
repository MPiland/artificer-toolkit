import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { SocialApplicationDto } from '@artificer-toolkit/schema/api/socialHub'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SocialListingApplications } from './SocialListingApplications'

const application = {
  applicationPublicId: 'aaaaaaaa-2222-4222-8222-222222222222',
  listingPublicId: 'abc33333-3333-4333-8333-333333333333',
  listingTitle: 'Ashen Road',
  applicant: {
    profilePublicId: '44444444-4444-4444-8444-444444444444',
    username: 'Player'
  },
  message: 'Ready to play.',
  status: 'SUBMITTED' as const,
  listingVersion: 1,
  expectations: {
    contentGuidance: 'Be kind.',
    attendancePolicy: 'Attend sessions.',
    allowedContentRules: 'Ask first.',
    tableConduct: 'Respect others.',
    contentBoundaries: 'No harassment.',
    safetyPractices: ['SESSION_ZERO'],
    safetyDetails: 'Talk openly.'
  },
  submittedAt: '2026-09-01T00:00:00.000Z',
  respondedAt: null,
  version: 2
} satisfies SocialApplicationDto

const mocks = vi.hoisted(() => ({
  pending: {
    results: [] as SocialApplicationDto[],
    status: 'CanLoadMore' as string,
    loadMore: vi.fn()
  },
  history: {
    results: [] as SocialApplicationDto[],
    status: 'CanLoadMore' as string,
    loadMore: vi.fn()
  },
  list: vi.fn(),
  decide: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: (
    reference: unknown,
    args: { group: 'PENDING' | 'HISTORY' },
    options: unknown
  ) => {
    mocks.list(reference, args, options)
    return args.group === 'PENDING' ? mocks.pending : mocks.history
  },
  useMutation: () => mocks.decide
}))

describe('SocialListingApplications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pending.results = []
    mocks.history.results = []
    mocks.pending.status = 'CanLoadMore'
    mocks.history.status = 'CanLoadMore'
    mocks.list.mockClear()
    mocks.decide.mockResolvedValue(application)
  })

  it('loads both groups and keeps load controls on empty pages', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <SocialListingApplications listingPublicId={application.listingPublicId.toUpperCase()} />
    )
    expect(mocks.list).toHaveBeenNthCalledWith(
      1,
      convexApi.social.admissionLists.listListingApplications,
      {
        listingPublicId: application.listingPublicId,
        group: 'PENDING'
      },
      { initialNumItems: 24 }
    )
    expect(mocks.list).toHaveBeenNthCalledWith(
      2,
      convexApi.social.admissionLists.listListingApplications,
      {
        listingPublicId: application.listingPublicId,
        group: 'HISTORY'
      },
      { initialNumItems: 24 }
    )
    await user.click(screen.getByRole('button', { name: 'Load more pending applications' }))
    await user.click(screen.getByRole('button', { name: 'Load more application history' }))
    expect(mocks.pending.loadMore).toHaveBeenCalledWith(24)
    expect(mocks.history.loadMore).toHaveBeenCalledWith(24)
  })

  it('uses lowercase listing id and exact accept/decline payloads', async () => {
    const user = userEvent.setup()
    mocks.pending.results = [application]
    mocks.history.results = [{ ...application, status: 'DECLINED' }]
    renderWithAppProviders(
      <SocialListingApplications listingPublicId={application.listingPublicId.toUpperCase()} />
    )
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() =>
      expect(mocks.decide).toHaveBeenCalledWith({
        applicationPublicId: application.applicationPublicId,
        expectedVersion: application.version,
        decision: 'ACCEPT'
      })
    )
    expect(screen.getAllByRole('article')).toHaveLength(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Decline' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Decline' }))
    await waitFor(() =>
      expect(mocks.decide).toHaveBeenLastCalledWith({
        applicationPublicId: application.applicationPublicId,
        expectedVersion: application.version,
        decision: 'DECLINE'
      })
    )
  })

  it('keeps the row and shows a failed decision', async () => {
    const user = userEvent.setup()
    mocks.pending.results = [application]
    mocks.decide.mockRejectedValue(new Error('Decision failed.'))
    renderWithAppProviders(
      <SocialListingApplications listingPublicId={application.listingPublicId} />
    )
    await user.click(screen.getByRole('button', { name: 'Decline' }))
    expect(await screen.findByText('Decision failed.')).toBeVisible()
    expect(screen.getByText('@Player')).toBeVisible()
  })

  it('shows empty state only after both groups are exhausted', () => {
    mocks.pending.status = 'Exhausted'
    mocks.history.status = 'Exhausted'
    renderWithAppProviders(
      <SocialListingApplications listingPublicId={application.listingPublicId} />
    )
    expect(screen.getByText('No applications for this listing.')).toBeVisible()
  })
})
