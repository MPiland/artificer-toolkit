import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import { socialBlockInputSchema } from '@artificer-toolkit/schema/api/socialHub'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import { SocialBlocksPanel } from './SocialBlocksPanel'

const blockedProfile = {
  profile: {
    profilePublicId: '22222222-2222-4222-8222-222222222222',
    username: 'BlockedPlayer'
  },
  createdAt: '2026-09-01T00:00:00.000Z'
}

type Block = typeof blockedProfile
type Page = {
  results: Block[]
  status: 'CanLoadMore' | 'Exhausted'
}

const removeCall = fn<(input: { profilePublicId: string }) => Promise<null>>()

function StatefulBlocksFixture({ failRemove = false }: { failRemove?: boolean }) {
  const [page, setPage] = useState<Page>({ results: [], status: 'CanLoadMore' })
  mocked(usePaginatedQuery).mockReturnValue({
    ...page,
    isLoading: false,
    loadMore: () => setPage({ results: [blockedProfile], status: 'Exhausted' })
  })
  mocked(useConvexMutation).mockImplementation(() => {
    const mutation: ReturnType<typeof useConvexMutation> = Object.assign(
      async (input?: unknown) => {
        const parsed = socialBlockInputSchema.parse(input)
        removeCall(parsed)
        if (failRemove) throw new Error('Unable to unblock profile.')
        setPage({ results: [], status: 'Exhausted' })
        return null
      },
      { withOptimisticUpdate: () => mutation }
    )
    return mutation
  })
  return <SocialBlocksPanel />
}

const meta = {
  title: 'Domains/Social/Blocked profiles',
  component: StatefulBlocksFixture,
  parameters: {
    layout: 'fullscreen',
    tanstack: { router: { context: { user: { id: '11111111-1111-4111-8111-111111111111' } } } }
  },
  beforeEach: () => {
    removeCall.mockClear()
  }
} satisfies Meta<typeof StatefulBlocksFixture>

export default meta
type Story = StoryObj<typeof meta>

export const EmptyPageLoadsResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Load more blocked profiles' }))
    await expect(await canvas.findByText('@BlockedPlayer')).toBeVisible()
  }
}

export const SuccessfulUnblockUsesPublicId: Story = {
  args: { failRemove: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Load more blocked profiles' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Unblock' }))
    await expect(removeCall).toHaveBeenCalledWith({
      profilePublicId: blockedProfile.profile.profilePublicId
    })
    await waitFor(() => expect(canvas.queryByText('@BlockedPlayer')).not.toBeInTheDocument())
  }
}

export const FailedUnblockPreservesRow: Story = {
  args: { failRemove: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Load more blocked profiles' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Unblock' }))
    await expect(await canvas.findByText('Unable to unblock profile.')).toBeVisible()
    await expect(canvas.getByText('@BlockedPlayer')).toBeVisible()
  }
}
