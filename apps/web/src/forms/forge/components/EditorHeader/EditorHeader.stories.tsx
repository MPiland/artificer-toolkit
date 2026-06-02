import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { editorHeaderPath } from '../../fixtures/editor.fixtures'
import { EditorHeader } from './EditorHeader'

function EditorHeaderStory() {
  return <EditorHeader path={editorHeaderPath} title='Upcast Scaling' tagLabel='Spell mechanic' />
}

const meta = {
  title: 'Forms/Authoring/Editor/Header',
  component: EditorHeader,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof EditorHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    path: editorHeaderPath,
    title: 'Upcast Scaling',
    tagLabel: 'Spell mechanic'
  },
  render: () => <EditorHeaderStory />
}
