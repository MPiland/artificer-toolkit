import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildCreatureListFilters,
  creatureListAttributeColumns,
  creatureListSortOptions,
  mapCreatureListToAuthoredItems,
  summarizeCreatureList
} from '#app/data/creatures/creatureListMapper'
import { creatureListResponseFixture } from '../creature.fixtures'

const meta = {
  title: 'Domains/Creatures/List',
  component: AuthoredListPage,
  parameters: {
    docs: {
      description: {
        component: 'Creature list state coverage using the shared authored list pattern, category filters, draft rows, and locked-master permissions.'
      }
    }
  },
  args: {
    title: 'Creatures',
    summary: summarizeCreatureList(creatureListResponseFixture),
    createLabel: 'Create Creature',
    items: mapCreatureListToAuthoredItems(creatureListResponseFixture),
    filters: buildCreatureListFilters(creatureListResponseFixture),
    attributeColumns: creatureListAttributeColumns,
    sortOptions: creatureListSortOptions
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const MonsterRows: Story = {
  args: {
    items: mapCreatureListToAuthoredItems({
      ...creatureListResponseFixture,
      items: creatureListResponseFixture.items.filter((item) => item.category === 'MONSTER')
    })
  }
}

export const BeastRows: Story = {
  args: {
    items: mapCreatureListToAuthoredItems({
      ...creatureListResponseFixture,
      items: creatureListResponseFixture.items.filter((item) => item.category === 'BEAST')
    })
  }
}

export const LockedMasterRows: Story = {
  args: {
    items: mapCreatureListToAuthoredItems({
      ...creatureListResponseFixture,
      items: creatureListResponseFixture.items.filter((item) => item.provenance.kind === 'MASTER')
    })
  }
}

export const Empty: Story = {
  args: {
    items: []
  }
}

export const Loading: Story = {
  args: {
    loading: true
  }
}

export const Error: Story = {
  args: {
    error: 'The creature list could not be loaded. Try again in a moment.'
  }
}
