import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetRollContext } from '../dice/rollContext'
import { createSheet } from '../tests/sheetTestHarness'
import { CharacterSheetOverviewAbilities } from './CharacterSheetOverviewAbilities'

describe('Character Sheet ability strip', () => {
  it('shows and rolls the ability check modifier, not the pure ability modifier', async () => {
    const user = userEvent.setup()
    const executeRoll = vi.fn().mockResolvedValue(null)
    const [first, ...rest] = createSheet().overview.abilities
    if (!first) throw new Error('Expected the Sheet fixture to carry abilities.')
    // A check bonus (Jack of All Trades) lifts the check to +3 over the +2 modifier.
    const abilities = [{ ...first, modifier: 2, checkModifier: 3 }, ...rest]

    renderWithAppProviders(
      <CharacterSheetRollContext.Provider
        value={{ clearManualRoll: vi.fn(), executeRoll, hasManualRoll: false, pending: false }}
      >
        <CharacterSheetOverviewAbilities abilities={abilities} />
      </CharacterSheetRollContext.Provider>
    )

    const roll = screen.getByRole('button', { name: `Roll ${first.label} check: 1d20 + 3` })
    expect(within(roll).getByText('+3')).toBeInTheDocument()
    expect(screen.getByLabelText(`Score ${first.score}, modifier +3`)).toBeInTheDocument()

    await user.click(roll)
    expect(executeRoll).toHaveBeenCalledWith(
      expect.objectContaining({
        expression: '1d20 + 3',
        source: { kind: 'ABILITY_CHECK', label: `${first.label} check` }
      })
    )
  })
})
