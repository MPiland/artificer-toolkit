import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { socialBlockDtoSchema } from '@artificer-toolkit/schema/api/socialHub'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SocialBlocksPanel } from './SocialBlocksPanel'

const blockedProfile = socialBlockDtoSchema.parse({
  profile: {
    profilePublicId: '22222222-2222-4222-8222-222222222222',
    username: 'BlockedPlayer'
  },
  createdAt: '2026-09-01T00:00:00.000Z'
})

const mocks = vi.hoisted(() => ({
  blocks: {
    results: [] as Array<{
      profile: { profilePublicId: string; username: string }
      createdAt: string
    }>,
    status: 'CanLoadMore' as 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore',
    loadMore: vi.fn()
  },
  list: vi.fn(),
  removeBlock: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: (...args: unknown[]) => {
    mocks.list(...args)
    return mocks.blocks
  },
  useMutation: () => mocks.removeBlock
}))

describe('SocialBlocksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.blocks.results = []
    mocks.blocks.status = 'CanLoadMore'
    mocks.removeBlock.mockResolvedValue(null)
  })

  it('uses native pagination and loads the next empty page', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<SocialBlocksPanel />)

    expect(mocks.list).toHaveBeenCalledWith(expect.anything(), {}, { initialNumItems: 24 })
    expect(screen.getByRole('button', { name: 'Load more blocked profiles' })).toBeVisible()
    expect(screen.queryByText('You have not blocked anyone.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more blocked profiles' }))
    expect(mocks.blocks.loadMore).toHaveBeenCalledWith(24)
  })

  it('renders the next results and unblocks through the native mutation payload', async () => {
    mocks.blocks.results = [blockedProfile]
    const user = userEvent.setup()
    renderWithAppProviders(<SocialBlocksPanel />)

    await user.click(screen.getByRole('button', { name: 'Unblock' }))
    await waitFor(() =>
      expect(mocks.removeBlock).toHaveBeenCalledWith({
        profilePublicId: blockedProfile.profile.profilePublicId
      })
    )
  })

  it('shows the empty message only for an exhausted empty list', () => {
    mocks.blocks.status = 'Exhausted'
    renderWithAppProviders(<SocialBlocksPanel />)

    expect(screen.getByText('You have not blocked anyone.')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Load more blocked profiles' })
    ).not.toBeInTheDocument()
  })

  it('keeps a mutation failure visible', async () => {
    mocks.blocks.results = [blockedProfile]
    mocks.removeBlock.mockRejectedValue(new Error('Unable to unblock profile.'))
    const user = userEvent.setup()
    renderWithAppProviders(<SocialBlocksPanel />)

    await user.click(screen.getByRole('button', { name: 'Unblock' }))
    expect(await screen.findByText('Unable to unblock profile.')).toBeVisible()
  })

  it('renders the list error fallback', () => {
    mocks.list.mockImplementation(() => {
      throw new Error('List unavailable')
    })
    renderWithAppProviders(<SocialBlocksPanel />)

    expect(screen.getByText('Could not load blocked profiles.')).toBeVisible()
  })
})
