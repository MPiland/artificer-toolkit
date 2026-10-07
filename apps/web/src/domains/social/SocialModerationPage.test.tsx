import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notifications } from '@mantine/notifications'
import { getFunctionName } from 'convex/server'
import {
  socialModerationQueueItemDtoSchema,
  type SocialModerationQueueItemDto
} from '@artificer-toolkit/schema/api/socialHub'
import {
  socialModerationEvidenceDtoSchema,
  type SocialModerationEvidenceDto
} from '@artificer-toolkit/schema/api/socialModeration'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SocialModerationPage } from './SocialModerationPage'

const reportPublicId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const queueItem = socialModerationQueueItemDtoSchema.parse({
  reportPublicId,
  targetKind: 'PROFILE',
  reason: 'HARASSMENT',
  status: 'SUBMITTED',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  version: 1
})
const evidence = socialModerationEvidenceDtoSchema.parse({
  ...queueItem,
  reporter: { profilePublicId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', username: 'Reporter' },
  details: 'Captured report details.',
  evidence: {
    profilePublicId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    username: 'ReportedPlayer',
    status: 'ACTIVE'
  }
})

const mocks = vi.hoisted(() => ({
  queue: {
    results: [] as SocialModerationQueueItemDto[],
    status: 'Exhausted' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  calls: vi.fn(),
  open: vi.fn(),
  review: vi.fn(),
  listing: vi.fn(),
  profile: vi.fn(),
  queueError: false
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
    options: unknown
  ) => {
    const name = getFunctionName(reference)
    if (name !== 'social/moderation:list') throw new Error(`Unexpected query ${name}`)
    mocks.calls(name, args, options)
    if (mocks.queueError) throw new Error('Queue unavailable')
    return mocks.queue
  },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference)
    if (name === 'social/moderation:open') return mocks.open
    if (name === 'social/moderation:review') return mocks.review
    if (name === 'social/listingModeration:action') return mocks.listing
    if (name === 'social/profileModeration:action') return mocks.profile
    throw new Error(`Unexpected mutation ${name}`)
  }
}))

describe('native Social moderation page', () => {
  beforeEach(() => {
    notifications.clean()
    vi.clearAllMocks()
    mocks.queue.results = []
    mocks.queue.status = 'Exhausted'
    mocks.queueError = false
    mocks.open.mockReset().mockResolvedValue(evidence)
    mocks.review.mockReset().mockResolvedValue({ ...evidence, status: 'UNDER_REVIEW', version: 2 })
    mocks.listing.mockReset().mockResolvedValue({ ...evidence, version: 2 })
    mocks.profile.mockReset().mockResolvedValue({ ...evidence, version: 2 })
  })

  it('uses native pagination and loads an empty next page', async () => {
    mocks.queue.status = 'CanLoadMore'
    const user = userEvent.setup()
    renderWithAppProviders(<SocialModerationPage />)

    expect(mocks.calls).toHaveBeenCalledWith('social/moderation:list', {}, { initialNumItems: 8 })
    expect(screen.getByRole('button', { name: 'Load more reports' })).toBeVisible()
    expect(screen.queryByText('No reports in the queue.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load more reports' }))
    expect(mocks.queue.loadMore).toHaveBeenCalledWith(8)
  })

  it('shows the empty message only when pagination is exhausted', () => {
    renderWithAppProviders(<SocialModerationPage />)
    expect(screen.getByText('No reports in the queue.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Load more reports' })).not.toBeInTheDocument()
  })

  it('opens evidence through the native mutation and shows an open failure', async () => {
    mocks.queue.results = [queueItem]
    const user = userEvent.setup()
    renderWithAppProviders(<SocialModerationPage />)
    await user.click(screen.getByRole('button', { name: 'Open report' }))
    expect(await screen.findByText('Captured report details.')).toBeVisible()
    expect(mocks.open).toHaveBeenCalledWith({ reportPublicId })

    mocks.open.mockRejectedValueOnce(new Error('Unable to open report.'))
    await user.click(screen.getByRole('button', { name: 'Open report' }))
    expect(await screen.findByText('Unable to open report.')).toBeVisible()
  })

  it('disables report opening while an open or action is pending', async () => {
    mocks.queue.results = [
      queueItem,
      { ...queueItem, reportPublicId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }
    ]
    let resolveOpen: (value: SocialModerationEvidenceDto) => void = () => undefined
    mocks.open.mockReturnValueOnce(
      new Promise<SocialModerationEvidenceDto>((resolve) => {
        resolveOpen = resolve
      })
    )
    const user = userEvent.setup()
    renderWithAppProviders(<SocialModerationPage />)
    const openButtons = screen.getAllByRole('button', { name: 'Open report' })
    await user.click(openButtons[0])
    expect(openButtons[0]).toBeDisabled()
    expect(openButtons[1]).toBeDisabled()
    resolveOpen(evidence)
    await screen.findByText('Captured report details.')

    let resolveReview: (value: SocialModerationEvidenceDto) => void = () => undefined
    mocks.review.mockReturnValueOnce(
      new Promise<SocialModerationEvidenceDto>((resolve) => {
        resolveReview = resolve
      })
    )
    await user.type(screen.getByRole('textbox', { name: 'Audit reason' }), 'Pending action.')
    await user.click(screen.getByRole('button', { name: 'Record action' }))
    expect(screen.getAllByRole('button', { name: 'Open report' })[0]).toBeDisabled()
    resolveReview({ ...evidence, version: 2, status: 'UNDER_REVIEW' })
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Open report' })[0]).toBeEnabled()
    )
  })

  it('renders the queue error boundary with a retry action', async () => {
    mocks.queueError = true
    const user = userEvent.setup()
    renderWithAppProviders(<SocialModerationPage />)
    expect(screen.getByText('Moderation queue unavailable.')).toBeVisible()
    mocks.queueError = false
    await user.click(screen.getByRole('button', { name: 'Retry queue' }))
    expect(await screen.findByText('No reports in the queue.')).toBeVisible()
  })

  it.each([
    ['START_REVIEW', 'Start review', 'review'],
    ['RESOLVE', 'Resolve report', 'review'],
    ['DISMISS', 'Dismiss report', 'review'],
    ['HIDE_LISTING', 'Hide listing', 'listing'],
    ['RESTORE_LISTING', 'Restore listing', 'listing'],
    ['SUSPEND_PROFILE', 'Suspend profile', 'profile'],
    ['RESTORE_PROFILE', 'Restore profile', 'profile']
  ] as const)(
    'dispatches %s with a flat payload and latest version',
    async (action, label, route) => {
      mocks.queue.results = [queueItem]
      mocks.open.mockResolvedValueOnce({ ...evidence, version: 4 })
      mocks[route].mockResolvedValueOnce({ ...evidence, version: 5 })
      const user = userEvent.setup()
      renderWithAppProviders(<SocialModerationPage />)
      await user.click(screen.getByRole('button', { name: 'Open report' }))
      await screen.findByText('Captured report details.')
      if (action !== 'START_REVIEW') {
        await user.click(screen.getByRole('combobox', { name: 'Action' }))
        await user.click(await screen.findByRole('option', { name: label }))
      }
      await user.type(
        screen.getByRole('textbox', { name: 'Audit reason' }),
        'Reviewed by moderator.'
      )
      await user.click(screen.getByRole('button', { name: 'Record action' }))
      await waitFor(() =>
        expect(mocks[route]).toHaveBeenCalledWith({
          reportPublicId,
          expectedVersion: 4,
          reason: 'Reviewed by moderator.',
          action
        })
      )
      expect(screen.getByRole('textbox', { name: 'Audit reason' })).toHaveValue('')
    }
  )

  it('keeps evidence and reason visible when an action fails', async () => {
    mocks.queue.results = [queueItem]
    mocks.review.mockRejectedValueOnce(new Error('Action failed.'))
    const user = userEvent.setup()
    renderWithAppProviders(<SocialModerationPage />)
    await user.click(screen.getByRole('button', { name: 'Open report' }))
    await screen.findByText('Captured report details.')
    const reason = screen.getByRole('textbox', { name: 'Audit reason' })
    await user.type(reason, 'Keep this reason.')
    await user.click(screen.getByRole('button', { name: 'Record action' }))
    expect(await screen.findByText('Action failed.')).toBeVisible()
    expect(screen.getByText('Captured report details.')).toBeVisible()
    expect(reason).toHaveValue('Keep this reason.')
  })
})
