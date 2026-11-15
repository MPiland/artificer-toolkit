import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Route } from '#routes/_authed/characters/$characterPublicId/$characterSlug/index'
import { STORY_CHARACTERS } from '../../../../../../apis/tests/developmentReviewDataScenarios'
import {
  findSeededSheetCharacter,
  sheetRouter,
  type StoryCharacter
} from '../stories/characterSheetBackendStory'
import { characterSheetTabletViewports } from '../stories/characterSheetViewports'

// Reads the Sheets of the story account's Characters that `seedStoryData` builds through the
// Builder commit (D218, D221). Writes are spies.
const meta = {
  title: 'Domains/Characters/CharacterSheetView',
  parameters: {
    layout: 'fullscreen',
    tanstack: { router: sheetRouter(STORY_CHARACTERS.fighter) }
  }
} satisfies Meta<typeof Route>

export default meta

// Typed by the route (the meta sets no `component`), so a story can retarget its params.
type Story = StoryObj<typeof Route>

const opensCharacter = (character: StoryCharacter): Pick<Story, 'play'> => ({
  play: ({ canvasElement }) => findSeededSheetCharacter(canvasElement, character)
})

export const Desktop: Story = opensCharacter(STORY_CHARACTERS.fighter)

export const Mobile: Story = {
  ...opensCharacter(STORY_CHARACTERS.fighter),
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: { viewport: { defaultViewport: 'mobile1' } }
}

export const TabletPortrait: Story = {
  ...opensCharacter(STORY_CHARACTERS.fighter),
  globals: { viewport: { value: 'characterSheetTabletPortrait', isRotated: false } },
  parameters: { viewport: { options: characterSheetTabletViewports } }
}

export const TabletLandscape: Story = {
  ...opensCharacter(STORY_CHARACTERS.fighter),
  globals: { viewport: { value: 'characterSheetTabletLandscape', isRotated: false } },
  parameters: { viewport: { options: characterSheetTabletViewports } }
}

export const DraftPending: Story = {
  ...opensCharacter(STORY_CHARACTERS.draftPending),
  parameters: { tanstack: { router: sheetRouter(STORY_CHARACTERS.draftPending) } }
}

export const AbilityModifierStates: Story = opensCharacter(STORY_CHARACTERS.fighter)
