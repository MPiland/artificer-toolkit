import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import { REVIEW_STORY_PEER } from '../../../../apis/tests/developmentReviewDataScenarios'
import { SeededSocialProfiles } from './stories/SeededSocialProfiles'
import { socialStoryLoadTimeout } from './stories/storyLoad'
import { SocialProfilePage } from './SocialProfilePage'

function SeededProfilePage({ target }: { target: 'peer' | 'blocked' }) {
  return (
    <SeededSocialProfiles>
      {(profiles) => (
        <div data-testid='seeded-profile' data-profile-id={profiles[target].profilePublicId}>
          <SocialProfilePage profilePublicId={profiles[target].profilePublicId} />
        </div>
      )}
    </SeededSocialProfiles>
  )
}

// Reads the story account's seeded peer and blocked profiles (D218, D221); writes are spies, so
// the page keeps showing the state it read after each action.
const meta = {
  title: 'Social/Profile/Native actions',
  component: SeededProfilePage
} satisfies Meta<typeof SeededProfilePage>

export default meta
type Story = StoryObj<typeof meta>

export const BlockAndReport: Story = {
  args: { target: 'peer' },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole(
      'heading',
      { name: `@${REVIEW_STORY_PEER.username}` },
      { timeout: socialStoryLoadTimeout }
    )
    const targetId = (await canvas.findByTestId('seeded-profile')).dataset.profileId
    await userEvent.click(canvas.getByRole('button', { name: 'Block' }))
    await waitFor(() =>
      expect(writesTo(api.social.blocks.create)).toEqual([{ profilePublicId: targetId }])
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Report' }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = within(await body.findByRole('dialog'))
    await userEvent.type(
      await dialog.findByRole('textbox', { name: /What happened/ }),
      'Please review this interaction.'
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Submit report' }))
    await waitFor(() =>
      expect(writesTo(api.social.reports.create)).toEqual([
        {
          input: {
            targetKind: 'PROFILE',
            targetPublicId: targetId,
            reason: 'OTHER',
            details: 'Please review this interaction.'
          }
        }
      ])
    )
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
  }
}

export const UnblockSeededBlock: Story = {
  args: { target: 'blocked' },
  play: async ({ canvas }) => {
    await canvas.findByRole(
      'heading',
      { name: 'Blocked profile' },
      { timeout: socialStoryLoadTimeout }
    )
    const targetId = (await canvas.findByTestId('seeded-profile')).dataset.profileId
    await userEvent.click(canvas.getByRole('button', { name: 'Unblock' }))
    await waitFor(() =>
      expect(writesTo(api.social.blocks.remove)).toEqual([{ profilePublicId: targetId }])
    )
  }
}

export const UnblockFailure: Story = {
  args: { target: 'blocked' },
  play: async ({ canvas }) => {
    storyMutation.mockRejectedValueOnce(new Error('Unblock failed'))
    await canvas.findByRole(
      'heading',
      { name: 'Blocked profile' },
      { timeout: socialStoryLoadTimeout }
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Unblock' }))
    await canvas.findByText('The block could not be removed. Try again.')
    await expect(canvas.getByRole('heading', { name: 'Blocked profile' })).toBeVisible()
  }
}
