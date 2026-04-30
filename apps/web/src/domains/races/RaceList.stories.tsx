import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildRaceListFilters,
  mapRaceListToAuthoredItems,
  raceListAttributeColumns,
  raceListSortOptions,
  summarizeRaceList
} from '#app/data/races/raceListMapper'
import { raceListResponseFixture } from './race.fixtures'

const meta = {
  title: 'Domains/Races/List',
  component: AuthoredListPage,
  parameters: {
    docs: {
      description: {
        component: 'Race list state coverage using the shared authored-domain list pattern, category filters, draft rows, and locked-master permissions.'
      }
    }
  },
  args: {
    title: 'Races',
    summary: summarizeRaceList(raceListResponseFixture),
    createLabel: 'Create Race',
    items: mapRaceListToAuthoredItems(raceListResponseFixture),
    filters: buildRaceListFilters(raceListResponseFixture),
    attributeColumns: raceListAttributeColumns,
    sortOptions: raceListSortOptions
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const BaseRaces: Story = {
  args: {
    items: mapRaceListToAuthoredItems({
      ...raceListResponseFixture,
      items: raceListResponseFixture.items.filter((item) => item.category === 'BASE')
    })
  }
}

export const Subraces: Story = {
  args: {
    items: mapRaceListToAuthoredItems({
      ...raceListResponseFixture,
      items: raceListResponseFixture.items.filter((item) => item.category === 'SUBRACE')
    })
  }
}

export const LockedMasterRows: Story = {
  args: {
    items: mapRaceListToAuthoredItems({
      ...raceListResponseFixture,
      items: raceListResponseFixture.items.filter((item) => item.provenance.kind === 'MASTER')
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
    error: 'The race list could not be loaded. Try again in a moment.'
  }
}
