import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { writesTo } from '#app/test/storybook/storyWrites'
import type { StoryAccountKey } from '../../../../apis/tests/developmentReviewDataScenarios'
import { SocialModerationPage } from './SocialModerationPage'

// Reads the report the story reader filed through the report command, as the seeded superadmin
// (D218, D221). Opening evidence is the deployment's one read of a report's evidence and it records
// an audit entry, so it is a spied write like every other: the opened-report panel and the actions
// it offers are covered against the real page in SocialModerationPage.test.tsx.
const meta = {
  title: 'Social/Moderation/Queue',
  component: SocialModerationPage,
  parameters: { storyAccount: 'admin' satisfies StoryAccountKey }
} satisfies Meta<typeof SocialModerationPage>

export default meta
type Story = StoryObj<typeof meta>

export const SeededReport: Story = {
  play: async ({ canvas }) => {
    const reason = (await canvas.findAllByRole('heading', { name: 'Other' }))[0]
    const row = reason.closest('article')
    if (!row) throw new Error('The report heading is not inside a queue row.')
    await expect(canvas.queryByText('No reports in the queue.')).not.toBeInTheDocument()
    await expect(within(row).getByText('Profile')).toBeVisible()
    await expect(within(row).getByText('Submitted')).toBeVisible()
    await userEvent.click(within(row).getByRole('button', { name: 'Open report' }))
    await waitFor(() =>
      expect(writesTo(api.social.moderation.open)).toEqual([
        { reportPublicId: row.dataset.reportId }
      ])
    )
  }
}
