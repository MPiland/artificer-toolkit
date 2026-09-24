import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useMutation as useConvexMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { createCampaignInviteInputSchema } from '@artificer-toolkit/schema/api/campaignCore'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import { SocialInviteDialog } from './SocialInviteDialog'

const create = fn<(input: unknown) => Promise<null>>()
const meta = {
  title: 'Social/Hosting/Native invitation',
  component: SocialInviteDialog,
  args: {
    listing: {
      listingPublicId: 'aaaaaaaa-1111-4111-8111-111111111111',
      title: 'The Glass Harbor',
      version: 3,
      status: 'OPEN'
    }
  },
  beforeEach: () => {
    create.mockReset().mockResolvedValue(null)
    mocked(useConvexMutation).mockImplementation((reference) => {
      const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
        async (input?: unknown) => {
          if (getFunctionName(reference) !== 'social/invitations:create')
            throw new Error('Unexpected native mutation')
          return create(createCampaignInviteInputSchema.parse(input))
        },
        { withOptimisticUpdate: () => mutate }
      )
      return mutate
    })
  }
} satisfies Meta<typeof SocialInviteDialog>
export default meta
type Story = StoryObj<typeof meta>

export const FailedSendCanRetry: Story = {
  play: async ({ canvas, canvasElement }) => {
    create.mockRejectedValueOnce(new Error('Invitation could not be sent.'))
    await userEvent.click(canvas.getByRole('button', { name: 'Invite player' }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = within(await body.findByRole('dialog'))
    await userEvent.type(await dialog.findByRole('textbox', { name: /Username/ }), 'PlayerOne')
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }))
    await expect(await dialog.findByText('Invitation could not be sent.')).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: /Username/ })).toHaveValue('PlayerOne')
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(create).toHaveBeenCalledTimes(2)
    await expect(create).toHaveBeenLastCalledWith({
      listingPublicId: 'aaaaaaaa-1111-4111-8111-111111111111',
      expectedListingVersion: 3,
      username: 'PlayerOne'
    })
  }
}

export const ClosedListing: Story = {
  args: { listing: { ...meta.args.listing, status: 'CLOSED' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Invite player' })).toBeDisabled()
    await expect(create).not.toHaveBeenCalled()
  }
}
