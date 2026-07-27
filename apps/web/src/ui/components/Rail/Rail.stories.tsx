import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Rail } from './Rail'
import * as storyStyles from './Rail.stories.css'

const railItems = ['Basics', 'Ancestry', 'Traits', 'Features'] as const

const meta = {
  title: 'Forms/Authoring/Rail/Container',
  component: Rail,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => (
      <div className={storyStyles.storyCanvas}>
        <div className={storyStyles.railSurface}>
          <Story />
        </div>
      </div>
    )
  ]
} satisfies Meta<typeof Rail>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Rail aria-label='Authoring navigation'>
      <Rail.Header>
        <strong>Structure</strong>
      </Rail.Header>
      <Rail.Content>
        {railItems.map((item) => (
          <Rail.Item key={item}>{item}</Rail.Item>
        ))}
      </Rail.Content>
      <Rail.Footer>4 steps</Rail.Footer>
    </Rail>
  )
}
