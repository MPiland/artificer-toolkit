import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createSheet, openHpControls } from '../tests/sheetTestHarness'
import { CharacterSheetOverviewVitals } from './CharacterSheetOverviewVitals'

describe('Character Sheet vitals', () => {
  it('resyncs HP setting inputs when refreshed sheet data changes', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const refreshedSheet = createSheet()
    refreshedSheet.meta.streamVersion = 5
    refreshedSheet.overview.tempHitPoints = 1
    refreshedSheet.overview.maxHitPoints = 18
    refreshedSheet.overview.maxHitPointsOverride = 18

    const { rerender } = renderWithAppProviders(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await openHpControls(user)
    await user.clear(screen.getByLabelText(/temp hp/i))
    await user.type(screen.getByLabelText(/temp hp/i), '9')

    rerender(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={refreshedSheet}
        submitCommand={submitCommand}
      />
    )

    await openHpControls(user)
    await waitFor(() => expect(screen.getByLabelText(/temp hp/i)).toHaveValue('1'))
    expect(screen.queryByRole('button', { name: /save hp settings/i })).not.toBeInTheDocument()
    expect(submitCommand).not.toHaveBeenCalled()
  })

  it('commits HP settings on blur without pinning calculated max HP', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await openHpControls(user)
    await user.clear(screen.getByLabelText(/temp hp/i))
    await user.type(screen.getByLabelText(/temp hp/i), '5')
    await user.tab()

    await waitFor(() =>
      expect(submitCommand).toHaveBeenCalledWith({
        type: 'SET_HIT_POINTS',
        temp: 5,
        maxOverride: null,
        expectedVersion: 4
      })
    )
  })

  it('upserts and removes the separate maximum HP adjustment', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const sheet = createSheet()

    const { rerender } = renderWithAppProviders(
      <CharacterSheetOverviewVitals pending={false} sheet={sheet} submitCommand={submitCommand} />
    )

    await openHpControls(user)
    const adjustment = screen.getByLabelText(/max hp adjustment/i)
    await user.clear(adjustment)
    await user.type(adjustment, '3')
    await user.tab()

    expect(submitCommand).toHaveBeenLastCalledWith({
      type: 'UPSERT_SHEET_ADJUSTMENT',
      adjustment: {
        family: 'HIT_POINTS',
        field: 'MAXIMUM_MODIFIER',
        value: 3
      },
      expectedVersion: 4
    })

    const adjustedSheet = createSheet()
    adjustedSheet.meta.streamVersion = 5
    adjustedSheet.overview.maxHitPointsModifier = 3
    adjustedSheet.overview.maxHitPointsModifierAdjustmentId = '11111111-1111-4111-8111-111111111112'
    rerender(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={adjustedSheet}
        submitCommand={submitCommand}
      />
    )

    await openHpControls(user)
    const adjustedInput = screen.getByLabelText(/max hp adjustment/i)
    await user.clear(adjustedInput)
    await user.type(adjustedInput, '0')
    await user.tab()

    expect(submitCommand).toHaveBeenLastCalledWith({
      type: 'REMOVE_SHEET_ADJUSTMENT',
      adjustmentId: '11111111-1111-4111-8111-111111111112',
      target: { kind: 'HIT_POINTS' },
      family: 'HIT_POINTS',
      expectedVersion: 5
    })
  })

  it('does not submit no-op hit point adjustments', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await openHpControls(user)
    await user.clear(screen.getByRole('textbox', { name: /hit point amount/i }))
    await user.type(screen.getByRole('textbox', { name: /hit point amount/i }), '0')

    expect(screen.getByRole('button', { name: /^damage$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^heal$/i })).toBeDisabled()
  })
})
