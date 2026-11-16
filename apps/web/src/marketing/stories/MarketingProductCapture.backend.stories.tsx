import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useMatches } from '@tanstack/react-router'
import { Shell } from '#app/shell'
import { buildPlatformNavigation, contentKindOrder } from '#app/shell/navigation'
import { CharacterSheetPage } from '#domains/characters'
import {
  addsMulticlassHitDice,
  findSeededSheetCharacter,
  openSheetSection,
  rollsHitDice,
  sheetRouter,
  type StoryCharacter
} from '#domains/characters/sheet/stories/characterSheetBackendStory'
import { Route } from '#routes/_authed/characters/$characterPublicId/$characterSlug/index'
import { STORY_CHARACTERS } from '../../../../apis/tests/developmentReviewDataScenarios'

// The marketing product captures: the seeded story Characters' Sheets inside the app shell (D218,
// D221). The rest dialog's roll is a spied write.
const meta = {
  title: 'Guest/Marketing/Product captures',
  parameters: {
    layout: 'fullscreen',
    tanstack: { router: sheetRouter(STORY_CHARACTERS.caster) }
  },
  render: () => <CharacterSheetCapture />
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof Route>

/** The Sheet route inside the app shell, as the signed-in player sees it. */
function CharacterSheetCapture() {
  const currentPath = useMatches({ select: (matches) => matches.at(-1)?.pathname ?? '/' })
  return (
    <Shell
      navigation={buildPlatformNavigation(contentKindOrder)}
      currentPath={currentPath}
      isAuthenticated
      userEmail='player@example.test'
    >
      <CharacterSheetPage />
    </Shell>
  )
}

/** A capture of one Character's Sheet at the section the marketing page shows. */
const opensSection =
  (character: StoryCharacter, section: string): Story['play'] =>
  async ({ canvasElement }) => {
    await findSeededSheetCharacter(canvasElement, character)
    await openSheetSection(canvasElement, section, false)
  }

export const CharacterSheet: Story = {
  play: opensSection(STORY_CHARACTERS.caster, 'Spells')
}

export const CharacterSheetMulticlass: Story = {
  parameters: { tanstack: { router: sheetRouter(STORY_CHARACTERS.multiclass) } },
  play: opensSection(STORY_CHARACTERS.multiclass, 'Actions')
}

const shortRest: Story = {
  parameters: { tanstack: { router: sheetRouter(STORY_CHARACTERS.multiclass) } },
  play: async ({ canvasElement }) => {
    await addsMulticlassHitDice(canvasElement)
  }
}

export const CharacterSheetShortRest: Story = shortRest

export const CharacterSheetShortRestMobile: Story = {
  ...shortRest,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: { ...shortRest.parameters, viewport: { defaultViewport: 'mobile1' } }
}

export const CharacterSheetShortRestRolled: Story = {
  ...shortRest,
  play: async ({ canvasElement }) => {
    const dialog = await addsMulticlassHitDice(canvasElement)
    await rollsHitDice(dialog, '1d10 + 1d6 + 2', 'Short rest hit dice')
  }
}
