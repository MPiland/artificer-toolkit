import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Route } from '#routes/_authed/characters/$characterPublicId/$characterSlug/index'
import { STORY_CHARACTERS } from '../../../../../../apis/tests/developmentReviewDataScenarios'
import { findSeededSheetCharacter, sheetRouter } from '../stories/characterSheetBackendStory'

// The seeded Fighter's Sheet as the story account reads it (D218, D221). Writes are spies.
const meta = {
  title: 'Domains/Characters/Character Sheet/Status',
  parameters: {
    layout: 'fullscreen',
    tanstack: { router: sheetRouter(STORY_CHARACTERS.fighter) }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof Route>

export const StatusEditorDesktop: Story = {
  play: async ({ canvas, canvasElement }) => {
    await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.fighter)
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
    await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.fighter)
    await userEvent.click(canvas.getByRole('button', { name: 'Manage conditions and exhaustion' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Conditions & Exhaustion'
    })
    await waitFor(() => expect(within(dialog).getByText('Effects by level')).toBeVisible())
  }
}
