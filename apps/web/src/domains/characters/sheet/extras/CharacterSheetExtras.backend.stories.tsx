import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import { Route } from '#routes/_authed/characters/$characterPublicId/$characterSlug/index'
import { STORY_CHARACTERS } from '../../../../../../apis/tests/developmentReviewDataScenarios'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import {
  findSeededSheetCharacter,
  openSheetSection,
  sheetRouter
} from '../stories/characterSheetBackendStory'

// The seeded Fighter's Extras: a Companion named Ferdinand and a Sailing Ship (D218, D221). Writes are spies.
const meta = {
  title: 'Domains/Characters/Character Sheet/Extras',
  parameters: {
    layout: 'fullscreen',
    tanstack: { router: sheetRouter(STORY_CHARACTERS.fighter) }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof Route>
type Play = NonNullable<Story['play']>

/** Opens the seeded Fighter's Extras, then the Add Extra drawer once it has settled. */
async function openAddExtraDrawer({ canvas, canvasElement }: Parameters<Play>[0]) {
  const body = within(canvasElement.ownerDocument.body)
  await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.fighter)
  await openSheetSection(canvasElement, 'Extras', false)
  await userEvent.click(
    await canvas.findByRole('button', { name: /add extra/i }, { timeout: 15_000 })
  )
  const drawer = await body.findByRole('dialog', { name: 'Add Extra' })
  await waitFor(() => expect(getComputedStyle(drawer).opacity).toBe('1'))
  await waitFor(() => expect(drawer.getAnimations()).toHaveLength(0))
  return { body, canvas, drawer }
}

/** Fills the drawer's selects in order; the Creature and Origin options come from the seeded System. */
async function chooseCompanionOwl(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body)
  for (const [label, option] of [
    ['Kind', 'Companion'],
    ['Creature', 'Owl'],
    ['Origin', 'Summoned']
  ] as const) {
    const input = body
      .getAllByLabelText(label)
      .find((element) => element instanceof HTMLInputElement)
    if (!input) throw new Error(`${label} input is unavailable`)
    await userEvent.click(input)
    // The catalogue lists a page at a time, so the Creature is found by its name.
    if (label === 'Creature') await userEvent.type(input, option)
    await userEvent.click(await body.findByRole('option', { name: option }, { timeout: 15_000 }))
  }
}

export const Extras: Story = {
  play: async (context) => {
    const { body, canvas, drawer } = await openAddExtraDrawer(context)
    await chooseCompanionOwl(context.canvasElement)
    await userEvent.click(within(drawer).getByRole('button', { name: /^add extra$/i }))
    await waitFor(() =>
      expect(body.queryByRole('dialog', { name: 'Add Extra' })).not.toBeInTheDocument()
    )
    // The write is a spy, so the Sheet gains no row: the recorded command is the proof.
    const write = writesTo(api.characters.sheetCommands.execute).at(-1)
    await expect(write).toHaveProperty('id')
    await expect(write).toMatchObject({
      command: {
        type: 'ADD_SHEET_EXTRA',
        extra: { kind: 'COMPANION', originKind: 'SUMMONED' }
      }
    })

    const companionRow = await canvas.findByRole('button', {
      name: 'Open Ferdinand (Owl) details'
    })
    await userEvent.click(companionRow)
    const inspector = await body.findByRole('dialog', { name: 'Ferdinand' })
    await userEvent.click(
      within(inspector).getByRole('button', { name: 'Close character inspector' })
    )
    await waitFor(() => expect(inspector).not.toBeInTheDocument())
    await waitFor(() => expect(companionRow).toHaveFocus())
  }
}

export const ExtrasCommandError: Story = {
  play: async (context) => {
    storyMutation.mockRejectedValueOnce(new Error('The extra could not be added.'))
    const { body, drawer } = await openAddExtraDrawer(context)
    await chooseCompanionOwl(context.canvasElement)
    await userEvent.click(within(drawer).getByRole('button', { name: /^add extra$/i }))
    await expect(await within(drawer).findByRole('alert')).toHaveTextContent('Could not add extra')
    await expect(body.getByRole('dialog', { name: 'Add Extra' })).toBeVisible()
  }
}
