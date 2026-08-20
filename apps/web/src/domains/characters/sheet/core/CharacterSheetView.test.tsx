import { screen, waitFor, within } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { server } from '#test/msw/server'
import { queryKeys } from '#app/lib/queryKeys'
import {
  tabletopCampaignId,
  tabletopSession
} from '#domains/campaigns/vtt/CampaignTabletop.stories.fixtures'
import { CharacterSheetView } from './CharacterSheetView'
import {
  createSheet,
  openHpControls,
  readBatchedInput,
  trpcErrorJson,
  trpcJson
} from '../tests/sheetTestHarness'

const diceCanvasMocks = vi.hoisted(() => ({ preloadDiceModels: vi.fn() }))
const liveSessionMocks = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  getAggregateVersion: vi.fn(() => 0)
}))

vi.mock('#domains/campaigns/vtt/useCampaignLiveSession', () => ({
  useCampaignLiveSession: () => ({
    encounterCommandPending: false,
    error: null,
    executeCommand: liveSessionMocks.executeCommand,
    getAggregateVersion: liveSessionMocks.getAggregateVersion,
    sendCommand: vi.fn(),
    sendTransient: vi.fn(),
    state: { aggregateVersions: [], deliverySequence: 0, scenes: [] },
    status: 'CONNECTED' as const
  })
}))

vi.mock('../dice/dice.utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../dice/dice.utils')>()),
  supportsWebGL: () => true
}))

vi.mock('../dice/diceModelPreload', () => ({
  preloadDiceModels: diceCanvasMocks.preloadDiceModels
}))

vi.mock('../dice/DiceCanvas', () => ({
  default: ({ roll }: { roll?: { id: string } }) => (
    <div data-testid='dice-canvas'>{roll?.id ?? 'idle'}</div>
  )
}))

const liveCharacterId = '33333333-3333-4333-8333-333333333333'
const liveAttendance = [
  {
    campaignId: tabletopCampaignId,
    characterId: liveCharacterId,
    present: true,
    sessionId: tabletopSession.id
  }
]

function LiveCharacterSheetHarness({
  onClient,
  sheet
}: {
  onClient?: (client: ReturnType<typeof useQueryClient>) => void
  sheet: ReturnType<typeof createSheet>
}) {
  const queryClient = useQueryClient()
  onClient?.(queryClient)
  if (!queryClient.getQueryData(queryKeys.campaigns.sessions(tabletopCampaignId))) {
    queryClient.setQueryData(queryKeys.campaigns.sessions(tabletopCampaignId), [tabletopSession])
  }
  if (
    !queryClient.getQueryData(
      queryKeys.campaigns.sessionAttendance(tabletopCampaignId, tabletopSession.id)
    )
  ) {
    queryClient.setQueryData(
      queryKeys.campaigns.sessionAttendance(tabletopCampaignId, tabletopSession.id),
      liveAttendance
    )
  }
  if (!queryClient.getQueryData(queryKeys.characters.sheet(sheet.meta.characterId))) {
    queryClient.setQueryData(queryKeys.characters.sheet(sheet.meta.characterId), sheet)
  }
  return <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={sheet} />
}

function createRollRecord(id: string) {
  return {
    id,
    characterId: 'character-1',
    characterLabel: 'Aria',
    source: { kind: 'ABILITY_CHECK' as const, label: 'Strength check' },
    ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
    normalizedExpression: '1d20',
    evidence: {
      terms: [{ count: 1, die: 20 as const, rolls: [14], subtotal: 14 }],
      modifier: 0,
      mode: 'NORMAL' as const,
      subtotal: 14,
      transform: { kind: 'NONE' as const },
      total: 14
    },
    createdAt: '2026-07-30T18:00:00.000Z'
  }
}

describe('Character Sheet shell', () => {
  beforeEach(() => {
    diceCanvasMocks.preloadDiceModels.mockReset()
    liveSessionMocks.executeCommand.mockReset()
    liveSessionMocks.getAggregateVersion.mockReset()
    liveSessionMocks.getAggregateVersion.mockReturnValue(0)
  })

  it('rolls the displayed ability modifier and adds the authoritative result to history', async () => {
    const user = userEvent.setup()
    let submittedRoll: unknown
    window.localStorage.setItem(
      'artificer:dice-presentation:v1',
      JSON.stringify({ animate3d: false, postProcessing: true, shadowQuality: 'MEDIUM' })
    )
    const rollRecord = createRollRecord('roll-1')

    server.use(
      http.post('*/api/trpc/rolls.execute', async ({ request }) => {
        const body = await request.json()
        submittedRoll = readBatchedInput<unknown>(body)
        return trpcJson(rollRecord)
      }),
      http.get('*/api/trpc/rolls.history', () => trpcJson([rollRecord]))
    )

    try {
      renderWithAppProviders(
        <CharacterSheetView
          characterPublicId='character-1'
          hasDraft={false}
          rollerName='Tess'
          sheet={createSheet()}
        />
      )

      await user.click(screen.getByRole('button', { name: 'Roll Strength check: 1d20' }))

      await waitFor(() =>
        expect(submittedRoll).toMatchObject({
          characterId: 'character-1',
          expression: '1d20',
          source: { kind: 'ABILITY_CHECK', label: 'Strength check' }
        })
      )
      expect(await screen.findByText('Rolled 14')).toBeInTheDocument()
      expect(diceCanvasMocks.preloadDiceModels).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Open roll history' }))
      expect(await screen.findByText('Tess')).toBeInTheDocument()
      expect(
        within(screen.getByRole('dialog', { name: 'Roll history' })).getByText(/d20 \[14\]/i)
      ).toBeInTheDocument()
    } finally {
      window.localStorage.removeItem('artificer:dice-presentation:v1')
    }
  })

  it('shows immediate roll feedback and cancels active dice from the next sheet click', async () => {
    const user = userEvent.setup()
    const rollRecord = createRollRecord('roll-cancel')
    let discardedRoll: unknown
    let releaseRoll!: () => void
    const rollGate = new Promise<void>((resolve) => {
      releaseRoll = resolve
    })
    window.localStorage.setItem(
      'artificer:dice-presentation:v1',
      JSON.stringify({ animate3d: true, postProcessing: true, shadowQuality: 'MEDIUM' })
    )

    server.use(
      http.post('*/api/trpc/rolls.execute', async () => {
        await rollGate
        return trpcJson(rollRecord)
      }),
      http.post('*/api/trpc/rolls.discard', async ({ request }) => {
        discardedRoll = readBatchedInput<unknown>(await request.json())
        return trpcJson({ ok: true })
      })
    )

    try {
      renderWithAppProviders(
        <CharacterSheetView
          characterPublicId='character-1'
          hasDraft={false}
          sheet={createSheet()}
        />
      )

      const rollTarget = screen.getByRole('button', { name: 'Roll Strength check: 1d20' })
      await user.click(rollTarget)
      expect(rollTarget).toHaveAttribute('aria-busy', 'true')
      expect(await screen.findByTestId('dice-canvas')).toHaveTextContent('idle')

      releaseRoll()
      await waitFor(() =>
        expect(screen.getByTestId('dice-canvas')).toHaveTextContent('roll-cancel')
      )

      await user.click(screen.getByRole('heading', { name: 'Aria' }))

      await waitFor(() => expect(screen.getByTestId('dice-canvas')).toHaveTextContent('idle'))
      await waitFor(() => expect(discardedRoll).toEqual({ id: 'roll-cancel' }))
      expect(screen.queryByText('Rolled 14')).not.toBeInTheDocument()
    } finally {
      window.localStorage.removeItem('artificer:dice-presentation:v1')
    }
  })

  it('opens the manual roller and adds another dice row', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={createSheet()} />
    )

    await user.click(screen.getByRole('button', { name: 'Open manual dice roller' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add another die' }))

    expect(within(dialog).getByLabelText('Number of dice for row 2')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Modifier for row 2')).toBeInTheDocument()
  })

  it('submits sheet commands through the production command mutation path', async () => {
    const user = userEvent.setup()
    let submittedCommand: unknown

    server.use(
      http.post('*/api/trpc/characters.command', async ({ request }) => {
        const body = await request.json()
        submittedCommand = readBatchedInput<{ id: string; input: unknown }>(body).input
        const sheet = createSheet()
        sheet.meta.streamVersion = 5

        return trpcJson({
          characterId: sheet.meta.characterId,
          streamVersion: sheet.meta.streamVersion,
          sheet
        })
      })
    )

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={createSheet()} />
    )

    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /^damage$/i }))

    await waitFor(() =>
      expect(submittedCommand).toMatchObject({
        type: 'ADJUST_HIT_POINTS',
        expectedVersion: 4
      })
    )
  })

  it('routes an attended live-session character through the authoritative socket command', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.meta.campaignId = tabletopCampaignId
    sheet.meta.characterId = liveCharacterId
    let httpCommandCalled = false
    let refetchQueries: ReturnType<typeof vi.spyOn> | undefined

    server.use(
      http.all('*/api/trpc/campaigns.sessions.list', () => trpcJson([tabletopSession])),
      http.all('*/api/trpc/campaigns.sessions.attendance.list', () => trpcJson(liveAttendance)),
      http.post('*/api/trpc/characters.command', () => {
        httpCommandCalled = true
        return trpcJson({ characterId: sheet.meta.characterId, sheet, streamVersion: 5 })
      })
    )
    liveSessionMocks.executeCommand.mockImplementation(async (command) => {
      return {
        acceptedSequence: 1,
        aggregateId: sheet.meta.characterId,
        aggregateKind: 'CHARACTER' as const,
        deliverySequence: 1,
        originCommandId: command.command.commandId,
        replayed: false,
        response: null,
        type: 'COMMAND_COMMITTED' as const,
        version: 5
      }
    })

    renderWithAppProviders(
      <LiveCharacterSheetHarness
        onClient={(client) => {
          refetchQueries ??= vi.spyOn(client, 'refetchQueries')
        }}
        sheet={sheet}
      />
    )

    await waitFor(
      () => expect(screen.getByRole('button', { name: /manage (?:hp|hit points)/i })).toBeEnabled(),
      { timeout: 5_000 }
    )
    await openHpControls(user)
    const damage = screen.getByRole('button', { name: /^damage$/i })
    await waitFor(() => expect(damage).toBeEnabled())
    await user.click(damage)

    await waitFor(() => expect(liveSessionMocks.executeCommand).toHaveBeenCalledTimes(1))
    expect(liveSessionMocks.executeCommand).toHaveBeenCalledWith({
      aggregateKind: 'CHARACTER',
      characterId: sheet.meta.characterId,
      command: expect.objectContaining({ expectedVersion: 4, type: 'ADJUST_HIT_POINTS' })
    })
    expect(httpCommandCalled).toBe(false)
    await waitFor(() =>
      expect(refetchQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.characters.sheet(sheet.meta.characterId),
        exact: true
      })
    )
  })

  it('does not apply a delayed live command response older than the room version', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.meta.campaignId = tabletopCampaignId
    sheet.meta.characterId = liveCharacterId
    liveSessionMocks.getAggregateVersion.mockReturnValue(6)
    liveSessionMocks.executeCommand.mockImplementation(async (command) => {
      const replayedSheet = structuredClone(sheet)
      replayedSheet.meta.streamVersion = 5
      return {
        acceptedSequence: 1,
        aggregateId: sheet.meta.characterId,
        aggregateKind: 'CHARACTER' as const,
        deliverySequence: 1,
        originCommandId: command.command.commandId,
        replayed: true,
        response: {
          characterId: sheet.meta.characterId,
          sheet: replayedSheet,
          streamVersion: 5
        },
        type: 'COMMAND_COMMITTED' as const,
        version: 5
      }
    })

    let queryClient: ReturnType<typeof useQueryClient> | undefined
    renderWithAppProviders(
      <LiveCharacterSheetHarness
        onClient={(client) => {
          queryClient = client
        }}
        sheet={sheet}
      />
    )

    await waitFor(
      () => expect(screen.getByRole('button', { name: /manage (?:hp|hit points)/i })).toBeEnabled(),
      { timeout: 5_000 }
    )
    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /^damage$/i }))
    await waitFor(() => expect(liveSessionMocks.executeCommand).toHaveBeenCalledTimes(1))

    expect(
      queryClient?.getQueryData<ReturnType<typeof createSheet>>(
        queryKeys.characters.sheet(sheet.meta.characterId)
      )?.meta.streamVersion
    ).toBe(4)
  })

  it('shows sheet command errors from the production command mutation path', async () => {
    const user = userEvent.setup()

    server.use(
      http.post('*/api/trpc/characters.command', () =>
        trpcErrorJson(
          'This character changed in another tab. Refresh the sheet, then try again.',
          409
        )
      )
    )

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft sheet={createSheet()} />
    )

    expect(screen.getByText(/builder draft work/i)).toBeInTheDocument()
    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /^damage$/i }))

    expect(await screen.findByText(/changed in another tab/i)).toBeInTheDocument()
  })

  it('reacts when the requested initial sheet tab changes', () => {
    const sheet = createSheet()
    sheet.spells.attackBonus = 5
    const { rerender } = renderWithAppProviders(
      <CharacterSheetView
        characterPublicId='character-1'
        hasDraft={false}
        initialTab='spells'
        sheet={sheet}
      />
    )

    expect(screen.getByRole('tab', { name: /spells/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /^spells$/i })).toBeInTheDocument()

    rerender(
      <CharacterSheetView
        characterPublicId='character-1'
        hasDraft={false}
        initialTab='inventory'
        sheet={sheet}
      />
    )

    expect(screen.getByRole('tab', { name: /^inventory$/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('heading', { name: /^inventory$/i })).toBeInTheDocument()
  })

  it('hides player-private and Builder controls from a Campaign GM viewer', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.meta.viewer = 'CAMPAIGN_OWNER'
    sheet.meta.capabilities = {
      managePlayState: true,
      managePrivateNotes: false,
      manageInventory: false,
      openBuilder: false
    }

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={sheet} />
    )

    expect(screen.queryByRole('tab', { name: /^notes$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit character/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^inventory$/i }))
    expect(screen.queryByRole('button', { name: /manage equipment/i })).not.toBeInTheDocument()
  })

  it('keeps skills and proficiencies in the tablet overview instead of duplicating tabs', () => {
    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={createSheet()} />
    )

    const tabList = screen.getByRole('tablist')
    expect(within(tabList).getByRole('tab', { name: /^overview$/i })).toBeInTheDocument()
    expect(within(tabList).queryByRole('tab', { name: /^skills$/i })).not.toBeInTheDocument()
    expect(within(tabList).queryByRole('tab', { name: /^proficiencies$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^skills$/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^proficiencies$/i })).toBeInTheDocument()
  })

  it('renders the overview and workspace together without waiting for viewport effects', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={createSheet()} />
    )

    const tabList = screen.getByRole('tablist')
    expect(within(tabList).getByRole('tab', { name: /^overview$/i })).toBeInTheDocument()
    expect(within(tabList).queryByRole('tab', { name: /^skills$/i })).not.toBeInTheDocument()
    expect(within(tabList).queryByRole('tab', { name: /^proficiencies$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^skills$/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^overview$/i })).toBeInTheDocument()

    await user.click(within(tabList).getByRole('tab', { name: /^actions$/i }))

    expect(screen.getByRole('region', { name: /^skills$/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^overview$/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^actions$/i })).toBeInTheDocument()
  })
})
