import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, within } from 'storybook/test'
import { astralTearCharacterSheetFixture } from '../fixtures/astralTearSheet.fixtures'
import { CharacterSheetFixtureView as CharacterSheetView } from '../fixtures/CharacterSheetFixtureView'
import { astralTearItemPanelFixture } from './inspector.fixtures'
import { characterSheetStoryMeta, withSheetPanel } from '../fixtures/characterSheetStory.fixture'
import { expectInspectorReady } from '../stories/characterSheetBackendStory'

const meta = {
  ...characterSheetStoryMeta,
  title: 'Domains/Characters/Character Sheet/Inspector'
} satisfies Meta<typeof CharacterSheetView>

export default meta

type Story = StoryObj<typeof meta>

export const AstralTearItemInspector: Story = {
  args: {
    initialTab: 'inventory',
    sheet: astralTearCharacterSheetFixture
  },
  decorators: [withSheetPanel(astralTearItemPanelFixture)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'Open The Astral Tear Awakened details'
      })
    )
    await expectInspectorReady(canvasElement, 'The Astral Tear Awakened', 'Owned item')
    const inspector = within(canvasElement.ownerDocument.body).getByRole('dialog', {
      name: 'The Astral Tear Awakened'
    })
    await expect(within(inspector).getByText('2 / 3')).toBeVisible()
    await expect(within(inspector).getByText('Resets: Dawn')).toBeVisible()
    await expect(within(inspector).getByText('Warping Strike')).toBeVisible()
    await expect(within(inspector).getByText('Spells')).toBeVisible()
    await expect(
      within(inspector).getByRole('button', { name: 'Use Warping Strike' })
    ).toBeVisible()
    await expect(within(inspector).getByRole('button', { name: 'Use Spells' })).toBeVisible()
  }
}
