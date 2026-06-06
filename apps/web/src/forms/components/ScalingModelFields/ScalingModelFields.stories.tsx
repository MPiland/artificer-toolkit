import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { ScalingModelFields } from './ScalingModelFields'
import * as storyStyles from './ScalingModelFields.stories.css'

const meta = {
  title: 'Forms/Authoring/Editor/Scaling Model Fields',
  component: ScalingModelFields,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => (
      <div className={storyStyles.storyCanvas}>
        <div className={storyStyles.fieldSurface}>
          <Story />
        </div>
      </div>
    )
  ]
} satisfies Meta<typeof ScalingModelFields>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {}
}
