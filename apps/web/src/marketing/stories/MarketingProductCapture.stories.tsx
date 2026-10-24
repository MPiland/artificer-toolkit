import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { characterSheetMulticlassFixture } from '#domains/characters/sheet/fixtures/characterRest.fixtures'
import { createMulticlassSheet } from '#domains/characters/sheet/fixtures/playedCharacters.fixture'
import { characterSheetFixture } from '#domains/characters/sheet/fixtures/characterSheet.fixtures'
import type { CharacterSheetTabId } from '#domains/characters/sheet/core/CharacterSheet.types'
import { CharacterSheetFixtureView as CharacterSheetView } from '#domains/characters/sheet/fixtures/CharacterSheetFixtureView'
import { mockMulticlassHitDieRoll } from '#domains/characters/sheet/fixtures/characterSheetStory.fixture'
import { mockSheetRestPreview } from '#domains/characters/sheet/fixtures/characterSheetNativeStory.fixture'
import { Shell, buildPlatformNavigation, contentKindOrder } from '#app/shell'

const meta = {
  title: 'Guest/Marketing/Product captures',
  parameters: {
    layout: 'fullscreen'
  },
  beforeEach: mockSheetRestPreview
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function CharacterSheetCapture({
  sheet = characterSheetFixture,
  initialTab = 'spells'
}: {
  sheet?: CharacterSheetResponseDto
  initialTab?: CharacterSheetTabId
}) {
  return (
    <Shell
      navigation={buildPlatformNavigation(contentKindOrder)}
      currentPath={`/characters/${sheet.publicId ?? sheet.meta.characterId}`}
      isAuthenticated
      userEmail='player@example.test'
    >
      <CharacterSheetView
        characterPublicId={sheet.publicId ?? sheet.meta.characterId}
        hasDraft={false}
        initialTab={initialTab}
        sheet={sheet}
      />
    </Shell>
  )
}

async function openShortRest(canvasElement: HTMLElement) {
  const page = within(canvasElement.ownerDocument.body)
  await userEvent.click(page.getByRole('button', { name: 'Short Rest' }))
  const dialog = await page.findByRole('dialog', { name: 'Short Rest' })
  await expect(await within(dialog).findByText('No hit dice selected')).toBeInTheDocument()
  await expect(
    within(dialog).getByLabelText('Remove the current Max HP adjustment')
  ).toBeInTheDocument()
  await expect(within(dialog).getByRole('button', { name: 'Take Short Rest' })).toBeInTheDocument()
  return dialog
}

export const CharacterSheet: Story = {
  render: () => <CharacterSheetCapture />
}

export const CharacterSheetMulticlass: Story = {
  render: () => (
    <CharacterSheetCapture initialTab='actions' sheet={characterSheetMulticlassFixture} />
  )
}

export const CharacterSheetShortRest: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openShortRest(canvasElement)
    const addD10 = within(dialog).getByRole('button', { name: 'Add one d10 hit die' })
    await userEvent.click(addD10)
    const addD8 = within(dialog).getByRole('button', { name: 'Add one d8 hit die' })
    await waitFor(() => expect(addD8).toBeEnabled())
    await userEvent.click(addD8)
    await expect(
      await within(dialog).findByRole('button', { name: 'Roll 1d10 + 1d8 + 2' })
    ).toBeVisible()
  },
  render: () => <CharacterSheetCapture initialTab='actions' sheet={createMulticlassSheet()} />
}

export const CharacterSheetShortRestMobile: Story = {
  ...CharacterSheetShortRest,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

export const CharacterSheetShortRestRolled: Story = {
  ...CharacterSheetShortRest,
  beforeEach: mockMulticlassHitDieRoll,
  play: async (context) => {
    await CharacterSheetShortRest.play?.(context)
    const dialog = await within(context.canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Roll 1d10 + 1d8 + 2' }))
    await expect(
      await within(dialog).findByText('13 rolled', {}, { timeout: 20_000 })
    ).toBeVisible()
    await expect(within(dialog).getByText('12 HP selected')).toBeVisible()
  }
}
