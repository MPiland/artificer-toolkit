import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Rail } from './Rail'
import type { Item, Summary } from './Rail.types'
import * as storyStyles from './Rail.stories.css'

const railItems = [
  {
    icon: 'book',
    id: 'spell-basics',
    label: 'Spell Basics',
    status: 'complete'
  },
  {
    children: [
      {
        description: 'Action, range, targeting',
        icon: 'spark',
        id: 'how-it-starts',
        label: 'How It Starts',
        level: 1,
        status: 'complete'
      },
      {
        children: [
          {
            children: [
              {
                description: 'Slot scaling rules',
                icon: 'trend',
                id: 'upcast-scaling',
                isActive: true,
                label: 'Upcast Scaling',
                level: 3,
                status: 'dirty'
              },
              {
                icon: 'gear',
                id: 'conditions',
                label: 'Conditions',
                level: 3,
                status: 'empty',
                tone: 'muted'
              }
            ],
            expanded: true,
            icon: 'flame',
            id: 'fire-damage',
            label: 'Fire Damage',
            level: 2,
            status: 'complete'
          },
          {
            icon: 'bolt',
            id: 'saving-throw',
            label: 'Saving Throw',
            level: 2,
            status: 'warning'
          }
        ],
        expanded: true,
        icon: 'check',
        id: 'on-hit',
        label: 'On Hit',
        level: 1,
        status: 'complete'
      }
    ],
    expanded: true,
    icon: 'gear',
    id: 'mechanics',
    label: 'Mechanics',
    status: 'dirty'
  },
  {
    icon: 'book',
    id: 'description',
    label: 'Description',
    status: 'complete'
  },
  {
    icon: 'spark',
    id: 'options',
    label: 'Options',
    status: 'empty',
    tone: 'muted'
  }
] satisfies readonly Item[]

const railSummaries = [
  { label: 'complete', status: 'complete', value: '6/8' },
  { label: 'unsaved', status: 'dirty', value: 'Edited' },
  { label: 'needs review', status: 'warning', value: '1 issue' }
] satisfies readonly Summary[]

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
  args: {
    items: railItems,
    summaries: railSummaries,
    subtitle: 'Ember Lance',
    title: 'Structure'
  }
}
