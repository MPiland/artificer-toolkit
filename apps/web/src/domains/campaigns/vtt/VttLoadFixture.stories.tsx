import type { Meta, StoryObj } from '@storybook/react-vite'
import { VttLoadFixture } from './VttLoadFixture'

const meta = {
  component: VttLoadFixture,
  parameters: { layout: 'fullscreen' },
  title: 'Domains/Campaigns/VTT/Load Fixture'
} satisfies Meta<typeof VttLoadFixture>

export default meta
type Story = StoryObj<typeof meta>

export const EightKScene: Story = {}
