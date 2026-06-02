import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { ScalingModelFields } from './ScalingModelFields'
import * as storyStyles from './ScalingModelFields.stories.css'

function ScalingModelFieldsStory() {
  return (
    <div className={storyStyles.storyCanvas} data-mantine-color-scheme='dark'>
      <div className={storyStyles.fieldSurface}>
        <ScalingModelFields />
      </div>
    </div>
  )
}

const meta = {
  title: 'Forms/Authoring/Editor/Scaling Model Fields',
  component: ScalingModelFields,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof ScalingModelFields>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <ScalingModelFieldsStory />
}
