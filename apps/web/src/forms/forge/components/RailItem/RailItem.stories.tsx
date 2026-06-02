import type { Meta, StoryObj } from '@storybook/tanstack-react'
import type { Item } from '../Rail/Rail.types'
import {
  activeNestedRailItem,
  defaultRailItem,
  expandedBranchRailItem,
  mutedEmptyRailItem
} from '../../fixtures/rail.fixtures'
import { RailItem } from './RailItem'
import * as storyStyles from './RailItem.stories.css'

function RailItemStory({ item }: { item: Item }) {
  return (
    <div className={storyStyles.storyCanvas} data-mantine-color-scheme='dark'>
      <div className={storyStyles.itemStorySurface}>
        <div className={storyStyles.itemStoryInset}>
          <RailItem item={item} />
        </div>
      </div>
    </div>
  )
}

const meta = {
  title: 'Forms/Authoring/Rail/Item',
  component: RailItem,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof RailItem>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    item: defaultRailItem
  },
  render: (args) => <RailItemStory item={args.item} />
}

export const ActiveNested: Story = {
  args: {
    item: activeNestedRailItem
  },
  render: (args) => <RailItemStory item={args.item} />
}

export const MutedEmpty: Story = {
  args: {
    item: mutedEmptyRailItem
  },
  render: (args) => <RailItemStory item={args.item} />
}

export const ExpandedBranch: Story = {
  args: {
    item: expandedBranchRailItem
  },
  render: (args) => <RailItemStory item={args.item} />
}
