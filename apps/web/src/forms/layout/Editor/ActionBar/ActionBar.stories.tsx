import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Button } from '@mantine/core'
import { ActionBar } from './ActionBar'

type ActionBarStoryArgs = {
  canFinalize: boolean
  canSaveDraft: boolean
  dirty: boolean
  isLastStep: boolean
  padding: 'flush' | 'padded'
  surface: 'canvas' | 'header'
}

function ActionBarStory({ padding, surface }: ActionBarStoryArgs) {
  return <ActionBar padding={padding} surface={surface} />
}

const meta = {
  title: 'Forms/Authoring/AuthoringLayout/Action Bar',
  component: ActionBarStory,
  parameters: {
    layout: 'fullscreen'
  },
  argTypes: {
    canFinalize: { control: 'boolean' },
    canSaveDraft: { control: 'boolean' },
    dirty: { control: 'boolean' },
    isLastStep: { control: 'boolean' },
    padding: {
      control: 'inline-radio',
      options: ['flush', 'padded']
    },
    surface: {
      control: 'inline-radio',
      options: ['canvas', 'header']
    }
  },
  args: {
    canFinalize: true,
    canSaveDraft: true,
    dirty: false,
    isLastStep: true,
    padding: 'padded',
    surface: 'header'
  }
} satisfies Meta<typeof ActionBarStory>

export default meta

type Story = StoryObj<typeof meta>

export const States: Story = {}
