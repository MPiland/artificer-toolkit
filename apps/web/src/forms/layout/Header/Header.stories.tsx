import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { editorHeaderPath } from '../../fixtures/editor.fixtures'
import { Header } from './Header'

function HeaderStory() {
  return <Header />
}

const meta = {
  title: 'Forms/Authoring/Editor/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof Header>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    path: editorHeaderPath,
    title: 'Upcast Scaling'
  },
  render: () => <HeaderStory />
}
