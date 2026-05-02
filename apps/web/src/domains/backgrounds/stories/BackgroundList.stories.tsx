import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  backgroundListAttributeColumns,
  backgroundListSortOptions,
  buildBackgroundListFilters,
  mapBackgroundListToAuthoredItems,
  summarizeBackgroundList
} from '#app/data/backgrounds/backgroundListMapper'
import { backgroundListResponseFixture } from '../background.fixtures'

const meta = {
  title: 'Domains/Backgrounds/List',
  component: AuthoredListPage,
  parameters: {
    docs: {
      description: {
        component: 'Background list state coverage using the shared authored-domain list pattern and explicit provenance/permission DTOs.'
      }
    }
  },
  args: {
    title: 'Backgrounds',
    summary: summarizeBackgroundList(backgroundListResponseFixture),
    createLabel: 'Create Background',
    items: mapBackgroundListToAuthoredItems(backgroundListResponseFixture),
    filters: buildBackgroundListFilters(backgroundListResponseFixture),
    attributeColumns: backgroundListAttributeColumns,
    sortOptions: backgroundListSortOptions
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LockedMasterRows: Story = {
  args: {
    items: mapBackgroundListToAuthoredItems({
      ...backgroundListResponseFixture,
      items: backgroundListResponseFixture.items.filter((item) => item.provenance.kind === 'MASTER')
    })
  }
}

export const OwnedRows: Story = {
  args: {
    items: mapBackgroundListToAuthoredItems({
      ...backgroundListResponseFixture,
      items: backgroundListResponseFixture.items.filter((item) => item.provenance.kind === 'OWNED')
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
    error: 'The background list could not be loaded. Try again in a moment.'
  }
}
