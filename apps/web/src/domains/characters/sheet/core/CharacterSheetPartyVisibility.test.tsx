import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetPartyVisibility } from './CharacterSheetPartyVisibility'

describe('CharacterSheetPartyVisibility', () => {
  it('lets the Character’s player share the Sheet and choose a health display level', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    renderWithAppProviders(
      <CharacterSheetPartyVisibility
        expectedVersion={7}
        pending={false}
        submitCommand={submitCommand}
        visibility={{ sheet: false, health: 'HIDDEN' }}
      />
    )

    await user.click(screen.getByRole('button', { name: 'What the party sees' }))
    expect(await screen.findByText('Show my health to the party')).toBeVisible()
    expect(screen.getByText(/Personality and background stay private/)).toBeVisible()

    await user.click(screen.getByRole('switch', { name: /^Party can view/ }))
    expect(submitCommand).toHaveBeenLastCalledWith({
      type: 'SET_PARTY_VISIBILITY',
      expectedVersion: 7,
      visibility: { sheet: true, health: 'HIDDEN' }
    })

    await user.click(screen.getByRole('radio', { name: 'Bar' }))
    expect(submitCommand).toHaveBeenLastCalledWith({
      type: 'SET_PARTY_VISIBILITY',
      expectedVersion: 7,
      visibility: { sheet: false, health: 'BAR' }
    })
  })
})
