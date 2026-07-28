import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { characterSheetMulticlassFixture } from '../fixtures/characterRest.fixtures'
import { CharacterSheetView } from '../core/CharacterSheetView'
import {
  characterSheetStoryMeta,
  restPreviewHandler
} from '../fixtures/characterSheetStory.fixture'

const meta = {
  ...characterSheetStoryMeta,
  title: 'Domains/Characters/Character Sheet/Rest'
} satisfies Meta<typeof CharacterSheetView>

export default meta

type Story = StoryObj<typeof meta>

export const ShortRestPreview: Story = {
  args: {
    initialTab: 'actions',
    sheet: characterSheetMulticlassFixture
  },
  parameters: {
    msw: { handlers: [restPreviewHandler()] }
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Short Rest' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Add one d10 hit die' })
    )
    const addD8 = within(dialog).getByRole('button', { name: 'Add one d8 hit die' })
    await waitFor(() => expect(addD8).toBeEnabled())
    await userEvent.click(addD8)
    await expect(within(dialog).getByRole('button', { name: 'Roll 1d10 + 1d8 + 4' })).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: 'Take Short Rest' })).toBeVisible()
  }
}

export const ShortRestRolled: Story = {
  ...ShortRestPreview,
  play: async (context) => {
    await ShortRestPreview.play?.(context)
    const dialog = await within(context.canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Roll 1d10 + 1d8 + 4' }))
    await expect(await within(dialog).findByText('15 rolled')).toBeVisible()
    await expect(within(dialog).getByText('6 HP staged')).toBeVisible()
  }
}

export const ShortRestPreviewMobile: Story = {
  ...ShortRestPreview,
  parameters: {
    ...ShortRestPreview.parameters,
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

export const LongRestPreview: Story = {
  args: {
    initialTab: 'actions',
    sheet: characterSheetMulticlassFixture
  },
  parameters: {
    msw: { handlers: [restPreviewHandler()] }
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Long Rest' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Long Rest'
    })
    const healingSummary = await within(dialog).findByText('Restores to 26 / 26')
    await waitFor(() => expect(healingSummary).toBeVisible())
    await expect(
      await within(dialog).findByRole('button', { name: 'Take Long Rest' })
    ).toBeEnabled()
  }
}

export const LongRestPreviewMobile: Story = {
  ...LongRestPreview,
  parameters: {
    ...LongRestPreview.parameters,
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}
