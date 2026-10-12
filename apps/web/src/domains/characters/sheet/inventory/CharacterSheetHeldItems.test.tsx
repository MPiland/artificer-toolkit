import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { vi } from 'vitest'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import { projectOptimisticCharacterSheetSlice } from '#app/data/characters/optimisticSheet'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetItemPanelContent } from '../inspector/CharacterSheetItemPanel'
import { itemPanelFixture } from '../inspector/inspector.fixtures'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import { createSheet, showCarriedEquipment } from '../tests/sheetTestHarness'
import { CharacterSheetInventory } from './CharacterSheetInventory'

vi.mock('#app/data/characters/queries', () => ({
  getCharacterSheetEquipmentOptions: () => ({
    queryKey: ['character-equipment-options'],
    queryFn: async () => [],
    enabled: false
  })
}))

const template = createSheet().inventory.items[0]!
const swordId = '00000000-0000-4000-8000-0000000008a1'
const shieldId = '00000000-0000-4000-8000-0000000008a2'
const startingSheet = (): CharacterSheetResponseDto => {
  const sheet = createSheet()
  sheet.inventory.items = [
    {
      ...template,
      id: swordId,
      label: 'Test Sword',
      customName: undefined,
      category: 'WEAPON',
      properties: [],
      equippedSlot: null
    },
    {
      ...template,
      id: shieldId,
      label: 'Test Shield',
      customName: undefined,
      category: 'SHIELD',
      properties: [],
      equippedSlot: null
    }
  ]
  return sheet
}

/** The Inventory list and the open item panel over one Sheet that applies each command as submitted. */
function HeldItemsJourney() {
  const [sheet, setSheet] = useState(startingSheet)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const submitCommand: SubmitSheetCommand = async (command) => {
    setSheet((current) => {
      const projected = projectOptimisticCharacterSheetSlice(
        projectCharacterSheetSlice(current, 'INVENTORY'),
        { ...command, commandId: crypto.randomUUID() }
      )
      if (projected.slice !== 'INVENTORY') throw new Error('Expected the Inventory slice.')
      return { ...current, inventory: projected.data.inventory }
    })
    return true
  }
  const openItem = sheet.inventory.items.find((item) => item.id === openItemId)
  return (
    <>
      <CharacterSheetInventory
        openPanel={(target) => target.kind === 'ITEM' && setOpenItemId(target.itemInstanceId)}
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
      {openItem ? (
        <CharacterSheetItemPanelContent
          expectedVersion={sheet.meta.streamVersion}
          panel={{
            ...itemPanelFixture,
            itemInstanceId: openItem.id,
            displayName: openItem.label,
            equippedSlot: openItem.equippedSlot
          }}
          pending={false}
          submitCommand={submitCommand}
          onClose={() => setOpenItemId(null)}
        />
      ) : null}
    </>
  )
}

describe('Character Sheet held items journey (SHEET-8)', () => {
  it('equips a sword and a shield, swaps them, and unequips the sword', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<HeldItemsJourney />)
    await showCarriedEquipment(user)
    const row = (name: string) => screen.getByRole('button', { name: `Open ${name} details` })

    const toggleEquipped = async (name: string) => {
      await user.click(row(name))
      const customize = await screen.findByRole('button', { name: 'Customize' })
      if (customize.getAttribute('aria-expanded') !== 'true') await user.click(customize)
      await user.click(await screen.findByRole('switch', { name: 'Equipped' }))
    }
    await toggleEquipped('Test Sword')
    expect(within(row('Test Sword')).getByText(/main hand/i)).toBeInTheDocument()

    await toggleEquipped('Test Shield')
    expect(within(row('Test Shield')).getByText(/off hand/i)).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Swap hands' }))
    expect(within(row('Test Sword')).getByText(/off hand/i)).toBeInTheDocument()
    expect(within(row('Test Shield')).getByText(/main hand/i)).toBeInTheDocument()

    await toggleEquipped('Test Sword')
    expect(within(row('Test Sword')).queryByText(/hand|worn/i)).not.toBeInTheDocument()
    expect(within(row('Test Shield')).getByText(/main hand/i)).toBeInTheDocument()
  })
})
