import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  campaignInviteVersionInputSchema,
  type CampaignInviteDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { expect, fn, mocked, userEvent, within } from 'storybook/test'
import { SocialListingInvitations } from './SocialListingInvitations'

const listingPublicId = '00000000-0000-4000-8000-000000000002'
const invitePublicId = 'aaaaaaaa-0000-4000-8000-000000000004'
const invitation = {
  invitePublicId,
  listingPublicId,
  listingTitle: 'The Glass Harbor',
  hostProfilePublicId: '00000000-0000-4000-8000-000000000005',
  hostUsername: 'harbormaster',
  recipientUsername: 'pathfinder',
  status: 'PENDING',
  expiresAt: '2024-04-08T18:30:00.000Z',
  respondedAt: null,
  createdAt: '2024-04-01T11:30:00.000Z',
  version: 1
} satisfies CampaignInviteDto
const revokeCall = fn()

function NativeFixture({ missing = false, fail = false }: { missing?: boolean; fail?: boolean }) {
  const queryClient = useQueryClient()
  queryClient.setQueryDefaults(['convexQuery', 'social/invitationReads:getForListing'], {
    retry: false,
    queryFn: async () => {
      if (missing) throw new Error('Unavailable')
      return invitation
    }
  })
  mocked(usePaginatedQuery).mockImplementation((reference, args) =>
    getFunctionName(reference) === 'social/admissionLists:listListingInvitations'
      ? {
          results:
            args !== 'skip' && 'group' in args && args.group === 'PENDING' ? [invitation] : [],
          status: 'Exhausted',
          loadMore: fn(),
          isLoading: false
        }
      : { results: [], status: 'Exhausted', loadMore: fn(), isLoading: false }
  )
  mocked(useConvexMutation).mockImplementation((reference) => {
    const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
      async (input?: unknown) => {
        if (getFunctionName(reference) !== 'social/invitations:revoke')
          throw new Error('Unexpected mutation')
        revokeCall(campaignInviteVersionInputSchema.parse(input))
        if (fail) throw new Error('Revoke failed.')
        return invitation
      },
      { withOptimisticUpdate: () => mutate }
    )
    return mutate
  })
  return (
    <SocialListingInvitations
      invitePublicId={
        missing ? '00000000-0000-4000-8000-000000000099' : invitePublicId.toUpperCase()
      }
      listingPublicId={listingPublicId}
    />
  )
}

const meta = {
  title: 'Social/Hosting/Sent Invitations',
  component: NativeFixture,
  args: { missing: false },
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    revokeCall.mockClear()
  }
} satisfies Meta<typeof NativeFixture>
export default meta
type Story = StoryObj<typeof meta>

export const FocusedDeepLink: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('article')
    await expect(row.ownerDocument.activeElement).toBe(row)
    await expect(row).toHaveAttribute('data-highlighted', 'true')
  }
}
export const MissingDeepLink: Story = {
  args: { missing: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).findByText('This item is no longer available.')
    ).resolves.toBeVisible()
  }
}
export const RevokeInvitation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Revoke invitation' }))
    await expect(revokeCall).toHaveBeenCalledWith({ invitePublicId, expectedVersion: 1 })
  }
}
export const FailedRevoke: Story = {
  args: { fail: true },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Revoke invitation' }))
    await expect(await canvas.findByText('Revoke failed.')).toBeVisible()
    await expect(canvas.getByText('@pathfinder')).toBeVisible()
  }
}
