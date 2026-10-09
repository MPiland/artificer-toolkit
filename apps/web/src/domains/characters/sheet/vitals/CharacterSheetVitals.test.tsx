import { screen, waitFor, within } from '@testing-library/react'
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

  it('lists each active maximum reduction with how it ends', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.overview.maxHitPoints = 11
    sheet.overview.currentHitPoints = 11
    sheet.overview.maxHitPointsReductions = [
      {
        id: '11111111-1111-4111-8111-111111111121',
        label: 'Life Drain',
        sourceHidden: false,
        amount: 4,
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
      },
      {
        id: '11111111-1111-4111-8111-111111111122',
        label: null,
        sourceHidden: true,
        amount: 2,
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
      }
    ]

    renderWithAppProviders(
      <CharacterSheetOverviewVitals pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    await openHpControls(user)
    const reductions = screen.getByRole('list', { name: /maximum hit point reductions/i })
    const [drain, golem] = within(reductions).getAllByRole('listitem')
    expect(drain).toHaveTextContent(/^Life Drain\s*·\s*Until long rest\s*-4$/)
    expect(golem).toHaveTextContent(/^Unknown source\s*·\s*Until restored\s*-2$/)
  })

  describe('death saves', () => {
    const dyingSheet = (deathSaves = { successes: 1, failures: 0, stable: false }) => {
      const sheet = createSheet()
      sheet.overview.currentHitPoints = 0
      sheet.overview.deathSaves = deathSaves
      return sheet
    }

    it('hides the tracker above 0 HP', () => {
      renderWithAppProviders(
        <CharacterSheetOverviewVitals
          pending={false}
          sheet={createSheet()}
          submitCommand={vi.fn()}
        />
      )

      expect(screen.queryByRole('group', { name: /death saves/i })).not.toBeInTheDocument()
    })

    it('lets an editor set marks and roll while dying', async () => {
      const user = userEvent.setup()
      const submitCommand = vi.fn().mockResolvedValue(true)
      renderWithAppProviders(
        <CharacterSheetOverviewVitals
          pending={false}
          sheet={dyingSheet()}
          submitCommand={submitCommand}
        />
      )

      expect(screen.getByRole('checkbox', { name: 'Death save success 1' })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Death save success 2' })).not.toBeChecked()

      await user.click(screen.getByRole('checkbox', { name: 'Death save failure 2' }))
      expect(submitCommand).toHaveBeenLastCalledWith({
        type: 'SET_DEATH_SAVES',
        successes: 1,
        failures: 2,
        expectedVersion: 4
      })

      await user.click(screen.getByRole('button', { name: /roll death save/i }))
      expect(submitCommand).toHaveBeenLastCalledWith({
        type: 'ROLL_DEATH_SAVE',
        expectedVersion: 4
      })
    })

    it('shows Dead instead of the roll button after three failures', () => {
      renderWithAppProviders(
        <CharacterSheetOverviewVitals
          pending={false}
          sheet={dyingSheet({ successes: 0, failures: 3, stable: false })}
          submitCommand={vi.fn()}
        />
      )

      expect(screen.getByText('Dead')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /roll death save/i })).not.toBeInTheDocument()
    })

    it('shows Stable instead of the roll button once stable', () => {
      renderWithAppProviders(
        <CharacterSheetOverviewVitals
          pending={false}
          sheet={dyingSheet({ successes: 0, failures: 0, stable: true })}
          submitCommand={vi.fn()}
        />
      )

      expect(screen.getByText('Stable')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /roll death save/i })).not.toBeInTheDocument()
    })

    it('is read-only without play-state management', async () => {
      const user = userEvent.setup()
      const submitCommand = vi.fn()
      const sheet = dyingSheet()
      sheet.meta.capabilities.managePlayState = false
      renderWithAppProviders(
        <CharacterSheetOverviewVitals pending={false} sheet={sheet} submitCommand={submitCommand} />
      )

      await user.click(screen.getByRole('checkbox', { name: 'Death save failure 1' }))
      expect(submitCommand).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: /roll death save/i })).not.toBeInTheDocument()
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
