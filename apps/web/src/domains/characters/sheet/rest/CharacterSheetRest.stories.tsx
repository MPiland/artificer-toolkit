import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { createMulticlassSheet, createSheet } from '../fixtures/playedCharacters.fixture'
import { CharacterSheetFixtureView as CharacterSheetView } from '../fixtures/CharacterSheetFixtureView'
import {
  characterSheetStoryMeta,
  mockHitDieRoll,
  mockMulticlassHitDieRoll
} from '../fixtures/characterSheetStory.fixture'
import { mockSheetRestPreview } from '../fixtures/characterSheetNativeStory.fixture'

const meta = {
  ...characterSheetStoryMeta,
  title: 'Domains/Characters/Character Sheet/Rest',
  beforeEach: mockSheetRestPreview
} satisfies Meta<typeof CharacterSheetView>

export default meta

type Story = StoryObj<typeof meta>

export const ShortRestPreview: Story = {
  args: {
    initialTab: 'actions',
    sheet: createSheet()
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Short Rest' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Add one d10 hit die' })
    )
    await expect(await within(dialog).findByRole('button', { name: 'Roll 1d10 + 1' })).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: 'Take Short Rest' })).toBeVisible()
  }
}

export const ShortRestRolled: Story = {
  ...ShortRestPreview,
  beforeEach: mockHitDieRoll,
  play: async (context) => {
    await ShortRestPreview.play?.(context)
    const dialog = await within(context.canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Roll 1d10 + 1' }))
    await expect(await within(dialog).findByText('6 rolled', {}, { timeout: 20_000 })).toBeVisible()
    await expect(within(dialog).getByText('1 HP selected')).toBeVisible()
  }
}

export const ShortRestMulticlassPreview: Story = {
  args: {
    initialTab: 'actions',
    sheet: createMulticlassSheet()
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Short Rest' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await expect(
      await within(dialog).findByLabelText('Remove the current Max HP adjustment')
    ).toBeInTheDocument()
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Add one d10 hit die' })
    )
    const addD8 = within(dialog).getByRole('button', { name: 'Add one d8 hit die' })
    await waitFor(() => expect(addD8).toBeEnabled())
    await userEvent.click(addD8)
    await expect(
      await within(dialog).findByRole('button', { name: 'Roll 1d10 + 1d8 + 2' })
    ).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: 'Take Short Rest' })).toBeVisible()
  }
}

export const ShortRestMulticlassRolled: Story = {
  ...ShortRestMulticlassPreview,
  beforeEach: mockMulticlassHitDieRoll,
  play: async (context) => {
    await ShortRestMulticlassPreview.play?.(context)
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

export const ShortRestPreviewMobile: Story = {
  ...ShortRestPreview,
  parameters: {
    ...ShortRestPreview.parameters,
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

export const ShortRestMulticlassPreviewMobile: Story = {
  ...ShortRestMulticlassPreview,
  parameters: {
    ...ShortRestMulticlassPreview.parameters,
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

export const LongRestPreview: Story = {
  args: {
    initialTab: 'actions',
    sheet: createSheet()
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Long Rest' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Long Rest'
    })
    const healingSummary = await within(dialog).findByText('Restores to 11 / 11')
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
