import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { socialApplicationDtoSchema } from '@artificer-toolkit/schema/api/socialHub'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SocialApplicationsView } from './SocialApplicationsView'

const application = socialApplicationDtoSchema.parse({
  applicationPublicId: 'aaaaaaaa-2222-4222-8222-222222222222',
  listingPublicId: '33333333-3333-4333-8333-333333333333',
  listingTitle: 'Ashen Road',
  applicant: { profilePublicId: '44444444-4444-4444-8444-444444444444', username: 'Player' },
  message: 'Ready to play.',
  status: 'SUBMITTED',
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
})
const mocks = vi.hoisted(() => ({
  pending: {
    results: [] as Array<Record<string, unknown>>,
    status: 'CanLoadMore' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  history: {
    results: [] as Array<Record<string, unknown>>,
    status: 'CanLoadMore' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  direct: undefined as Record<string, unknown> | undefined,
  directError: false,
  listError: false,
  remove: vi.fn(),
  list: vi.fn()
}))

vi.mock('./SocialBlocksPanel', () => ({
  SocialBlocksPanel: () => <div>Blocked profiles panel</div>
}))
vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (...args: unknown[]) => {
    mocks.list(...args)
    return { queryKey: ['social-application'] }
  }
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({ data: mocks.direct, isError: mocks.directError, isPending: false })
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: (_reference: unknown, args: { group: 'PENDING' | 'HISTORY' }) => {
    if (mocks.listError) throw new Error('Applications unavailable.')
    return args.group === 'PENDING' ? mocks.pending : mocks.history
  },
  useMutation: () => mocks.remove
}))

describe('SocialApplicationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pending.results = []
    mocks.history.results = []
    mocks.pending.status = 'CanLoadMore'
    mocks.history.status = 'CanLoadMore'
    mocks.direct = undefined
    mocks.directError = false
    mocks.listError = false
    mocks.remove.mockResolvedValue(application)
  })

  it('loads both native groups and keeps controls on empty pages', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<SocialApplicationsView />)
    expect(screen.getByText('Blocked profiles panel')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Load more pending applications' }))
    await user.click(screen.getByRole('button', { name: 'Load more application history' }))
    expect(mocks.pending.loadMore).toHaveBeenCalledWith(24)
    expect(mocks.history.loadMore).toHaveBeenCalledWith(24)
  })

  it('uses the direct link and native withdrawal payload', async () => {
    mocks.pending.results = [application]
    mocks.direct = application
    const user = userEvent.setup()
    renderWithAppProviders(
      <SocialApplicationsView applicationPublicId={application.applicationPublicId.toUpperCase()} />
    )
    await user.click(screen.getByRole('button', { name: 'Withdraw application' }))
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        applicationPublicId: application.applicationPublicId,
        expectedVersion: application.version
      })
    )
    expect(screen.getByText('Ashen Road')).toBeVisible()
    expect(screen.getByRole('article')).toHaveAttribute('data-highlighted', 'true')
  })

  it('keeps a direct pending application ahead of history rows', () => {
    const historyApplication = {
      ...application,
      applicationPublicId: '55555555-5555-4555-8555-555555555555',
      listingTitle: 'Older table',
      status: 'WITHDRAWN' as const
    }
    mocks.direct = application
    mocks.history.results = [historyApplication]
    renderWithAppProviders(
      <SocialApplicationsView applicationPublicId={application.applicationPublicId} />
    )
    expect(screen.getAllByRole('article').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Ashen Road'),
      expect.stringContaining('Older table')
    ])
  })

  it('shows direct-link unavailability and keeps blocks visible', () => {
    mocks.directError = true
    mocks.pending.status = 'Exhausted'
    mocks.history.status = 'Exhausted'
    renderWithAppProviders(
      <SocialApplicationsView applicationPublicId={application.applicationPublicId} />
    )
    expect(screen.getByText('This item is no longer available.')).toBeVisible()
    expect(screen.getByText('Blocked profiles panel')).toBeVisible()
  })

  it('keeps withdrawal errors visible', async () => {
    mocks.pending.results = [application]
    mocks.remove.mockRejectedValue(new Error('Withdraw failed.'))
    const user = userEvent.setup()
    renderWithAppProviders(<SocialApplicationsView />)
    await user.click(screen.getByRole('button', { name: 'Withdraw application' }))
    expect(await screen.findByText('Withdraw failed.')).toBeVisible()
  })

  it('keeps blocks visible when the applications query fails', () => {
    mocks.listError = true
    renderWithAppProviders(<SocialApplicationsView />)
    expect(screen.getByText('Could not load applications.')).toBeVisible()
    expect(screen.getByText('Blocked profiles panel')).toBeVisible()
  })
})
