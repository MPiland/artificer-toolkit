import type { Meta, StoryObj } from '@storybook/react-vite'
import { CampaignTabletopLauncher } from './CampaignTabletopLauncher'
import { createTabletopCampaign } from './CampaignTabletop.stories.fixtures'

const meta = {
  component: CampaignTabletopLauncher,
  parameters: { layout: 'padded' },
  title: 'Domains/Campaigns/VTT/Tabletop Launcher'
} satisfies Meta<typeof CampaignTabletopLauncher>

export default meta
type Story = StoryObj<typeof meta>

export const SessionWorkspace: Story = {
  args: { campaign: createTabletopCampaign('OWNER') }
}
