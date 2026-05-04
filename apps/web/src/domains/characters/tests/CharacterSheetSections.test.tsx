import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { CharacterSheetResponseDto } from '#app/lib/api'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetInventory } from '../components/sheet/CharacterSheetInventory'
import { CharacterSheetOverview } from '../components/sheet/CharacterSheetOverview'

function createSheet(): CharacterSheetResponseDto {
  return {
    meta: {
      characterId: 'character-1',
      systemId: 'system-1',
      status: 'ACTIVE',
      streamVersion: 4
    },
    identity: {
      label: 'Aria',
      classSummary: 'Fighter 1',
      totalLevel: 1
    },
    overview: {
      abilities: [{ ability: 'DEXTERITY', score: 14, modifier: 2 }],
      facts: [],
      armorClass: 12,
      initiative: 2,
      proficiencyBonus: 2,
      currentHitPoints: 10,
      maxHitPoints: 12,
      tempHitPoints: 3,
      maxHitPointsOverride: null,
      exhaustionLevel: 0,
      conditions: [],
      hitDice: []
    },
    actions: { items: [] },
    resources: {
      items: [],
      hitDice: []
    },
    spells: {
      saveDc: null,
      attackBonus: null,
      slots: [],
      spells: []
    },
    inventory: {
      items: [
        {
          id: 'item-1',
          equipmentId: 'equipment-1',
          label: 'Longsword',
          quantity: 1,
          equipped: false,
          attuned: false
        }
      ],
      currencies: []
    },
    reference: {
      features: [],
      proficiencies: [],
      defenses: [],
      senses: [],
      conditionOptions: [{ id: 'condition-1', label: 'Poisoned' }],
      equipmentOptions: [{ id: 'equipment-1', label: 'Longsword' }],
      currencyOptions: [{ id: 'currency-1', label: 'Gold' }]
    },
    notes: {}
  }
}

describe('Character Sheet sections', () => {
  it('sends sheet commands with the current stream version', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverview
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /apply damage/i }))

    expect(submitCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ADJUST_HIT_POINTS',
      expectedVersion: 4
    }))
  })

  it('allows currency updates even when the character has no current currency rows', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetInventory
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /apply currency/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADJUST_CURRENCY',
      currencyId: 'currency-1',
      amount: 1,
      expectedVersion: 4
    })
  })

  it('resyncs HP setting inputs when refreshed sheet data changes', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const refreshedSheet = createSheet()
    refreshedSheet.meta.streamVersion = 5
    refreshedSheet.overview.tempHitPoints = 1
    refreshedSheet.overview.maxHitPoints = 18
    refreshedSheet.overview.maxHitPointsOverride = 18

    const { rerender } = renderWithAppProviders(
      <CharacterSheetOverview
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.clear(screen.getByLabelText(/temp hp/i))
    await user.type(screen.getByLabelText(/temp hp/i), '9')

    rerender(
      <CharacterSheetOverview
        pending={false}
        sheet={refreshedSheet}
        submitCommand={submitCommand}
      />
    )

    await waitFor(() => expect(screen.getByLabelText(/temp hp/i)).toHaveValue('1'))
    await user.click(screen.getByRole('button', { name: /save hp settings/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_HIT_POINTS',
      temp: 1,
      maxOverride: 18,
      expectedVersion: 5
    })
  })
})
