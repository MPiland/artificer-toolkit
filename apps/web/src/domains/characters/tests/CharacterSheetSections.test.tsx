import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { CharacterSheetResponseDto } from '#app/lib/api'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetInventory } from '../components/sheet/CharacterSheetInventory'
import { CharacterSheetHistoryList } from '../components/sheet/CharacterSheetHistory'
import { CharacterSheetNotes } from '../components/sheet/CharacterSheetNotes'
import { CharacterSheetOverview } from '../components/sheet/CharacterSheetOverview'
import { CharacterSheetResources } from '../components/sheet/CharacterSheetResources'
import { CharacterSheetSpells } from '../components/sheet/CharacterSheetSpells'

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

  it('adds conditions with notes from the overview panel', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverview
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByPlaceholderText(/add condition/i))
    await user.click(await screen.findByText(/poisoned/i))
    await user.type(screen.getByLabelText(/condition notes/i), 'Spider venom')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADD_CONDITION',
      conditionTypeId: 'condition-1',
      notes: 'Spider venom',
      expectedVersion: 4
    })
  })

  it('saves exhaustion notes through the overview panel', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.overview.exhaustionLevel = 1

    renderWithAppProviders(
      <CharacterSheetOverview
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.type(screen.getByLabelText(/exhaustion notes/i), 'Forced march through the swamp')
    await user.click(screen.getByRole('button', { name: /save exhaustion notes/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_EXHAUSTION',
      level: 1,
      notes: 'Forced march through the swamp',
      expectedVersion: 4
    })
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

  it('updates inventory quantity through sheet commands', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetInventory
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /increase longsword quantity/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPDATE_INVENTORY_ITEM',
      itemId: 'item-1',
      quantity: 2,
      expectedVersion: 4
    })
  })

  it('updates inventory custom labels and notes through sheet commands', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetInventory
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /details/i }))
    await user.type(screen.getByLabelText(/custom name/i), 'Moonlit Blade')
    await user.type(screen.getByLabelText(/item notes/i), 'Loaned by the captain')
    await user.click(screen.getByRole('button', { name: /save details/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPDATE_INVENTORY_ITEM',
      itemId: 'item-1',
      customName: 'Moonlit Blade',
      notes: 'Loaned by the captain',
      expectedVersion: 4
    })
  })

  it('restores resources and applies rests from the resources panel', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.resources.items = [
      {
        id: 'resource-1',
        label: 'Second Wind',
        sourceLabel: 'Fighter',
        used: 2,
        max: 3,
        remaining: 1,
        recovery: 'SHORT_REST'
      }
    ]

    renderWithAppProviders(
      <CharacterSheetResources
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /restore 1/i }))
    await user.click(screen.getByRole('button', { name: /long rest/i }))

    expect(submitCommand).toHaveBeenNthCalledWith(1, {
      type: 'RESTORE_RESOURCE',
      resourceGrantId: 'resource-1',
      expectedVersion: 4
    })
    expect(submitCommand).toHaveBeenNthCalledWith(2, {
      type: 'APPLY_REST',
      restKind: 'LONG',
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

  it('does not pin calculated max HP when saving settings without an override', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverview
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.clear(screen.getByLabelText(/temp hp/i))
    await user.type(screen.getByLabelText(/temp hp/i), '5')
    await user.click(screen.getByRole('button', { name: /save hp settings/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_HIT_POINTS',
      temp: 5,
      maxOverride: null,
      expectedVersion: 4
    })
  })

  it('prepares spells through the class-scoped sheet command', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.spells.preparationSources = [
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellIds: ['hidden-spell', 'spell-2']
      }
    ]
    sheet.spells.spells = [
      {
        id: 'spell-1',
        label: 'Shield',
        level: 1,
        prepared: false,
        known: true,
        sourceLabel: 'Wizard',
        sources: [{ classId: 'wizard', label: 'Wizard', prepared: false }]
      },
      {
        id: 'spell-2',
        label: 'Mage Armor',
        level: 1,
        prepared: true,
        known: true,
        sourceLabel: 'Wizard',
        sources: [{ classId: 'wizard', label: 'Wizard', prepared: true }]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /prepare shield for wizard/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_PREPARED_SPELLS',
      classId: 'wizard',
      spellIds: ['hidden-spell', 'spell-2', 'spell-1'],
      expectedVersion: 4
    })
  })

  it('restores a single spell slot without clearing the full slot pool', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.spells.slots = [
      {
        slotKey: 'STANDARD:1',
        label: 'Level 1',
        level: 1,
        used: 2,
        max: 3,
        remaining: 1
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /restore 1/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'RESTORE_SPELL_SLOT',
      slotKey: 'STANDARD:1',
      expectedVersion: 4
    })
  })

  it('resyncs session notes when refreshed sheet data changes', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.notes.notes = '<p>Old notes</p>'
    const refreshedSheet = createSheet()
    refreshedSheet.meta.streamVersion = 5
    refreshedSheet.notes.notes = '<p>Updated notes</p>'

    const { rerender } = renderWithAppProviders(
      <CharacterSheetNotes
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    rerender(
      <CharacterSheetNotes
        pending={false}
        sheet={refreshedSheet}
        submitCommand={submitCommand}
      />
    )

    await screen.findByText(/updated notes/i)
    await user.click(screen.getByRole('button', { name: /save notes/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPDATE_NOTES',
      notes: '<p>Updated notes</p>',
      expectedVersion: 5
    })
  })

  it('renders sheet command history entries without needing the builder', () => {
    renderWithAppProviders(
      <CharacterSheetHistoryList
        entries={[
          {
            eventId: 'event-1',
            occurredAt: '2026-05-05T14:15:00.000Z',
            actorId: 'user-1',
            eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
            summary: '3 damage applied'
          }
        ]}
      />
    )

    expect(screen.getByText(/3 damage applied/i)).toBeInTheDocument()
    expect(screen.getByText(/character sheet command applied/i)).toBeInTheDocument()
  })
})
