import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import { z } from 'zod'
import { api } from '@artificer-toolkit/apis/convex/api'
import { campaignInviteDtoSchema } from '@artificer-toolkit/schema/api/campaignCore'
import { usePaginatedQuery } from 'convex/react'
import { expect, userEvent, waitFor } from 'storybook/test'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import {
  REVIEW_STORY_PEER,
  STORY_CAMPAIGN
} from '../../../../../../apis/tests/developmentReviewDataScenarios'
import { SeededHostedListing } from '../../stories/SeededSocialListing'
import { socialStoryLoadTimeout } from '../../stories/storyLoad'
import { SocialListingInvitations } from './SocialListingInvitations'

/** The backend's own refusal of a revoke against an invitation that has moved on. */
const versionConflict = 'Social invitation version conflict.'
const invitationFrameTestId = 'seeded-invitation'

/** An id the deployment never issued. */
const missingInvitePublicId = '00000000-0000-4000-8000-000000000099'

function SeededInvitations({ missing }: { missing: boolean }) {
  const [asOf] = useState(() => new Date().toISOString())
  return (
    <SeededHostedListing title={STORY_CAMPAIGN.name}>
      {({ listingPublicId }) => (
        <SeededInvitationLink asOf={asOf} listingPublicId={listingPublicId} missing={missing} />
      )}
    </SeededHostedListing>
  )
}

/** The reader's seeded invitation to the peer, found among the listing's pending invitations. */
function SeededInvitationLink({
  asOf,
  listingPublicId,
  missing
}: {
  asOf: string
  listingPublicId: string
  missing: boolean
}) {
  const pending = usePaginatedQuery(
    api.social.admissionLists.listListingInvitations,
    { listingPublicId, group: 'PENDING', asOf },
    { initialNumItems: 8 }
  )
  const invitation = pending.results.find(
    ({ recipientUsername }) => recipientUsername === REVIEW_STORY_PEER.username
  )
  if (!invitation) return null
  return (
    <div data-testid={invitationFrameTestId} data-invitation={JSON.stringify(invitation)}>
      <SocialListingInvitations
        invitePublicId={missing ? missingInvitePublicId : invitation.invitePublicId.toUpperCase()}
        listingPublicId={listingPublicId}
      />
    </div>
  )
}

// Reads the reader's seeded invitation (D218, D221). Revokes are spies.
const meta = {
  title: 'Social/Hosting/Sent Invitations',
  component: SeededInvitations,
  args: { missing: false },
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof SeededInvitations>
export default meta
type Story = StoryObj<typeof meta>

export const FocusedDeepLink: Story = {
  play: async ({ canvas }) => {
    // The listing also holds the host's accepted invitation, so the linked row is found by its recipient.
    const peerHeading = { name: `@${REVIEW_STORY_PEER.username}` }
    const peerRow = () => canvas.getByRole('heading', peerHeading).closest('article')
    const heading = await canvas.findByRole('heading', peerHeading, {
      timeout: socialStoryLoadTimeout
    })
    // A horizon refresh can remount the row, so the focused row is the one on screen now.
    await waitFor(() => expect(heading.ownerDocument.activeElement).toBe(peerRow()))
    await expect(peerRow()).toHaveAttribute('data-highlighted', 'true')
    await expect(canvas.queryByText('This item is no longer available.')).not.toBeInTheDocument()
  }
}

export const MissingDeepLink: Story = {
  args: { missing: true },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText(
        'This item is no longer available.',
        {},
        { timeout: socialStoryLoadTimeout }
      )
    ).toBeVisible()
  }
}

export const RevokeInvitation: Story = {
  play: async ({ canvas }) => {
    const frame = await canvas.findByTestId(
      invitationFrameTestId,
      {},
      { timeout: socialStoryLoadTimeout }
    )
    const invitation = campaignInviteDtoSchema.parse(
      JSON.parse(z.string().parse(frame.dataset.invitation))
    )
    await userEvent.click(await canvas.findByRole('button', { name: 'Revoke invitation' }))
    await waitFor(
      () =>
        expect(writesTo(api.social.invitations.revoke)).toEqual([
          { invitePublicId: invitation.invitePublicId, expectedVersion: invitation.version }
        ]),
      { timeout: socialStoryLoadTimeout }
    )
  }
}

export const FailedRevoke: Story = {
  play: async ({ canvas }) => {
    storyMutation.mockRejectedValueOnce(new Error(versionConflict))
    await userEvent.click(await canvas.findByRole('button', { name: 'Revoke invitation' }))
    await expect(await canvas.findByText(versionConflict)).toBeVisible()
    await expect(canvas.getByText(`@${REVIEW_STORY_PEER.username}`)).toBeVisible()
  }
}
