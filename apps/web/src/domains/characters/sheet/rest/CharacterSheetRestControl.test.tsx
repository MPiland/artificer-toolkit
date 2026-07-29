import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { server } from '#test/msw/server'
import type { CharacterRestPreviewRequestDto } from '#app/lib/api'
import {
  createRestPreview,
  createSheet,
  openHpControls,
  readBatchedInput,
  trpcJson
} from '../tests/sheetTestHarness'
import { CharacterSheetOverviewVitals } from '../vitals/CharacterSheetOverviewVitals'

describe('Character Sheet rests', () => {
  it('sends sheet commands with the current stream version', async () => {
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
    await user.click(screen.getByRole('button', { name: /^damage$/i }))

    expect(submitCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADJUST_HIT_POINTS',
        expectedVersion: 4
      })
    )
  })

  it('previews and completes a short rest with backend-owned roll evidence', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)

    server.use(
      http.post('*/api/trpc/characters.restPreview', async ({ request }) => {
        const body = await request.json()
        const input = readBatchedInput<{ id: string; input: CharacterRestPreviewRequestDto }>(
          body
        ).input
        return trpcJson(createRestPreview(input))
      })
    )

    renderWithAppProviders(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /^short rest$/i }))
    const dialog = await screen.findByRole('dialog', { name: /^short rest$/i })
    expect(within(dialog).getByText(/fighter d8/i)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /add one d8 hit die/i }))
    expect(within(dialog).getByRole('button', { name: /1d8 \+ 1/i })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /1d8 \+ 1/i }))
    expect((await within(dialog).findAllByText(/6 rolled/i)).length).toBeGreaterThan(0)
    expect(within(dialog).getByText(/2 hp staged/i)).toBeInTheDocument()

    await user.click(within(dialog).getByLabelText(/clockwork hound/i))
    await user.click(within(dialog).getByRole('button', { name: /take short rest/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'COMPLETE_REST',
      restKind: 'SHORT',
      previewFingerprint: 'rest-preview-short',
      selectedHitDice: [{ die: 8, count: 1 }],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: ['11111111-1111-4111-8111-111111111111'],
      rollEvidence: {
        expression: '1d8 + 1',
        terms: [{ die: 8, count: 1, modifierPerDie: 1, rolls: [5] }],
        total: 6
      },
      expectedVersion: 4
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /^short rest$/i })).not.toBeInTheDocument()
    )
  })

  it('allows a meaningful zero-die short rest when another recovery applies', async () => {
    const user = userEvent.setup()

    server.use(
      http.post('*/api/trpc/characters.restPreview', async ({ request }) => {
        const body = await request.json()
        const input = readBatchedInput<{ id: string; input: CharacterRestPreviewRequestDto }>(
          body
        ).input
        return trpcJson(createRestPreview(input))
      })
    )

    renderWithAppProviders(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={createSheet()}
        submitCommand={vi.fn().mockResolvedValue(true)}
      />
    )

    await user.click(screen.getByRole('button', { name: /^short rest$/i }))
    const dialog = await screen.findByRole('dialog', { name: /^short rest$/i })

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /take short rest/i })).toBeEnabled()
    )
    expect(within(dialog).getByText(/no hit dice selected/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/second wind/i)).toBeInTheDocument()
  })

  it('summarizes the authoritative long-rest recovery', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.overview.exhaustion.level = 1

    server.use(
      http.post('*/api/trpc/characters.restPreview', async ({ request }) => {
        const body = await request.json()
        const input = readBatchedInput<{ id: string; input: CharacterRestPreviewRequestDto }>(
          body
        ).input
        return trpcJson(createRestPreview(input))
      })
    )

    renderWithAppProviders(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn().mockResolvedValue(true)}
      />
    )

    await user.click(screen.getByRole('button', { name: /^long rest$/i }))
    const dialog = await screen.findByRole('dialog', { name: /^long rest$/i })

    expect(within(dialog).getByText('Restores to 12 / 12')).toBeInTheDocument()
    expect(within(dialog).getByText('Recover by active rules')).toBeInTheDocument()
    expect(within(dialog).getByText(/reduces from level 1/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/temp hp clears/i)).toBeInTheDocument()
  })
})
