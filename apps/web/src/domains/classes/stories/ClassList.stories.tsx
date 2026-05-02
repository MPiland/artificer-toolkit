import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildClassListFilters,
  classListAttributeColumns,
  classListSortOptions,
  mapClassListToAuthoredItems,
  summarizeClassList
} from '#app/data/classes/classListMapper'
import { classListFixture } from '../class.fixtures'

const meta = {
  title: 'Domains/Classes/List',
  component: AuthoredListPage,
  parameters: {
    docs: {
      description: {
        component: 'Class list state coverage using the shared authored-domain list pattern, category filters, draft rows, and locked-master permissions.'
      }
    }
  },
  args: {
    title: 'Classes',
    summary: summarizeClassList(classListFixture),
    createLabel: 'Create Class',
    items: mapClassListToAuthoredItems(classListFixture),
    filters: buildClassListFilters(classListFixture),
    attributeColumns: classListAttributeColumns,
    sortOptions: classListSortOptions
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LockedMasterRows: Story = {
  args: {
    items: mapClassListToAuthoredItems({
      ...classListFixture,
      items: classListFixture.items.filter((item) => item.provenance.kind === 'MASTER')
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
    error: 'The class list could not be loaded. Try again in a moment.'
  }
}
