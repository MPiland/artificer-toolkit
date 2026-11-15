import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { astralTearCharacterSheetFixture } from '../fixtures/astralTearSheet.fixtures'
import { CharacterSheetFixtureView as CharacterSheetView } from '../fixtures/CharacterSheetFixtureView'
import { characterSheetStoryMeta } from '../fixtures/characterSheetStory.fixture'

const meta = {
  ...characterSheetStoryMeta,
  title: 'Domains/Characters/CharacterSheetView'
} satisfies Meta<typeof CharacterSheetView>

export default meta

type Story = StoryObj<typeof meta>

export const AstralTearInventory: Story = {
  args: {
    initialTab: 'inventory',
    sheet: astralTearCharacterSheetFixture
  }
}

export const AstralTearFeatures: Story = {
  args: {
    initialTab: 'reference',
    sheet: astralTearCharacterSheetFixture
  }
}
