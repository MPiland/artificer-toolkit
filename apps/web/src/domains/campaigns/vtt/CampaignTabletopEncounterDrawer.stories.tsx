import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { CampaignTabletopEncounterDrawer } from './CampaignTabletopEncounterDrawer'
import { tabletopGmEncounter, tabletopPlayerEncounter } from './CampaignTabletop.stories.fixtures'

const meta = {
  component: CampaignTabletopEncounterDrawer,
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen'
  },
  title: 'Domains/Campaigns/VTT/Tabletop Turn Order'
} satisfies Meta<typeof CampaignTabletopEncounterDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const Gm: Story = {
  args: {
    connected: true,
    encounter: tabletopGmEncounter,
    pending: false,
    role: 'OWNER',
    onCommand: () => undefined
  }
}

export const GmOpen: Story = {
  args: Gm.args,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const encounterButton = page.getByRole('button', { name: 'Open turn order' })
    encounterButton.focus()
    await userEvent.keyboard('{Enter}')
    await expect(page.getByRole('dialog', { name: 'Turn order' })).toBeVisible()
  }
}

export const Player: Story = {
  args: {
    connected: true,
    encounter: tabletopPlayerEncounter,
    pending: false,
    role: 'PLAYER',
    onCommand: () => undefined
  }
}

export const Reconnecting: Story = {
  args: {
    ...Gm.args,
    connected: false
  }
}
