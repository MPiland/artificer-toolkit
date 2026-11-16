import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import { z } from 'zod'
import { api } from '@artificer-toolkit/apis/convex/api'
import { campaignInviteDtoSchema } from '@artificer-toolkit/schema/api/campaignCore'
import { usePaginatedQuery } from 'convex/react'
import { expect, userEvent, waitFor } from 'storybook/test'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import {
  STORY_CAMPAIGN,
  type StoryAccountKey
} from '../../../../../apis/tests/developmentReviewDataScenarios'
import { SocialInvitationsView } from './SocialInvitationsView'

const frameTestId = 'seeded-received-invitation'

/** An id the deployment never issued. */
const missingInvitePublicId = '00000000-0000-4000-8000-000000000099'

/** The reader's seeded invitation to the peer, found among the peer's pending invitations. */
function SeededInvitations({ missing }: { missing: boolean }) {
  const [asOf] = useState(() => new Date().toISOString())
  const pending = usePaginatedQuery(
    api.social.admissionLists.listReceivedInvitations,
    { group: 'PENDING', asOf },
    { initialNumItems: 8 }
  )
  const invitation = pending.results.find(
    ({ listingTitle }) => listingTitle === STORY_CAMPAIGN.name
  )
  if (!invitation) return null
  return (
    <div data-testid={frameTestId} data-invitation={JSON.stringify(invitation)}>
      <SocialInvitationsView
        invitePublicId={missing ? missingInvitePublicId : invitation.invitePublicId.toUpperCase()}
      />
    </div>
  )
}

async function readSeededInvitation(canvas: {
  findByTestId: (id: string) => Promise<HTMLElement>
}) {
  const frame = await canvas.findByTestId(frameTestId)
  return campaignInviteDtoSchema.parse(JSON.parse(z.string().parse(frame.dataset.invitation)))
}

// Reads the invitation the reader sent the peer, under the peer's own sign-in (D218, D221).
// Accept and decline are spies, so the row keeps the state it read. Paging and an invitation that
// expired while open are covered with the real view in SocialInvitationsView.test.tsx.
const meta = {
  title: 'Social/Received Invitations',
  component: SeededInvitations,
  args: { missing: false },
  parameters: {
    layout: 'fullscreen',
    storyAccount: 'peer' satisfies StoryAccountKey
  }
} satisfies Meta<typeof SeededInvitations>
export default meta
type Story = StoryObj<typeof meta>

export const FocusedDeepLink: Story = {
  play: async ({ canvas }) => {
    const row = await canvas.findByRole('article', {}, { timeout: 5000 })
    await waitFor(() => expect(row.ownerDocument.activeElement).toBe(canvas.getByRole('article')))
    await expect(canvas.getByRole('article')).toHaveAttribute('data-highlighted', 'true')
  }
}

export const MissingDeepLink: Story = {
  args: { missing: true },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('This item is no longer available.', {}, { timeout: 5000 })
    ).toBeVisible()
  }
}

export const AcceptInvitation: Story = {
  play: async ({ canvas }) => {
    const invitation = await readSeededInvitation(canvas)
    await userEvent.click(await canvas.findByRole('button', { name: 'Accept' }))
    await waitFor(() =>
      expect(writesTo(api.social.invitations.accept)).toEqual([
        { invitePublicId: invitation.invitePublicId, expectedVersion: invitation.version }
      ])
    )
  }
}

export const DeclineFailure: Story = {
  play: async ({ canvas }) => {
    const invitation = await readSeededInvitation(canvas)
    storyMutation.mockRejectedValueOnce(new Error('Social invitation version conflict.'))
    await userEvent.click(await canvas.findByRole('button', { name: 'Decline' }))
    await expect(await canvas.findByText('Social invitation version conflict.')).toBeVisible()
    await expect(writesTo(api.social.invitations.decline)).toEqual([
      { invitePublicId: invitation.invitePublicId, expectedVersion: invitation.version }
    ])
  }
}
