import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Stack } from '@mantine/core'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { writesTo } from '#app/test/storybook/storyWrites'
import type { StoryQueryOverride } from '#app/test/storybook/storyQueryOverride'
import { STORY_CAMPAIGN } from '../../../../../apis/tests/developmentReviewDataScenarios'
import { SeededCampaign } from '../stories/SeededCampaign'
import { CampaignSettings } from './CampaignSettings'
import { CampaignTableSettings } from './CampaignTableSettings/CampaignTableSettings'

function CampaignSettingsFixture() {
  return (
    <SeededCampaign>
      {(campaign) => (
        <Stack p='xl'>
          <CampaignSettings campaign={campaign} />
          <CampaignTableSettings campaign={campaign} />
        </Stack>
      )}
    </SeededCampaign>
  )
}

// Reads the story account's seeded Campaign (D218, D221); writes are spies.
const meta = {
  title: 'Domains/Campaigns/Settings',
  component: CampaignSettingsFixture,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof CampaignSettingsFixture>

export default meta

type Story = StoryObj<typeof meta>

export const RulesAndAutomation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await expect(await canvas.findByLabelText('Game System')).toHaveValue(srdSystemRecord.label)
    await expect(await canvas.findByText(/^Entries \d+ \/ 150$/)).toBeVisible()
    await expect(await canvas.findByLabelText(/Primary Rules Catalogue/i)).toHaveValue(
      SRD_RULES_CATALOGUE.label
    )
    await expect(await canvas.findByLabelText('Automation mode')).toHaveValue('Assisted')
    await expect(await canvas.findByLabelText('Initiative policy')).not.toHaveValue('')
    await expect(await canvas.findByLabelText('Initiative tie resolver')).not.toHaveValue('')

    await userEvent.click(canvas.getByLabelText('Automation mode'))
    await userEvent.click(await page.findByRole('option', { name: 'Manual' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save table settings' }))
    await waitFor(() => expect(writesTo(api.campaigns.playSettings.save)).toHaveLength(1))
    const [write] = writesTo(api.campaigns.playSettings.save)
    expect(write).toMatchObject({
      ...STORY_CAMPAIGN.playSettings,
      expectedVersion: 1,
      automationMode: 'MANUAL'
    })
    expect(write).toHaveProperty('campaignId')
    await waitFor(async () =>
      expect(await canvas.findByLabelText('Automation mode')).toHaveValue('Manual')
    )
  }
}

/** The Campaign at its host plan's limits, a state the seeded account does not reach. */
export const ContentLimitsReached: Story = {
  parameters: {
    queryOverride: {
      query: getFunctionName(api.campaigns.queries.contentUsage),
      value: { entries: { used: 150, limit: 150 }, scenes: { used: 5, limit: 5 } }
    } satisfies StoryQueryOverride
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Entries 150 / 150')).toBeVisible()
    await expect(await canvas.findByText('Scenes 5 / 5')).toBeVisible()
  }
}
