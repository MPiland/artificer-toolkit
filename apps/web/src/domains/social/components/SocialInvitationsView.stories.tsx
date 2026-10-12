import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  campaignInviteDtoSchema,
  campaignInviteVersionInputSchema,
  type CampaignInviteDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { expect, fn, mocked, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { SocialInvitationsView } from './SocialInvitationsView'

const invitePublicId = 'aaaaaaaa-0000-4000-8000-000000000004'
const invitation = campaignInviteDtoSchema.parse({
  invitePublicId,
  listingPublicId: '00000000-0000-4000-8000-000000000002',
  listingTitle: 'The Glass Harbor',
  hostProfilePublicId: '00000000-0000-4000-8000-000000000005',
  hostUsername: 'harbormaster',
  recipientUsername: 'pathfinder',
  status: 'PENDING',
  expiresAt: '2024-04-08T18:30:00.000Z',
  respondedAt: null,
  createdAt: '2024-04-01T11:30:00.000Z',
  version: 1
})

const names = {
  getReceived: getFunctionName(api.social.invitationReads.getReceived),
  accept: getFunctionName(api.social.invitations.accept),
  decline: getFunctionName(api.social.invitations.decline)
}
const action = fn<(name: string, input: unknown) => void>()
function Fixture({
  missing = false,
  fail = false,
  expired = false
}: {
  missing?: boolean
  fail?: boolean
  expired?: boolean
}) {
  const [status, setStatus] = useState<CampaignInviteDto['status']>(expired ? 'EXPIRED' : 'PENDING')
  const current = { ...invitation, status }
  const queryClient = useQueryClient()
  queryClient.setQueryDefaults(['convexQuery', names.getReceived], {
    retry: false,
    queryFn: async () => {
      if (missing) throw new Error('Unavailable')
      return current
    }
  })
  mocked(usePaginatedQuery).mockReturnValue({
    results: [],
    status: 'Exhausted',
    loadMore: () => undefined,
    isLoading: false
  })
  mocked(useConvexMutation).mockImplementation((reference) => {
    const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
      async (input?: unknown) => {
        const name = getFunctionName(reference)
        action(name, campaignInviteVersionInputSchema.parse(input))
        if (fail) throw new Error('Invitation action failed.')
        const next = name === names.accept ? 'ACCEPTED' : 'DECLINED'
        setStatus(next)
        queryClient.setQueriesData(
          { queryKey: ['convexQuery', names.getReceived] },
          { ...invitation, status: next }
        )
        return null
      },
      { withOptimisticUpdate: () => mutate }
    )
    return mutate
  })
  return (
    <SocialInvitationsView
      invitePublicId={
        missing ? '00000000-0000-4000-8000-000000000099' : invitePublicId.toUpperCase()
      }
    />
  )
}

const meta = {
  title: 'Social/Received Invitations',
  component: Fixture,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    action.mockClear()
  }
} satisfies Meta<typeof Fixture>
export default meta
type Story = StoryObj<typeof meta>
export const FocusedDeepLink: Story = {
  play: async ({ canvasElement }) => {
    const row = await within(canvasElement).findByRole('article')
    await expect(row.ownerDocument.activeElement).toBe(row)
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
export const AcceptInvitation: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Accept' }))
    await expect(action).toHaveBeenCalledWith(names.accept, {
      invitePublicId,
      expectedVersion: 1
    })
    await expect(canvas.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
  }
}
export const DeclineFailure: Story = {
  args: { fail: true },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Decline' }))
    await expect(await canvas.findByText('Invitation action failed.')).toBeVisible()
    await expect(action).toHaveBeenCalledWith(names.decline, {
      invitePublicId,
      expectedVersion: 1
    })
  }
}
export const ExpiredInvitation: Story = {
  args: { expired: true },
  play: async ({ canvas }) => {
    await canvas.findByRole('article')
    await expect(canvas.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
    await expect(
      canvas.getByText('Sorry, this invitation has either been revoked or expired.')
    ).toBeVisible()
  }
}
