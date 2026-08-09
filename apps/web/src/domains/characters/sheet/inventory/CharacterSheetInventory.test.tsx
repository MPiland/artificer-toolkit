import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createSheet, openEquipmentManager, showCarriedEquipment } from '../tests/sheetTestHarness'
import { CharacterSheetInventory } from './CharacterSheetInventory'

describe('Character Sheet inventory', () => {
  it('groups personal and party inventory into collapsible sections', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <CharacterSheetInventory
        partyInventory={<div>Shared supplies</div>}
        pending={false}
        sheet={createSheet()}
        submitCommand={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /^my inventory$/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByRole('button', { name: /^party inventory$/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.queryByRole('tab', { name: /^party$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^party inventory$/i }))
    expect(screen.getByText('Shared supplies')).toBeInTheDocument()
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

    await openEquipmentManager(user)
    await user.click(screen.getByRole('button', { name: /apply currency/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADJUST_CURRENCY',
      currencyId: 'currency-1',
      amount: 1,
      expectedVersion: 4
    })
  })

  it('locks inventory inputs while a sheet command is pending', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CharacterSheetInventory pending sheet={createSheet()} submitCommand={vi.fn()} />
    )

    await openEquipmentManager(user)
    expect(screen.getByRole('combobox', { name: /^equipment$/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^quantity$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: /^currency type$/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^amount$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /apply currency/i })).toBeDisabled()
  })

  it('opens owned-item details from the carried row without a separate details control', async () => {
    const user = userEvent.setup()
    const openPanel = vi.fn()

    renderWithAppProviders(
      <CharacterSheetInventory
        openPanel={openPanel}
        pending={false}
        sheet={createSheet()}
        submitCommand={vi.fn()}
      />
    )

    await showCarriedEquipment(user)
    await user.click(screen.getByRole('button', { name: /open longsword details/i }))

    expect(openPanel).toHaveBeenCalledWith({
      kind: 'ITEM',
      itemInstanceId: 'item-1'
    })
    expect(screen.queryByRole('button', { name: /^details$/i })).not.toBeInTheDocument()
  })

  it('adds inventory items through sheet commands', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'scrollIntoView'
    )
    Element.prototype.scrollIntoView = vi.fn()

    try {
      renderWithAppProviders(
        <CharacterSheetInventory
          pending={false}
          sheet={createSheet()}
          submitCommand={submitCommand}
        />
      )

      await openEquipmentManager(user)
      await user.click(screen.getByRole('combobox', { name: /^equipment$/i }))
      await user.keyboard('{ArrowDown}{Enter}')
      await user.click(screen.getByRole('button', { name: /add item/i }))
    } finally {
      if (scrollIntoViewDescriptor) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
      } else {
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
      }
    }

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: 'equipment-1',
      quantity: 1,
      expectedVersion: 4
    })
  })

  it('renders inventory item reference details from equipment records', async () => {
    const user = userEvent.setup()
    const openPanel = vi.fn()
    const sheet = createSheet()
    sheet.inventory.items = [
      {
        id: 'item-1',
        equipmentId: 'equipment-1',
        label: 'Moonlit Blade',
        equipmentLabel: 'Longsword',
        description: '<p>A balanced knightly blade.</p>',
        category: 'WEAPON',
        properties: [
          { code: 'MARTIAL', label: 'Martial' },
          { code: 'ONE_HANDED', label: 'One-Handed' }
        ],
        cost: { amount: 15, currencyId: 'gp' },
        costLabel: 'Gold',
        weight: { amount: 3, unit: 'POUNDS' },
        customName: 'Moonlit Blade',
        quantity: 1,
        equipped: true,
        attuned: false,
        requiresAttunement: false
      }
    ]

    renderWithAppProviders(
      <CharacterSheetInventory
        openPanel={openPanel}
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn()}
      />
    )

    await showCarriedEquipment(user)
    const row = screen.getByRole('button', { name: /open moonlit blade details/i })
    expect(within(row).getByText(/moonlit blade/i)).toBeInTheDocument()
    expect(within(row).getByText(/longsword/i)).toBeInTheDocument()
    expect(within(row).getByText(/3 pounds/i)).toBeInTheDocument()
    expect(within(row).getByText(/equipped/i)).toBeInTheDocument()
    expect(screen.queryByText(/properties:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/martial, one-handed/i)).not.toBeInTheDocument()

    await user.click(row)
    expect(openPanel).toHaveBeenCalledWith({ kind: 'ITEM', itemInstanceId: 'item-1' })
    expect(screen.queryByText(/a balanced knightly blade/i)).not.toBeInTheDocument()
  })
})
