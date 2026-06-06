import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { RailItem } from './RailItem'
import type { Item } from '../Rail/Rail.types'
import * as storyStyles from './RailItem.stories.css'

const defaultRailItem = {
  icon: 'book',
  id: 'spell-basics',
  label: 'Spell Basics',
  status: 'complete'
} satisfies Item

const activeNestedRailItem = {
  description: 'Slot scaling rules',
  icon: 'trend',
  id: 'upcast-scaling',
  isActive: true,
  label: 'Upcast Scaling',
  level: 3,
  status: 'dirty'
} satisfies Item

const mutedEmptyRailItem = {
  icon: 'gear',
  id: 'conditions',
  label: 'Conditions',
  level: 3,
  status: 'empty',
  tone: 'muted'
} satisfies Item

const expandedBranchRailItem = {
  children: [
    {
      icon: 'spark',
      id: 'how-it-starts',
      label: 'How It Starts',
      level: 1,
      status: 'complete'
    },
    {
      icon: 'check',
      id: 'on-hit',
      label: 'On Hit',
      level: 1,
      status: 'dirty'
    }
  ],
  expanded: true,
  icon: 'gear',
  id: 'mechanics',
  label: 'Mechanics',
  status: 'dirty'
} satisfies Item

const meta = {
  title: 'Forms/Authoring/Rail/Item',
  component: RailItem,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => (
      <div className={storyStyles.storyCanvas}>
        <div className={storyStyles.itemStorySurface}>
          <div className={storyStyles.itemStoryInset}>
            <Story />
          </div>
        </div>
      </div>
    )
  ]
} satisfies Meta<typeof RailItem>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    item: defaultRailItem
  }
}

export const ActiveNested: Story = {
  args: {
    item: activeNestedRailItem
  }
}

export const MutedEmpty: Story = {
  args: {
    item: mutedEmptyRailItem
  }
}

export const ExpandedBranch: Story = {
  args: {
    item: expandedBranchRailItem
  }
}
