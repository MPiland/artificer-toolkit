import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { characterSheetFixture } from '#domains/characters/character.fixtures'
import { CharacterSheetView } from '#domains/characters/components/sheet/CharacterSheetView'
import { Shell, platformNavigation } from '#app/shell'

const meta = {
  title: 'Guest/Marketing/Product captures',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const CharacterSheet: Story = {
  render: () => (
    <Shell
      navigation={platformNavigation}
      currentPath='/characters/astra-vale/astra-vale'
      isAuthenticated
      userEmail='player@example.test'
    >
      <CharacterSheetView
        characterPublicId={
          characterSheetFixture.publicId ?? characterSheetFixture.meta.characterId
        }
        hasDraft={false}
        initialTab='spells'
        sheet={characterSheetFixture}
      />
    </Shell>
  )
}
