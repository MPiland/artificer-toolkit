import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetItemPanelContent } from './CharacterSheetItemPanel'
import { itemPanelFixture } from './inspector.fixtures'

function renderPanel(equippedSlot: 'MAIN_HAND' | 'OFF_HAND' | 'WORN' | null) {
  const submitCommand = vi.fn().mockResolvedValue(true)
  renderWithAppProviders(
    <CharacterSheetItemPanelContent
      expectedVersion={4}
      panel={{ ...itemPanelFixture, equippedSlot }}
      pending={false}
      submitCommand={submitCommand}
      onClose={vi.fn()}
    />
  )
  return { submitCommand, user: userEvent.setup() }
}

describe('Character Sheet item panel hands (SHEET-8)', () => {
  it('swaps the hands from a held item', async () => {
    const { submitCommand, user } = renderPanel('MAIN_HAND')
    await user.click(screen.getByRole('button', { name: 'Customize' }))
    expect(await screen.findByRole('switch', { name: 'Equipped' })).toBeChecked()
    await user.click(await screen.findByRole('button', { name: 'Swap hands' }))
    expect(submitCommand).toHaveBeenCalledWith({ type: 'SWAP_HELD_ITEMS', expectedVersion: 4 })
  })

  it('offers the swap from the off hand and unequips from the switch', async () => {
    const { submitCommand, user } = renderPanel('OFF_HAND')
    await user.click(screen.getByRole('button', { name: 'Customize' }))
    await user.click(await screen.findByRole('button', { name: 'Swap hands' }))
    await user.click(await screen.findByRole('switch', { name: 'Equipped' }))
    expect(submitCommand).toHaveBeenLastCalledWith({
      type: 'UNEQUIP_ITEM',
      expectedVersion: 4,
      itemId: itemPanelFixture.itemInstanceId
    })
  })

  it('offers no swap for a worn item', async () => {
    const worn = renderPanel('WORN')
    await worn.user.click(screen.getByRole('button', { name: 'Customize' }))
    expect(await screen.findByRole('switch', { name: 'Equipped' })).toBeChecked()
    expect(screen.queryByRole('button', { name: 'Swap hands' })).not.toBeInTheDocument()
  })

  it('equips a carried item', async () => {
    const { submitCommand, user } = renderPanel(null)
    await user.click(screen.getByRole('button', { name: 'Customize' }))
    expect(screen.queryByRole('button', { name: 'Swap hands' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('switch', { name: 'Equipped' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'EQUIP_ITEM',
      expectedVersion: 4,
      itemId: itemPanelFixture.itemInstanceId
    })
  })
})
