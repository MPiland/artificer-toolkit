import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { aboleth } from '@artificer-toolkit/source-data/srd/creatures/aboleth.js'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { writesTo } from '#app/test/storybook/storyWrites'
import { STORY_CAMPAIGN } from '../../../../apis/tests/developmentReviewDataScenarios'
import { CampaignEncounterBuilderPage } from './CampaignEncounterBuilderPage'
import { SeededCampaign } from './stories/SeededCampaign'

function EncounterBuilderFixture() {
  return (
    <SeededCampaign>
      {(campaign) => (
        <div data-testid='seeded-campaign' data-campaign-id={campaign.id}>
          <CampaignEncounterBuilderPage campaignId={campaign.id} />
        </div>
      )}
    </SeededCampaign>
  )
}

// Reads the story account's seeded Campaign, Blueprints and the System's bestiary (D218, D221); the save is a spy.
const meta = {
  title: 'Domains/Campaigns/Encounter Blueprints',
  component: EncounterBuilderFixture,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof EncounterBuilderFixture>

export default meta

type Story = StoryObj<typeof meta>

export const AuthorBlueprint: Story = {
  play: async ({ canvasElement }) => {
    const historyBack = spyOn(window.history, 'back').mockImplementation(() => undefined)
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)

    await expect(await canvas.findByRole('heading', { name: 'Build an encounter' })).toBeVisible()
    await expect(await canvas.findByText(STORY_CAMPAIGN.blueprintName)).toBeVisible()
    // The bestiary fills from content snapshots fetched from the Session Worker after the manifest.
    await userEvent.click(canvas.getByRole('combobox', { name: 'Bestiary creature' }))
    await userEvent.click(await page.findByRole('option', { name: aboleth.label }))
    await userEvent.click(canvas.getByRole('button', { name: 'Add creature' }))
    await expect(canvas.getByText(aboleth.label)).toBeVisible()
    await userEvent.type(canvas.getByLabelText('Encounter name'), 'Clockwork patrol')
    await userEvent.type(canvas.getByLabelText('Custom enemy name'), 'Brass Defender')
    await userEvent.clear(canvas.getByLabelText('Max HP'))
    await userEvent.type(canvas.getByLabelText('Max HP'), '24')
    await userEvent.click(canvas.getByRole('button', { name: 'Add custom enemy' }))
    await expect(canvas.getByText('Custom · 24 HP')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Save encounter' }))
    await waitFor(() => expect(writesTo(api.encounters.blueprints.create)).toHaveLength(1))
    const [write] = writesTo(api.encounters.blueprints.create)
    expect(write).toMatchObject({
      name: 'Clockwork patrol',
      enemies: [
        { kind: 'CREATURE', sourceId: aboleth.id },
        { kind: 'CUSTOM', label: 'Brass Defender', maxHitPoints: 24 }
      ]
    })
    await waitFor(() => expect(historyBack).toHaveBeenCalledTimes(1))
    historyBack.mockRestore()
  }
}
