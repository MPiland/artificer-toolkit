import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { SlidersHorizontal } from 'lucide-react'
import { EditorSection } from './EditorSection'
import * as storyStyles from './EditorSection.stories.css'

function EditorSectionStory() {
  return (
    <EditorSection
      headingId='editor-section-story-heading'
      icon={<SlidersHorizontal aria-hidden='true' size={14} />}
      title='Scaling Model'
    >
      <div className={storyStyles.bodyPreview}>Section body content renders here.</div>
    </EditorSection>
  )
}

const meta = {
  title: 'Forms/Authoring/Editor/Section',
  component: EditorSection,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => (
      <div className={storyStyles.storyCanvas}>
        <div className={storyStyles.sectionSlot}>
          <Story />
        </div>
      </div>
    )
  ]
} satisfies Meta<typeof EditorSection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    headingId: 'editor-section-story-heading',
    title: 'Scaling Model',
    children: 'Section body content renders here.'
  },
  render: () => <EditorSectionStory />
}
