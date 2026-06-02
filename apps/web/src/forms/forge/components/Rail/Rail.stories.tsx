import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { railItems, railSummaries } from '../../fixtures/rail.fixtures'
import { Rail } from './Rail'
import type { RailProps } from './Rail.types'
import * as storyStyles from './Rail.stories.css'

function RailStory(args: RailProps) {
  return (
    <div className={storyStyles.storyCanvas} data-mantine-color-scheme='dark'>
      <div className={storyStyles.railSurface}>
        <Rail {...args} />
      </div>
    </div>
  )
}

const meta = {
  title: 'Forms/Authoring/Rail/Container',
  component: Rail,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof Rail>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: railItems,
    summaries: railSummaries,
    subtitle: 'Ember Lance',
    title: 'Structure'
  },
  render: (args) => <RailStory {...args} />
}
