import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { z } from 'zod'
import { api } from '@artificer-toolkit/apis/convex/api'
import { socialApplicationDtoSchema } from '@artificer-toolkit/schema/api/socialHub'
import { usePaginatedQuery } from 'convex/react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import {
  STORY_CAMPAIGN,
  STORY_SOCIAL,
  type StoryAccountKey
} from '../../../../../apis/tests/developmentReviewDataScenarios'
import { socialStoryLoadTimeout } from '../stories/storyLoad'
import { SocialApplicationsView } from './SocialApplicationsView'

const frameTestId = 'seeded-application'

/** The peer's seeded application to the reader's listing, found by its seeded message. */
function SeededApplications({ direct }: { direct: boolean }) {
  const pending = usePaginatedQuery(
    api.social.admissionLists.listOwnApplications,
    { group: 'PENDING' },
    { initialNumItems: 8 }
  )
  const application = pending.results.find(
    ({ message }) => message === STORY_SOCIAL.applicationMessage
  )
  if (!application) return null
  return (
    <div data-testid={frameTestId} data-application={JSON.stringify(application)}>
      <SocialApplicationsView
        applicationPublicId={direct ? application.applicationPublicId.toUpperCase() : undefined}
      />
    </div>
  )
}

async function readSeededApplication(canvas: {
  findByTestId: (
    id: string,
    options: object,
    waitForOptions: { timeout: number }
  ) => Promise<HTMLElement>
}) {
  const frame = await canvas.findByTestId(frameTestId, {}, { timeout: socialStoryLoadTimeout })
  return socialApplicationDtoSchema.parse(JSON.parse(z.string().parse(frame.dataset.application)))
}

/** The view lists applications through its own queries, so the seeded frame does not mean its row has loaded. */
function findWithdraw(canvas: ReturnType<typeof within>) {
  return canvas.findByRole(
    'button',
    { name: 'Withdraw application' },
    { timeout: socialStoryLoadTimeout }
  )
}

// Reads the peer's seeded application under the peer's own sign-in (D218, D221). Withdrawals are
// spies, so the row keeps the state it read. Paging and history ordering are covered with the real
// view in SocialApplicationsView.test.tsx.
const meta = {
  title: 'Domains/Social/Application history',
  component: SeededApplications,
  args: { direct: false },
  parameters: {
    layout: 'fullscreen',
    storyAccount: 'peer' satisfies StoryAccountKey
  }
} satisfies Meta<typeof SeededApplications>
export default meta
type Story = StoryObj<typeof meta>

export const DirectLinkFocusesApplication: Story = {
  args: { direct: true },
  play: async ({ canvas }) => {
    // The view reads the direct-link application through its own query, after the frame's list.
    await expect(
      await canvas.findByRole(
        'heading',
        { name: STORY_CAMPAIGN.name },
        { timeout: socialStoryLoadTimeout }
      )
    ).toBeVisible()
    await waitFor(() => expect(canvas.getByRole('article')).toHaveFocus())
    await expect(canvas.getByRole('article')).toHaveAttribute('data-highlighted', 'true')
  }
}

export const WithdrawApplication: Story = {
  play: async ({ canvas }) => {
    const application = await readSeededApplication(canvas)
    await userEvent.click(await findWithdraw(canvas))
    await waitFor(() =>
      expect(writesTo(api.social.applications.withdraw)).toEqual([
        {
          applicationPublicId: application.applicationPublicId,
          expectedVersion: application.version
        }
      ])
    )
  }
}

export const FailedWithdrawKeepsBlocksVisible: Story = {
  play: async ({ canvas }) => {
    const application = await readSeededApplication(canvas)
    storyMutation.mockRejectedValueOnce(new Error('Social application version conflict.'))
    await userEvent.click(await findWithdraw(canvas))
    await expect(await canvas.findByText('Social application version conflict.')).toBeVisible()
    await expect(canvas.getByText('Blocked profiles')).toBeVisible()
    await expect(writesTo(api.social.applications.withdraw)).toEqual([
      { applicationPublicId: application.applicationPublicId, expectedVersion: application.version }
    ])
  }
}
