import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { characterSheetFixture } from '../fixtures/characterSheet.fixtures'
import { CharacterSheetFixtureView as CharacterSheetView } from '../fixtures/CharacterSheetFixtureView'
import {
  characterSheetStoryMeta,
  mockExtraCommands,
  withExtrasPanels
} from '../fixtures/characterSheetStory.fixture'

const meta = {
  ...characterSheetStoryMeta,
  title: 'Domains/Characters/Character Sheet/Extras'
} satisfies Meta<typeof CharacterSheetView>

export default meta

type Story = StoryObj<typeof meta>

export const Extras: Story = {
  beforeEach: () => mockExtraCommands(),
  decorators: [withExtrasPanels],
  args: {
    initialTab: 'extras',
    sheet: {
      ...characterSheetFixture,
      extras: {
        kindOptions: [
          { code: 'COMPANION', label: 'Companion' },
          { code: 'MOUNT', label: 'Mount' },
          { code: 'OWNED', label: 'Owned creature' },
          { code: 'VEHICLE', label: 'Vehicle' }
        ],
        originOptions: [
          { code: 'WORLD', label: 'World' },
          { code: 'SUMMONED', label: 'Summoned' }
        ],
        items: [
          {
            id: '00000000-0000-4000-8000-000000000501',
            kind: 'COMPANION',
            kindLabel: 'Companion',
            creatureId: '00000000-0000-4000-8000-000000000502',
            relationshipKind: 'COMPANION',
            relationshipLabel: 'Companion',
            originKind: 'SUMMONED',
            originLabel: 'Summoned',
            authoredName: 'Owl',
            displayName: 'Ferdinand',
            customName: 'Ferdinand',
            isActive: true,
            armorClass: 11,
            speedLabel: 'Flying 60 feet',
            hitPoints: { current: 1, temp: 0, maximum: 1 },
            hitDice: [],
            actions: [],
            features: [],
            equipmentItemIds: []
          },
          {
            id: '00000000-0000-4000-8000-000000000503',
            kind: 'VEHICLE',
            kindLabel: 'Vehicle',
            vehicleId: '00000000-0000-4000-8000-000000000504',
            authoredName: 'Sailing Ship',
            displayName: 'Sailing Ship',
            categoryLabel: 'Water vehicle',
            isActive: true,
            speedLabel: '4 mph',
            crewLabel: '20 crew',
            passengerCapacity: 20,
            cargoCapacityLabel: '100 tons',
            hitPoints: { current: 300, maximum: 300 },
            actions: [],
            features: [],
            equipmentItemIds: []
          }
        ]
      }
    }
  },
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await canvas.findByRole('button', { name: /add extra/i }, { timeout: 5_000 })
    )
    const drawer = await body.findByRole('dialog', { name: 'Add Extra' })
    await waitFor(() => expect(getComputedStyle(drawer).opacity).toBe('1'))
    await waitFor(() => expect(drawer.getAnimations()).toHaveLength(0))
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
      await userEvent.click(await body.findByRole('option', { name: option }, { timeout: 5_000 }))
    }
    await userEvent.click(within(drawer).getByRole('button', { name: /^add extra$/i }))
    await waitFor(() =>
      expect(body.queryByRole('dialog', { name: 'Add Extra' })).not.toBeInTheDocument()
    )

    const companionRow = canvas.getByRole('button', {
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
  beforeEach: () => mockExtraCommands(true),
  decorators: [withExtrasPanels],
  args: Extras.args
}
