import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQuery } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { expect, waitFor, within } from 'storybook/test'
import { liveFramesReceived } from '#app/test/storybook/storyLiveSession'
import { SeededCampaign } from '../stories/SeededCampaign'
import { CampaignTabletopWindow } from './CampaignTabletopWindow'

/** The Tabletop window the story account opens on its own Campaign, as the tabletop route does. */
function SeededTabletopWindow() {
  const session = useQuery(api.account.session, {})
  return (
    <SeededCampaign>
      {(campaign) =>
        session?.user ? (
          <div data-testid='seeded-campaign' data-campaign-id={campaign.id}>
            <CampaignTabletopWindow campaignId={campaign.id} currentUserId={session.user.userId} />
          </div>
        ) : null
      }
    </SeededCampaign>
  )
}

// Opens a real live session on the stack's Session Worker for the story Campaign (D218): the room
// connects through the real ticket and token flow, and COMMAND frames are recorded, never sent.
const meta = {
  title: 'Domains/Campaigns/VTT/Tabletop Window',
  component: SeededTabletopWindow,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof SeededTabletopWindow>

export default meta

type Story = StoryObj<typeof meta>

export const RoomConnected: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const campaign = await page.findByTestId('seeded-campaign')
    await expect(
      await page.findByText('No scene is being presented', undefined, { timeout: 30_000 })
    ).toBeVisible()

    await waitFor(
      () =>
        expect(liveFramesReceived()).toEqual(
          expect.arrayContaining([
            { type: 'TRANSIENT_READY', campaignId: campaign.dataset.campaignId },
            expect.objectContaining({ type: 'STATE_SYNC' })
          ])
        ),
      { timeout: 30_000 }
    )
  }
}
