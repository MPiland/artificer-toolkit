import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  featListAttributeColumns,
  featListSortOptions,
  buildFeatListFilters,
  mapFeatListToAuthoredItems,
  summarizeFeatList
} from '#app/data/feats/featListMapper'
import { featListResponseFixture } from '../feat.fixtures'

const meta = {
  title: 'Domains/Feats/List',
  component: AuthoredListPage,
  parameters: {
    docs: {
      description: {
        component: 'Feat list state coverage using the shared authored-domain list pattern and explicit provenance/permission DTOs.'
      }
    }
  },
  args: {
    title: 'Feats',
    summary: summarizeFeatList(featListResponseFixture),
    createLabel: 'Create Feat',
    items: mapFeatListToAuthoredItems(featListResponseFixture),
    filters: buildFeatListFilters(featListResponseFixture),
    attributeColumns: featListAttributeColumns,
    sortOptions: featListSortOptions
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LockedMasterRows: Story = {
  args: {
    items: mapFeatListToAuthoredItems({
      ...featListResponseFixture,
      items: featListResponseFixture.items.filter((item) => item.provenance.kind === 'MASTER')
    })
  }
}

export const OwnedRows: Story = {
  args: {
    items: mapFeatListToAuthoredItems({
      ...featListResponseFixture,
      items: featListResponseFixture.items.filter((item) => item.provenance.kind === 'OWNED')
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
    error: 'The feat list could not be loaded. Try again in a moment.'
  }
}
