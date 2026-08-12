import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect } from 'storybook/test'
import { http, HttpResponse } from 'msw'
import { SocialListingInvitations } from './SocialListingInvitations'

const listingPublicId = '00000000-0000-4000-8000-000000000002'
const invitePublicId = '00000000-0000-4000-8000-000000000004'

const meta = {
  title: 'Social/Hosting/Sent Invitations',
  component: SocialListingInvitations,
  args: {
    invitePublicId,
    listingPublicId
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/trpc/campaigns.invites.listSent', () =>
          HttpResponse.json([
            {
              result: {
                data: [
                  {
                    invitePublicId,
                    listingPublicId,
                    listingTitle: 'The Glass Harbor',
                    hostProfilePublicId: '00000000-0000-4000-8000-000000000005',
                    hostUsername: 'harbormaster',
                    recipientUsername: 'pathfinder',
                    status: 'PENDING',
                    expiresAt: '2026-08-17T18:30:00.000Z',
                    respondedAt: null,
                    createdAt: '2026-08-09T18:30:00.000Z',
                    version: 1
                  }
                ]
              }
            }
          ])
        )
      ]
    }
  }
} satisfies Meta<typeof SocialListingInvitations>

export default meta

type Story = StoryObj<typeof meta>

export const FocusedDeepLink: Story = {
  play: async ({ canvas }) => {
    const row = await canvas.findByRole('article')
    await expect(row.ownerDocument.activeElement).toBe(row)
    await expect(row).toHaveAttribute('data-highlighted', 'true')
  }
}

export const MissingDeepLink: Story = {
  args: { invitePublicId: '00000000-0000-4000-8000-000000000099' }
}
