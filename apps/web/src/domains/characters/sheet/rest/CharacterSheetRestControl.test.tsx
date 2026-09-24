import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, vi } from 'vitest'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { characterRestPreviewInputSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { CharacterSheetRollContext } from '../dice/rollContext'
import { createRestPreview, createSheet, openHpControls } from '../tests/sheetTestHarness'
import { CharacterSheetOverviewVitals } from '../vitals/CharacterSheetOverviewVitals'

const hitDieRoll = {
  id: '00000000-0000-4000-8000-000000000097',
  characterId: 'character-1',
  characterLabel: 'Test Character',
  source: { kind: 'HIT_DIE', label: 'Short rest hit dice' },
  ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
  normalizedExpression: '1d8 + 1',
  evidence: {
    terms: [{ count: 1, die: 8, rolls: [5], subtotal: 5 }],
    modifier: 1,
    mode: 'NORMAL',
    subtotal: 6,
    transform: { kind: 'NONE' },
    total: 6
  },
  createdAt: '2026-07-31T12:00:00.000Z'
} satisfies RollRecordDto

describe('Character Sheet rests', () => {
  afterEach(() => vi.restoreAllMocks())

  beforeEach(() => {
    vi.spyOn(ConvexReactClient.prototype, 'query').mockImplementation(
      async (...[reference, args]) => {
        expect(getFunctionName(reference)).toBe('characters/rest:preview')
        return createRestPreview(characterRestPreviewInputSchema.parse(args).input)
      }
    )
  })

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

  it('waits for the presented hit-die roll before adopting backend-owned evidence', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const rollId = hitDieRoll.id
    let revealRoll!: (roll: RollRecordDto | undefined) => void
    const executeRoll = vi.fn().mockReturnValue(
      new Promise<RollRecordDto | undefined>((resolve) => {
        revealRoll = resolve
      })
    )

    renderWithAppProviders(
      <CharacterSheetRollContext.Provider
        value={{
          canPublishToTable: false,
          clearManualRoll: vi.fn(),
          destination: 'PRIVATE',
          dismissRoll: vi.fn(),
          executeRoll,
          hasManualRoll: false,
          pending: false,
          presentationPending: false,
          presentedRollPrivate: true,
          revealRoll: vi.fn(),
          setDestination: vi.fn()
        }}
      >
        <CharacterSheetOverviewVitals
          pending={false}
          sheet={createSheet()}
          submitCommand={submitCommand}
        />
      </CharacterSheetRollContext.Provider>
    )

    await user.click(screen.getByRole('button', { name: /^short rest$/i }))
    const dialog = await screen.findByRole('dialog', { name: /^short rest$/i })
    expect(within(dialog).getByText(/fighter d8/i)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /add one d8 hit die/i }))
    expect(within(dialog).getByRole('button', { name: /1d8 \+ 1/i })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /1d8 \+ 1/i }))
    expect(within(dialog).queryByText(/6 rolled/i)).not.toBeInTheDocument()
    await act(async () => revealRoll(hitDieRoll))
    expect((await within(dialog).findAllByText(/6 rolled/i)).length).toBeGreaterThan(0)
    expect(within(dialog).getByText(/2 hp selected/i)).toBeInTheDocument()

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
      rollId,
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

  it('removes prior evidence when a reroll preview fails and the reroll is canceled', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    let cancelRoll!: () => void
    const canceledRoll = new Promise<RollRecordDto | undefined>((resolve) => {
      cancelRoll = () => resolve(undefined)
    })
    const executeRoll = vi.fn().mockResolvedValueOnce(hitDieRoll).mockReturnValueOnce(canceledRoll)
    const query = vi.mocked(ConvexReactClient.prototype.query)
    renderWithAppProviders(
      <CharacterSheetRollContext.Provider
        value={{
          canPublishToTable: false,
          clearManualRoll: vi.fn(),
          destination: 'PRIVATE',
          dismissRoll: vi.fn(),
          executeRoll,
          hasManualRoll: false,
          pending: false,
          presentationPending: false,
          presentedRollPrivate: true,
          revealRoll: vi.fn(),
          setDestination: vi.fn()
        }}
      >
        <CharacterSheetOverviewVitals
          pending={false}
          sheet={createSheet()}
          submitCommand={submitCommand}
        />
      </CharacterSheetRollContext.Provider>
    )
    await user.click(screen.getByRole('button', { name: /^short rest$/i }))
    const dialog = await screen.findByRole('dialog', { name: /^short rest$/i })
    await user.click(within(dialog).getByRole('button', { name: /add one d8 hit die/i }))
    await user.click(await within(dialog).findByRole('button', { name: /1d8 \+ 1/i }))
    await within(dialog).findAllByText(/6 rolled/i)
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /take short rest/i })).toBeEnabled()
    )

    query.mockRejectedValueOnce(new Error('Clearing the previous roll failed.'))
    await user.click(within(dialog).getByRole('button', { name: /1d8 \+ 1/i }))
    await within(dialog).findByRole('alert')
    await act(async () => cancelRoll())
    expect(within(dialog).queryAllByText(/6 rolled/i)).toHaveLength(0)
    expect(
      within(dialog).queryByRole('button', { name: /take short rest/i })
    ).not.toBeInTheDocument()
    expect(submitCommand).not.toHaveBeenCalled()

    query.mockClear()
    await user.click(within(dialog).getByRole('button', { name: /refresh preview/i }))
    const refreshedRoll = await within(dialog).findByRole('button', { name: /1d8 \+ 1/i })
    await waitFor(() => expect(refreshedRoll).toBeEnabled())
    expect(within(dialog).getByRole('button', { name: /take short rest/i })).toBeDisabled()
    expect(query).toHaveBeenCalledTimes(1)
    const refreshedInput = characterRestPreviewInputSchema.parse(query.mock.calls[0]![1]).input
    expect(refreshedInput.rollId).toBeUndefined()
    expect(refreshedInput.rollEvidence).toBeUndefined()
    expect(refreshedInput.selectedHitDice).toEqual([{ die: 8, count: 1 }])
  })

  it('ignores a hit-die roll from an earlier rest overlay', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    let settle!: () => void
    const earlier = new Promise<void>((resolve) => {
      settle = resolve
    })
    const executeRoll = vi.fn().mockImplementation(async () => {
      await earlier
      return hitDieRoll
    })
    renderWithAppProviders(
      <CharacterSheetRollContext.Provider
        value={{
          canPublishToTable: false,
          clearManualRoll: vi.fn(),
          destination: 'PRIVATE',
          dismissRoll: vi.fn(),
          executeRoll,
          hasManualRoll: false,
          pending: false,
          presentationPending: false,
          presentedRollPrivate: true,
          revealRoll: vi.fn(),
          setDestination: vi.fn()
        }}
      >
        <CharacterSheetOverviewVitals
          pending={false}
          sheet={createSheet()}
          submitCommand={submitCommand}
        />
      </CharacterSheetRollContext.Provider>
    )
    await user.click(screen.getByRole('button', { name: /^short rest$/i }))
    await user.click(await screen.findByRole('button', { name: /add one d8 hit die/i }))
    const roll = await screen.findByRole('button', { name: /1d8 \+ 1/i })
    await waitFor(() => expect(roll).toBeEnabled())
    await user.click(roll)
    await waitFor(() => expect(executeRoll).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Close short rest preview' }))
    await user.click(screen.getByRole('button', { name: /^short rest$/i }))
    const apply = await screen.findByRole('button', { name: /take short rest/i })
    await waitFor(() => expect(apply).toBeEnabled())
    const query = vi.mocked(ConvexReactClient.prototype.query)
    const queryCount = query.mock.calls.length
    await act(async () => {
      settle()
      await earlier
    })
    expect(query).toHaveBeenCalledTimes(queryCount)
    expect(screen.queryByText(/6 rolled/i)).not.toBeInTheDocument()
    await user.click(apply)
    expect(submitCommand).toHaveBeenCalledWith(
      expect.objectContaining({ selectedHitDice: [], rollId: undefined })
    )
  })

  it('allows a meaningful zero-die short rest when another recovery applies', async () => {
    const user = userEvent.setup()

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
    expect(within(dialog).getByText('Recovery is calculated automatically')).toBeInTheDocument()
    expect(within(dialog).getByText(/reduces from level 1/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/temp hp clears/i)).toBeInTheDocument()
  })

  it.each(['success', 'error'] as const)(
    'ignores an older preview %s after reopening the rest overlay',
    async (outcome) => {
      const user = userEvent.setup()
      const submitCommand = vi.fn().mockResolvedValue(true)
      let settle!: () => void
      const earlier = new Promise<void>((resolve) => {
        settle = resolve
      })
      const query = vi
        .mocked(ConvexReactClient.prototype.query)
        .mockImplementationOnce(async (...[, args]) => {
          const preview = createRestPreview(characterRestPreviewInputSchema.parse(args).input)
          await earlier
          if (outcome === 'error') throw new Error('Old preview failed')
          return { ...preview, previewFingerprint: 'older-preview' }
        })
        .mockImplementationOnce(async (...[, args]) => ({
          ...createRestPreview(characterRestPreviewInputSchema.parse(args).input),
          previewFingerprint: 'current-preview'
        }))
      renderWithAppProviders(
        <CharacterSheetOverviewVitals
          pending={false}
          sheet={createSheet()}
          submitCommand={submitCommand}
        />
      )
      await user.click(screen.getByRole('button', { name: /^short rest$/i }))
      await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
      await user.click(screen.getByRole('button', { name: 'Close short rest preview' }))
      await user.click(screen.getByRole('button', { name: /^short rest$/i }))
      const apply = await screen.findByRole('button', { name: /take short rest/i })
      await waitFor(() => expect(apply).toBeEnabled())
      await act(async () => {
        settle()
        await earlier
      })
      expect(screen.queryByText(/Rest preview could not be updated/i)).not.toBeInTheDocument()
      await user.click(apply)
      expect(submitCommand).toHaveBeenCalledWith(
        expect.objectContaining({ previewFingerprint: 'current-preview' })
      )
    }
  )
})
