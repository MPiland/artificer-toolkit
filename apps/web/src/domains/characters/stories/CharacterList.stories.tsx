import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildCharacterListFilters,
  characterListAttributeColumns,
  characterListSortOptions,
  mapCharacterListToAuthoredItems,
  summarizeCharacterList
} from '#app/data/characters'
import { characterListFixture } from '../character.fixtures'

const meta = {
  title: 'Domains/Characters/List',
  component: AuthoredListPage,
  parameters: {
    docs: {
      description: {
        component: 'Character list state coverage for active characters, draft-only builder work, and the shared authored list shell.'
      }
    }
  },
  args: {
    title: 'Characters',
    summary: summarizeCharacterList(characterListFixture),
    createLabel: 'Create Character',
    items: mapCharacterListToAuthoredItems(characterListFixture),
    filters: buildCharacterListFilters(characterListFixture),
    attributeColumns: characterListAttributeColumns,
    sortOptions: characterListSortOptions
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const DraftOnly: Story = {
  args: {
    items: mapCharacterListToAuthoredItems({
      ...characterListFixture,
      items: characterListFixture.items.filter((item) => item.id === 'character-draft')
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
    error: 'The character list could not be loaded. Try again in a moment.'
  }
}
