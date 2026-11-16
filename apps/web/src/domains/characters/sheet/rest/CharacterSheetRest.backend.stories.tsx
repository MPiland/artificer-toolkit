import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Route } from '#routes/_authed/characters/$characterPublicId/$characterSlug/index'
import { STORY_CHARACTERS } from '../../../../../../apis/tests/developmentReviewDataScenarios'
import {
  addsMulticlassHitDice,
  opensRestDialog,
  rollsHitDice,
  sheetRouter
} from '../stories/characterSheetBackendStory'

// Opens the rest dialogs of the story account's Characters. The rest preview is the real query on
// the seeded deployment; hit-die rolls and the rest itself are spied writes (D218). A spied roll is
// unknown to the server, so a rolled story ends at the roll write: the preview that would follow
// settles only rolls the server recorded.
const meta = {
  title: 'Domains/Characters/Character Sheet/Rest',
  parameters: {
    layout: 'fullscreen',
    tanstack: { router: sheetRouter(STORY_CHARACTERS.fighter) }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof Route>

const mobile = { viewport: { defaultViewport: 'mobile1' } }

const addsFighterHitDie = async (canvasElement: HTMLElement) => {
  const dialog = await opensRestDialog(canvasElement, STORY_CHARACTERS.fighter, 'Short Rest')
  await userEvent.click(await within(dialog).findByRole('button', { name: 'Add one d10 hit die' }))
  await waitFor(() =>
    expect(within(dialog).getByRole('button', { name: 'Roll 1d10 + 1' })).toBeVisible()
  )
  await waitFor(() =>
    expect(within(dialog).getByRole('button', { name: 'Take Short Rest' })).toBeVisible()
  )
  return dialog
}

const shortRestPreview: Story = {
  play: ({ canvasElement }) => addsFighterHitDie(canvasElement).then(() => undefined)
}

const shortRestMulticlassPreview: Story = {
  parameters: { tanstack: { router: sheetRouter(STORY_CHARACTERS.multiclass) } },
  play: ({ canvasElement }) => addsMulticlassHitDice(canvasElement).then(() => undefined)
}

// The caster has spent every spell slot, so a Long Rest has a recovery to apply; a Long Rest of the
// undamaged Fighter has none and the product keeps it disabled.
const longRestPreview: Story = {
  parameters: { tanstack: { router: sheetRouter(STORY_CHARACTERS.caster) } },
  play: async ({ canvasElement }) => {
    const dialog = await opensRestDialog(canvasElement, STORY_CHARACTERS.caster, 'Long Rest')
    const healingSummary = await within(dialog).findByText(/^Restores to (\d+) \/ \1$/)
    await waitFor(() => expect(healingSummary).toBeVisible())
    await waitFor(async () =>
      expect(await within(dialog).findByRole('button', { name: 'Take Long Rest' })).toBeEnabled()
    )
  }
}

export const ShortRestPreview: Story = shortRestPreview

export const ShortRestRolled: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await addsFighterHitDie(canvasElement)
    await rollsHitDice(dialog, '1d10 + 1', 'Short rest hit dice')
  }
}

export const ShortRestMulticlassPreview: Story = shortRestMulticlassPreview

export const ShortRestMulticlassRolled: Story = {
  ...shortRestMulticlassPreview,
  play: async ({ canvasElement }) => {
    const dialog = await addsMulticlassHitDice(canvasElement)
    await rollsHitDice(dialog, '1d10 + 1d6 + 2', 'Short rest hit dice')
  }
}

export const ShortRestPreviewMobile: Story = {
  ...shortRestPreview,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: mobile
}

export const ShortRestMulticlassPreviewMobile: Story = {
  ...shortRestMulticlassPreview,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: { ...shortRestMulticlassPreview.parameters, ...mobile }
}

export const LongRestPreview: Story = longRestPreview

export const LongRestPreviewMobile: Story = {
  ...longRestPreview,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: { ...longRestPreview.parameters, ...mobile }
}
