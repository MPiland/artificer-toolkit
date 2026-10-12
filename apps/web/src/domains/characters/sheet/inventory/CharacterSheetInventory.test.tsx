import {
  getInventoryCurrencyRows,
  getInventoryCurrencyTotals
} from './characterSheetInventory.utils'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { characterSheetEquipmentOptionsResponseDtoSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createSheet, openEquipmentManager, showCarriedEquipment } from '../tests/sheetTestHarness'
import { CharacterSheetInventory } from './CharacterSheetInventory'

const queryMocks = vi.hoisted(() => ({ getCharacterSheetEquipmentOptions: vi.fn() }))

vi.mock('#app/data/characters/queries', () => ({
  getCharacterSheetEquipmentOptions: queryMocks.getCharacterSheetEquipmentOptions
}))

const realSheet = createSheet()
const fullEquipmentOptions = characterSheetEquipmentOptionsResponseDtoSchema.parse(
  realSheet.reference.equipmentOptions
)
const longswordItem = realSheet.inventory.items.find((item) => item.label === 'Longsword')
const copper = realSheet.reference.currencyOptions.find((option) => option.label === 'Copper Piece')
const gold = realSheet.reference.currencyOptions.find((option) => option.label === 'Gold Piece')
if (!longswordItem || !copper || !gold || !fullEquipmentOptions[0]) {
  throw new Error('Expected the real Sheet to carry a Longsword and offer Copper and Gold Pieces.')
}

describe('Character Sheet inventory', () => {
  beforeEach(() => {
    queryMocks.getCharacterSheetEquipmentOptions.mockImplementation(
      (id: string | undefined, campaignId?: string | null) => ({
        queryKey: ['character-equipment-options', id, campaignId ?? null],
        queryFn: async () => fullEquipmentOptions,
        enabled: Boolean(id),
        initialData: id ? fullEquipmentOptions : undefined,
        retry: false,
        staleTime: Infinity
      })
    )
  })
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
      currencyId: copper.id,
      kind: 'RULESET',
      amount: 1,
      expectedVersion: 4
    })
  })

  it('uses the selected qualified currency when denomination IDs collide', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.reference.currencyOptions = [
      gold,
      {
        id: gold.id,
        label: 'Campaign Gold',
        kind: 'CAMPAIGN',
        campaignCurrencySystemId: 'campaign-currency-1'
      }
    ]

    renderWithAppProviders(
      <CharacterSheetInventory pending={false} sheet={sheet} submitCommand={submitCommand} />
    )

    await openEquipmentManager(user)
    const currencySelect = screen.getByRole('combobox', { name: /^currency type$/i })
    await user.click(currencySelect)
    await user.click(screen.getByRole('option', { name: 'Campaign Gold' }))
    await user.click(screen.getByRole('button', { name: /apply currency/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADJUST_CURRENCY',
      currencyId: gold.id,
      kind: 'CAMPAIGN',
      campaignCurrencySystemId: 'campaign-currency-1',
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
      itemInstanceId: longswordItem.id
    })
    expect(screen.queryByRole('button', { name: /^details$/i })).not.toBeInTheDocument()
  })

  it('loads full equipment choices only for an open Campaign inventory drawer', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.meta.viewer = 'CAMPAIGN_OWNER'
    sheet.meta.campaignId = '00000000-0000-4000-8000-000000000123'

    renderWithAppProviders(
      <CharacterSheetInventory pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    expect(queryMocks.getCharacterSheetEquipmentOptions).toHaveBeenLastCalledWith(
      undefined,
      sheet.meta.campaignId
    )
    await openEquipmentManager(user)
    expect(queryMocks.getCharacterSheetEquipmentOptions).toHaveBeenLastCalledWith(
      sheet.meta.characterId,
      sheet.meta.campaignId
    )
    await user.click(screen.getByRole('combobox', { name: /^equipment$/i }))
    await user.click(screen.getByRole('option', { name: 'Backpack' }))
    expect(screen.getByRole('combobox', { name: /^add to$/i })).toBeDisabled()
  })

  it('disables item acquisition while full equipment choices are loading', async () => {
    const user = userEvent.setup()
    queryMocks.getCharacterSheetEquipmentOptions.mockImplementation((id: string | undefined) => ({
      queryKey: ['pending-character-equipment-options', id],
      queryFn: () => new Promise(() => {}),
      enabled: Boolean(id),
      retry: false
    }))

    renderWithAppProviders(
      <CharacterSheetInventory pending={false} sheet={createSheet()} submitCommand={vi.fn()} />
    )

    await openEquipmentManager(user)
    expect(screen.getByRole('status')).toHaveTextContent('Loading equipment…')
    expect(screen.getByRole('combobox', { name: /^equipment$/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^quantity$/i })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: /^add to$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()
  })

  it('keeps item acquisition disabled when full equipment choices fail', async () => {
    const user = userEvent.setup()
    queryMocks.getCharacterSheetEquipmentOptions.mockImplementation((id: string | undefined) => ({
      queryKey: ['failed-character-equipment-options', id],
      queryFn: async () => {
        throw new Error('Equipment query failed.')
      },
      enabled: Boolean(id),
      retry: false
    }))

    renderWithAppProviders(
      <CharacterSheetInventory pending={false} sheet={createSheet()} submitCommand={vi.fn()} />
    )

    await openEquipmentManager(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Equipment choices could not be loaded.'
    )
    expect(screen.getByRole('combobox', { name: /^equipment$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()
  })

  it.each([
    { entered: 'nothing', typedQuantity: undefined, quantity: 1 },
    { entered: 'a quantity of 20', typedQuantity: '20', quantity: 20 }
  ])(
    'adds inventory items through sheet commands when $entered is entered',
    async ({ typedQuantity, quantity }) => {
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
        if (typedQuantity) {
          const quantityInput = screen.getByRole('textbox', { name: /^quantity$/i })
          await user.clear(quantityInput)
          await user.type(quantityInput, typedQuantity)
        }
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
        equipmentId: fullEquipmentOptions[0].id,
        quantity,
        expectedVersion: 4
      })
    }
  )

  it('renders inventory item reference details from equipment records', async () => {
    const user = userEvent.setup()
    const openPanel = vi.fn()
    const sheet = createSheet()
    sheet.inventory.items = sheet.inventory.items.map((item) =>
      item.id === longswordItem.id
        ? {
            ...item,
            label: 'Moonlit Blade',
            customName: 'Moonlit Blade',
            description: '<p>A balanced knightly blade.</p>',
            equippedSlot: 'MAIN_HAND' as const
          }
        : item
    )

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
    expect(within(row).getByText(/main hand/i)).toBeInTheDocument()
    expect(longswordItem.properties?.map((property) => property.label)).toEqual([
      'Martial',
      'Melee',
      'Versatile'
    ])
    expect(screen.queryByText(/properties:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/martial|melee|versatile/i)).not.toBeInTheDocument()

    await user.click(row)
    expect(openPanel).toHaveBeenCalledWith({ kind: 'ITEM', itemInstanceId: longswordItem.id })
    expect(screen.queryByText(/a balanced knightly blade/i)).not.toBeInTheDocument()
  })

  it('keeps qualified totals exact above the safe numeric aggregate', () => {
    const sheet = createSheet()
    const systemId = '00000000-0000-4000-8000-000000000601'
    sheet.reference.currencyOptions = [
      gold,
      {
        id: gold.id,
        label: 'Campaign Gold',
        kind: 'CAMPAIGN',
        campaignCurrencySystemId: systemId
      }
    ]
    sheet.inventory.currencies = [
      {
        currencyId: gold.id,
        kind: 'RULESET',
        label: gold.label,
        amount: Number.MAX_SAFE_INTEGER
      },
      {
        currencyId: gold.id,
        kind: 'RULESET',
        label: gold.label,
        amount: Number.MAX_SAFE_INTEGER,
        containerId: 'pouch'
      },
      {
        currencyId: gold.id,
        kind: 'CAMPAIGN',
        campaignCurrencySystemId: systemId,
        label: 'Campaign Gold',
        amount: 3
      }
    ]
    expect(
      getInventoryCurrencyTotals(sheet).map(({ label, amount }) => ({ label, amount }))
    ).toEqual([
      { label: gold.label, amount: '18014398509481982' },
      { label: 'Campaign Gold', amount: '3' }
    ])
    expect(getInventoryCurrencyRows(sheet)).toHaveLength(3)
  })

  it('moves held historical currency without making it available for acquisition', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    const historicalSystemId = '00000000-0000-4000-8000-000000000602'
    sheet.inventory.currencies = [
      {
        currencyId: 'old-coin',
        kind: 'CAMPAIGN',
        campaignCurrencySystemId: historicalSystemId,
        label: 'Old Coin',
        amount: 4
      }
    ]
    sheet.inventory.containers = [{ id: 'pouch', label: 'Pouch', itemIds: [], currencies: [] }]
    renderWithAppProviders(
      <CharacterSheetInventory pending={false} sheet={sheet} submitCommand={submitCommand} />
    )
    await openEquipmentManager(user)
    expect(
      screen
        .getAllByRole('button', { name: '+1' })
        .every((button) => button.hasAttribute('disabled'))
    ).toBe(true)
    await user.click(screen.getByRole('combobox', { name: /^to$/i }))
    await user.click(screen.getByRole('option', { name: 'Pouch' }))
    await user.click(screen.getByRole('button', { name: /^move currency$/i }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'MOVE_CURRENCY',
      currencyId: 'old-coin',
      kind: 'CAMPAIGN',
      campaignCurrencySystemId: historicalSystemId,
      amount: 1,
      fromContainerId: undefined,
      toContainerId: 'pouch',
      expectedVersion: 4
    })
    expect(screen.getByRole('combobox', { name: /^currency type$/i })).toHaveValue(copper.label)
  })
})
