import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import { afterEach, beforeEach, vi } from 'vitest'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { characterRestPreviewInputSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { playerRollDestinationOptions, playerStateRollDestinationOptions } from '../dice/dice.utils'
import {
  CharacterSheetRollContext,
  CharacterSheetRollDestinationContext
} from '../dice/rollContext'
import { createRestPreview, createSheet, openHpControls } from '../tests/sheetTestHarness'
import { CharacterSheetOverviewVitals } from '../vitals/CharacterSheetOverviewVitals'

const hitDieRoll = {
  id: '00000000-0000-4000-8000-000000000097',
  characterId: 'character-1',
  characterLabel: 'Test Character',
  source: { kind: 'HIT_DIE', label: 'Short rest hit dice' },
  ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
  normalizedExpression: '1d10 + 1',
  evidence: {
    terms: [{ count: 1, die: 10, rolls: [5], subtotal: 5 }],
    modifier: 1,
    mode: 'NORMAL',
    keep: 'FIRST',
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
        expect(getFunctionName(reference)).toBe(getFunctionName(api.characters.rest.preview))
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
          clearManualRoll: vi.fn(),
          executeRoll,
          hasManualRoll: false,
          pending: false
        }}
      >
        <CharacterSheetRollDestinationContext.Provider
          value={{
            destination: 'PRIVATE',
            destinationOptions: playerRollDestinationOptions,
            setDestination: vi.fn(),
            stateRollDestination: 'TABLE',
            stateRollDestinationOptions: playerStateRollDestinationOptions
          }}
        >
          <CharacterSheetOverviewVitals
            pending={false}
            sheet={createSheet()}
            submitCommand={submitCommand}
          />
        </CharacterSheetRollDestinationContext.Provider>
      </CharacterSheetRollContext.Provider>
    )

    await user.click(screen.getByRole('button', { name: /^short rest$/i }))
    const dialog = await screen.findByRole('dialog', { name: /^short rest$/i })
    expect(await within(dialog).findByText(/fighter d10/i)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /add one d10 hit die/i }))
    const roll = await within(dialog).findByRole('button', { name: /1d10 \+ 1/i })
    expect(roll).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: 'Table' })).toBeChecked()
    expect(within(dialog).getByRole('radio', { name: 'To GM' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('radio', { name: 'Just me' })).not.toBeInTheDocument()

    await waitFor(() => expect(roll).toBeEnabled())
    await user.click(roll)
    expect(within(dialog).queryByText(/6 rolled/i)).not.toBeInTheDocument()
    await act(async () => revealRoll(hitDieRoll))
    expect((await within(dialog).findAllByText(/6 rolled/i)).length).toBeGreaterThan(0)
    // The played Fighter is at 10 of 11 hit points, so the 6 rolled heals only the 1 missing.
    expect(within(dialog).getByText(/1 hp selected/i)).toBeInTheDocument()
    // Short rests recover companion hit dice only after a long rest (sheetRest.ts eligibleCompanions),
    // and the Wolf has no short-rest resource, so no companion choice is offered.
    expect(
      within(dialog).queryByLabelText(createSheet().extras.items[0]!.displayName)
    ).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /take short rest/i }))

    const query = vi.mocked(ConvexReactClient.prototype.query)
    const { previewFingerprint } = await createRestPreview(
      characterRestPreviewInputSchema.parse(query.mock.lastCall![1]).input
    )
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'COMPLETE_REST',
      restKind: 'SHORT',
      previewFingerprint,
      selectedHitDice: [{ die: 10, count: 1 }],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      rollId,
      rollEvidence: {
        expression: '1d10 + 1',
        terms: [{ die: 10, count: 1, modifierPerDie: 1, rolls: [5] }],
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
          clearManualRoll: vi.fn(),
          executeRoll,
          hasManualRoll: false,
          pending: false
        }}
      >
        <CharacterSheetRollDestinationContext.Provider
          value={{
            destination: 'PRIVATE',
            destinationOptions: [],
            setDestination: vi.fn(),
            stateRollDestination: 'PRIVATE',
            stateRollDestinationOptions: []
          }}
        >
          <CharacterSheetOverviewVitals
            pending={false}
            sheet={createSheet()}
            submitCommand={submitCommand}
          />
        </CharacterSheetRollDestinationContext.Provider>
      </CharacterSheetRollContext.Provider>
    )
    await user.click(screen.getByRole('button', { name: /^short rest$/i }))
    const dialog = await screen.findByRole('dialog', { name: /^short rest$/i })
    await user.click(await within(dialog).findByRole('button', { name: /add one d10 hit die/i }))
    const roll = await within(dialog).findByRole('button', { name: /1d10 \+ 1/i })
    await waitFor(() => expect(roll).toBeEnabled())
    await user.click(roll)
    await within(dialog).findAllByText(/6 rolled/i)
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /take short rest/i })).toBeEnabled()
    )

    query.mockRejectedValueOnce(new Error('Clearing the previous roll failed.'))
    await user.click(within(dialog).getByRole('button', { name: /1d10 \+ 1/i }))
    await within(dialog).findByRole('alert')
    await act(async () => cancelRoll())
    expect(within(dialog).queryAllByText(/6 rolled/i)).toHaveLength(0)
    expect(
      within(dialog).queryByRole('button', { name: /take short rest/i })
    ).not.toBeInTheDocument()
    expect(submitCommand).not.toHaveBeenCalled()

    query.mockClear()
    await user.click(within(dialog).getByRole('button', { name: /refresh preview/i }))
    const refreshedRoll = await within(dialog).findByRole('button', { name: /1d10 \+ 1/i })
    await waitFor(() => expect(refreshedRoll).toBeEnabled())
    expect(within(dialog).getByRole('button', { name: /take short rest/i })).toBeDisabled()
    expect(query).toHaveBeenCalledTimes(1)
    const refreshedInput = characterRestPreviewInputSchema.parse(query.mock.calls[0]![1]).input
    expect(refreshedInput.rollId).toBeUndefined()
    expect(refreshedInput.rollEvidence).toBeUndefined()
    expect(refreshedInput.selectedHitDice).toEqual([{ die: 10, count: 1 }])
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
          clearManualRoll: vi.fn(),
          executeRoll,
          hasManualRoll: false,
          pending: false
        }}
      >
        <CharacterSheetRollDestinationContext.Provider
          value={{
            destination: 'PRIVATE',
            destinationOptions: [],
            setDestination: vi.fn(),
            stateRollDestination: 'PRIVATE',
            stateRollDestinationOptions: []
          }}
        >
          <CharacterSheetOverviewVitals
            pending={false}
            sheet={createSheet()}
            submitCommand={submitCommand}
          />
        </CharacterSheetRollDestinationContext.Provider>
      </CharacterSheetRollContext.Provider>
    )
    await user.click(screen.getByRole('button', { name: /^short rest$/i }))
    await user.click(await screen.findByRole('button', { name: /add one d10 hit die/i }))
    const roll = await screen.findByRole('button', { name: /1d10 \+ 1/i })
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

    const { maxHitPoints } = sheet.overview
    expect(
      within(dialog).getByText(`Restores to ${maxHitPoints} / ${maxHitPoints}`)
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Recovery is calculated automatically')).toBeInTheDocument()
    expect(within(dialog).getByText(/reduces from level 1/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/temp hp clears/i)).toBeInTheDocument()
  })

  it('sends the companions selected for a long rest', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const sheet = createSheet()
    const companion = sheet.extras.items[0]!

    renderWithAppProviders(
      <CharacterSheetOverviewVitals pending={false} sheet={sheet} submitCommand={submitCommand} />
    )

    await user.click(screen.getByRole('button', { name: /^long rest$/i }))
    const dialog = await screen.findByRole('dialog', { name: /^long rest$/i })
    await user.click(await within(dialog).findByLabelText(companion.displayName))
    await user.click(within(dialog).getByRole('button', { name: /take long rest/i }))

    expect(submitCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'COMPLETE_REST',
        restKind: 'LONG',
        selectedCompanionInstanceIds: [companion.id]
      })
    )
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
          const preview = await createRestPreview(characterRestPreviewInputSchema.parse(args).input)
          await earlier
          if (outcome === 'error') throw new Error('Old preview failed')
          return { ...preview, previewFingerprint: 'older-preview' }
        })
        .mockImplementationOnce(async (...[, args]) => ({
          ...(await createRestPreview(characterRestPreviewInputSchema.parse(args).input)),
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
