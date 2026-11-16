import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import { REVIEW_STORY_BLOCKED } from '../../../../../apis/tests/developmentReviewDataScenarios'
import { SeededSocialProfiles } from '../stories/SeededSocialProfiles'
import { SocialBlocksPanel } from './SocialBlocksPanel'

function SeededBlocks() {
  return (
    <SeededSocialProfiles>
      {({ blocked }) => (
        <div data-testid='seeded-block' data-profile-id={blocked.profilePublicId}>
          <SocialBlocksPanel />
        </div>
      )}
    </SeededSocialProfiles>
  )
}

/** The block list is its own paginated query, so the seeded frame does not mean its row has loaded. */
function findSeededBlockUnblock(canvas: ReturnType<typeof within>) {
  return canvas.findByRole('button', { name: 'Unblock' }, { timeout: 5000 })
}

// Reads the story reader's seeded block (D218, D221). Unblocking is a spy, so the row keeps the
// state it read. Paging past a first page is covered with the real panel in
// SocialBlocksPanel.test.tsx.
const meta = {
  title: 'Domains/Social/Blocked profiles',
  component: SeededBlocks,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof SeededBlocks>
export default meta
type Story = StoryObj<typeof meta>

export const SeededBlockIsListed: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(`@${REVIEW_STORY_BLOCKED.username}`)).toBeVisible()
  }
}

export const UnblockUsesPublicId: Story = {
  play: async ({ canvas }) => {
    const profilePublicId = (await canvas.findByTestId('seeded-block')).dataset.profileId
    await userEvent.click(await findSeededBlockUnblock(canvas))
    await waitFor(() => expect(writesTo(api.social.blocks.remove)).toEqual([{ profilePublicId }]))
  }
}

export const FailedUnblockPreservesRow: Story = {
  play: async ({ canvas }) => {
    storyMutation.mockRejectedValueOnce(new Error('Social block not found.'))
    await userEvent.click(await findSeededBlockUnblock(canvas))
    await expect(await canvas.findByText('Social block not found.')).toBeVisible()
    await expect(canvas.getByText(`@${REVIEW_STORY_BLOCKED.username}`)).toBeVisible()
  }
}
