import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthoredListPage } from './AuthoredListPage'
import { spellListFilters, spellListItems } from './spellList.fixtures'

const meta = {
  title: 'Platform/Authored List/AuthoredListPage',
  component: AuthoredListPage,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Canonical authored-domain list pattern for non-character content indexes. Table view supports dense scanning; card view supports browsing and mobile readability. Master records are view/copy only, while owned records can edit, duplicate, and delete.'
      }
    }
  },
  args: {
    title: 'Spells',
    summary: '312 spells / 312 SRD / 0 homebrew',
    createLabel: 'Create Spell',
    items: spellListItems,
    filters: spellListFilters
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CardView: Story = {
  args: {
    initialViewMode: 'cards'
  }
}

export const Mobile: Story = {
  args: {
    initialViewMode: 'cards'
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

export const LockedMasterRows: Story = {
  args: {
    items: spellListItems.filter((item) => item.sourceKind === 'master')
  }
}

export const OwnedRows: Story = {
  args: {
    items: spellListItems.filter((item) => item.sourceKind === 'owned')
  }
}

export const Loading: Story = {
  args: {
    loading: true
  }
}

export const Empty: Story = {
  args: {
    items: []
  }
}

export const Error: Story = {
  args: {
    error: 'The spell list could not be loaded. Try again in a moment.'
  }
}
