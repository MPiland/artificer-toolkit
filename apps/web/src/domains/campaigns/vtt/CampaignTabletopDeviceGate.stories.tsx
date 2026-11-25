import type { Meta, StoryObj } from '@storybook/react-vite'
import { Text, Title } from '@mantine/core'
import { createTabletopCampaign } from './CampaignTabletop.stories.fixtures'
import { CampaignTabletopDeviceGate } from './CampaignTabletopDeviceGate'
import { CampaignTabletopLauncher } from './CampaignTabletopLauncher'

const meta = {
  component: CampaignTabletopDeviceGate,
  parameters: { layout: 'fullscreen' },
  title: 'Domains/Campaigns/VTT/Tabletop Device Gate'
} satisfies Meta<typeof CampaignTabletopDeviceGate>

export default meta
type Story = StoryObj<typeof meta>

export const GatedTabletop: Story = {
  args: {
    campaignRouteParams: { campaignPublicId: 'camp1', campaignSlug: 'the-lost-mine' },
    children: (
      <main>
        <Title order={1}>Tabletop stage</Title>
      </main>
    )
  }
}

/** The two controls that open the tabletop sit in a page that always renders, so a hidden control is observable. */
export const EntryPoints: Story = {
  args: GatedTabletop.args,
  render: () => (
    <main>
      <Title order={1}>Campaign workspace</Title>
      <Text>Session notes stay available on every device.</Text>
      <CampaignTabletopLauncher campaign={createTabletopCampaign('OWNER')} />
    </main>
  )
}
