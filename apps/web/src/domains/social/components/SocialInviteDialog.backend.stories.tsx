import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import {
  REVIEW_STORY_PEER,
  STORY_CAMPAIGN,
  STORY_SOCIAL,
  type StoryAccountKey
} from '../../../../../apis/tests/developmentReviewDataScenarios'
import { readSeededListing } from '../stories/seededListing'
import { SeededHostedListing } from '../stories/SeededSocialListing'
import { socialStoryLoadTimeout } from '../stories/storyLoad'
import { SocialInviteDialog } from './SocialInviteDialog'

function SeededInviteDialog({ title }: { title: string }) {
  return (
    <SeededHostedListing title={title}>
      {(listing) => <SocialInviteDialog listing={listing} />}
    </SeededHostedListing>
  )
}

// Reads the reader's open listing, and the peer's draft one (D218, D221). Invitations are spies,
// so the dialog never sees the deployment's answer.
const meta = {
  title: 'Social/Hosting/Native invitation',
  component: SeededInviteDialog,
  args: { title: STORY_CAMPAIGN.name }
} satisfies Meta<typeof SeededInviteDialog>
export default meta
type Story = StoryObj<typeof meta>

export const FailedSendCanRetry: Story = {
  play: async ({ canvas, canvasElement }) => {
    const listing = await readSeededListing(canvas)
    // The deployment refuses an invitation to a username that already has one pending.
    storyMutation.mockRejectedValueOnce(new Error('This user already has a pending invitation.'))
    await userEvent.click(
      await canvas.findByRole(
        'button',
        { name: 'Invite player' },
        { timeout: socialStoryLoadTimeout }
      )
    )
    const body = within(canvasElement.ownerDocument.body)
    const dialog = within(await body.findByRole('dialog'))
    await userEvent.type(
      await dialog.findByRole('textbox', { name: /Username/ }),
      REVIEW_STORY_PEER.username
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }))
    await expect(
      await dialog.findByText('This user already has a pending invitation.')
    ).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: /Username/ })).toHaveValue(
      REVIEW_STORY_PEER.username
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
    const sent = {
      listingPublicId: listing.listingPublicId,
      expectedListingVersion: listing.version,
      username: REVIEW_STORY_PEER.username
    }
    await expect(writesTo(api.social.invitations.create)).toEqual([sent, sent])
  }
}

export const DraftListing: Story = {
  args: { title: STORY_SOCIAL.peerTableName },
  parameters: { storyAccount: 'peer' satisfies StoryAccountKey },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole(
        'button',
        { name: 'Invite player' },
        { timeout: socialStoryLoadTimeout }
      )
    ).toBeDisabled()
    await expect(writesTo(api.social.invitations.create)).toEqual([])
  }
}
