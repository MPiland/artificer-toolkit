import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { CharacterSheetView } from '../core/CharacterSheetView'
import { characterSheetStoryMeta } from '../fixtures/characterSheetStory.fixture'

const meta = {
  ...characterSheetStoryMeta,
  title: 'Domains/Characters/Character Sheet/Status'
} satisfies Meta<typeof CharacterSheetView>

export default meta

type Story = StoryObj<typeof meta>

export const StatusEditorDesktop: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /poisoned/i }))
    await waitFor(() => expect(canvas.getByText('Effects by level')).toBeVisible())
  }
}

export const StatusEditorMobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Manage conditions and exhaustion' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Conditions & Exhaustion'
    })
    await waitFor(() => expect(within(dialog).getByText('Effects by level')).toBeVisible())
  }
}
