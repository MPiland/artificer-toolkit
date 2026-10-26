import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { tabletopCampaignId } from '#domains/campaigns/vtt/CampaignTabletop.stories.fixtures'
import { CharacterSheetFixtureView as CharacterSheetView } from '../fixtures/CharacterSheetFixtureView'
import {
  createMovementPanel,
  createRestPreview,
  createSheet,
  openHpControls
} from '../tests/sheetTestHarness'
import { characterSheetPanelInputSchema } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { characterRestPreviewInputSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { characterSheetSliceSchema } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { projectCharacterSheetSlice } from '@artificer-toolkit/rules-runtime/character/sheetSlices'

function mockSheetSliceReads(
  convexClient: ConvexReactClient,
  sheet: ReturnType<typeof createSheet>
) {
  const read = (reference: Parameters<ConvexReactClient['query']>[0], args: unknown) => {
    if (getFunctionName(reference) === getFunctionName(convexApi.characters.panels.get)) {
      const { target } = characterSheetPanelInputSchema.parse(args)
      if (target.kind !== 'MOVEMENT') throw new Error('Unexpected Sheet test panel.')
      return createMovementPanel()
    }
    if (
      getFunctionName(reference) !== getFunctionName(convexApi.characters.sheetSlices.get) ||
      !args ||
      typeof args !== 'object' ||
      !('slice' in args)
    )
      throw new Error('Unexpected Sheet test query.')
    return projectCharacterSheetSlice(sheet, characterSheetSliceSchema.parse(args.slice))
  }
  vi.spyOn(convexClient, 'query').mockImplementation(async (...[reference, args]) =>
    read(reference, args)
  )
  vi.spyOn(convexClient, 'watchQuery').mockImplementation((...[reference, args]) => ({
    localQueryResult: () => read(reference, args),
    journal: () => undefined,
    onUpdate: () => () => undefined
  }))
  return read
}

const diceCanvasMocks = vi.hoisted(() => ({
  onRollSettled: undefined as ((rollId: string) => void) | undefined,
  preloadDiceModels: vi.fn()
}))
vi.mock('#app/components/dice/dice.utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#app/components/dice/dice.utils')>()),
  supportsWebGL: () => true
}))

vi.mock('#app/components/dice/diceModelPreload', () => ({
  preloadDiceModels: diceCanvasMocks.preloadDiceModels
}))

vi.mock('#app/components/dice/DiceCanvas', () => ({
  default: ({
    roll,
    onRollSettled
  }: {
    onRollSettled: (rollId: string) => void
    roll?: { id: string }
  }) => {
    diceCanvasMocks.onRollSettled = onRollSettled
    return <div data-testid='dice-canvas'>{roll?.id ?? 'idle'}</div>
  }
}))

const canceledRollId = '00000000-0000-4000-8000-000000000112'
const restRollId = '00000000-0000-4000-8000-000000000113'
const liveCharacterId = '33333333-3333-4333-8333-333333333333'
const realSheet = createSheet()
const sheetCharacterId = realSheet.meta.characterId
const strength = realSheet.overview.abilities.find((entry) => entry.ability === 'STRENGTH')
if (!strength) throw new Error('Expected the Strength ability on the Sheet.')
const strengthModifier = strength.modifier
const strengthExpression = `1d20 + ${strengthModifier}`
const strengthTotal = 14 + strengthModifier

function createRollRecord(id: string) {
  return rollRecordDtoSchema.parse({
    id,
    characterId: sheetCharacterId,
    characterLabel: 'Aria',
    source: { kind: 'ABILITY_CHECK', label: 'Strength check' },
    ruleset: { systemId: realSheet.meta.systemId, code: 'DND5E_2014', version: '1' },
    normalizedExpression: strengthExpression,
    evidence: {
      terms: [{ count: 1, die: 20, rolls: [14], subtotal: 14 }],
      modifier: strengthModifier,
      mode: 'NORMAL',
      keep: 'FIRST',
      subtotal: 14,
      transform: { kind: 'NONE' },
      total: strengthTotal
    },
    createdAt: '2026-07-30T18:00:00.000Z'
  })
}

describe('Character Sheet shell', () => {
  beforeEach(() => {
    diceCanvasMocks.preloadDiceModels.mockReset()
    diceCanvasMocks.onRollSettled = undefined
  })

  it('rolls the displayed ability modifier and adds the authoritative result to history', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      'artificer:dice-presentation:v1',
      JSON.stringify({
        animate3d: false,
        postProcessing: true,
        shadowQuality: 'MEDIUM'
      })
    )
    const rollRecord = createRollRecord('00000000-0000-4000-8000-000000000111')

    const convexClient = new ConvexReactClient('https://sheet-test.convex.cloud')
    const executeRoll = vi.spyOn(convexClient, 'mutation').mockResolvedValue(rollRecord)
    vi.spyOn(convexClient, 'query').mockResolvedValue([rollRecord])
    vi.spyOn(convexClient, 'watchQuery').mockReturnValue({
      localQueryResult: () => [rollRecord],
      journal: () => undefined,
      onUpdate: () => () => undefined
    })

    try {
      renderWithAppProviders(
        <CharacterSheetView
          characterPublicId='character-1'
          hasDraft={false}
          rollerName='Tess'
          sheet={createSheet()}
        />,
        { convexClient }
      )

      await user.click(
        screen.getByRole('button', { name: `Roll Strength check: ${strengthExpression}` })
      )

      await waitFor(() =>
        expect(executeRoll.mock.calls[0]?.[1]).toMatchObject({
          characterId: sheetCharacterId,
          expression: strengthExpression,
          source: { kind: 'ABILITY_CHECK', label: 'Strength check' }
        })
      )
      expect(getFunctionName(executeRoll.mock.calls[0]![0])).toBe(
        getFunctionName(convexApi.rolls.execute)
      )
      expect(await screen.findByText(`Rolled ${strengthTotal}`)).toBeInTheDocument()
      expect(diceCanvasMocks.preloadDiceModels).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Open roll history' }))
      expect(await screen.findByText('Tess')).toBeInTheDocument()
      expect(
        within(screen.getByRole('dialog', { name: 'Roll history' })).getByText(/d20 \[14\]/i)
      ).toBeInTheDocument()
    } finally {
      window.localStorage.removeItem('artificer:dice-presentation:v1')
      await convexClient.close()
    }
  })

  it('shows immediate roll feedback and cancels active dice from the next sheet click', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    const rollRecord = createRollRecord(canceledRollId)
    let discardedRoll: unknown
    let releaseRoll!: () => void
    const rollGate = new Promise<void>((resolve) => {
      releaseRoll = resolve
    })
    const convexClient = new ConvexReactClient('https://sheet-test.convex.cloud')
    mockSheetSliceReads(convexClient, sheet)
    window.localStorage.setItem(
      'artificer:dice-presentation:v1',
      JSON.stringify({
        animate3d: true,
        postProcessing: true,
        shadowQuality: 'MEDIUM'
      })
    )

    vi.spyOn(convexClient, 'mutation').mockImplementation(async (...[reference, args]) => {
      if (getFunctionName(reference) === getFunctionName(convexApi.rolls.execute)) {
        await rollGate
        return rollRecord
      }
      if (getFunctionName(reference) === getFunctionName(convexApi.rolls.discard)) {
        discardedRoll = args
        return { ok: true }
      }
      throw new Error('Unexpected Sheet test mutation.')
    })

    try {
      renderWithAppProviders(
        <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={sheet} />,
        { convexClient }
      )

      const rollTarget = screen.getByRole('button', {
        name: `Roll Strength check: ${strengthExpression}`
      })
      await user.click(rollTarget)
      expect(rollTarget).toHaveAttribute('aria-busy', 'true')
      expect(await screen.findByTestId('dice-canvas')).toHaveTextContent('idle')

      await user.click(screen.getByRole('heading', { name: 'Aria' }))
      releaseRoll()

      await waitFor(() => expect(screen.getByTestId('dice-canvas')).toHaveTextContent('idle'))
      await waitFor(() => expect(discardedRoll).toEqual({ id: canceledRollId }))
      expect(screen.queryByText(`Rolled ${strengthTotal}`)).not.toBeInTheDocument()
    } finally {
      window.localStorage.removeItem('artificer:dice-presentation:v1')
      await convexClient.close()
    }
  })

  it('waits for dice presentation before applying rest evidence and cancels an unrevealed roll', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    const hitDie = sheet.overview.hitDice[0]
    const constitution = sheet.overview.abilities.find((entry) => entry.ability === 'CONSTITUTION')
    if (!hitDie || !constitution) throw new Error('Expected a Hit Die and Constitution.')
    const restExpression = `1d${hitDie.die} + ${constitution.modifier}`
    const roll = rollRecordDtoSchema.parse({
      ...createRollRecord(restRollId),
      source: { kind: 'HIT_DIE', label: 'Short rest hit dice' },
      normalizedExpression: restExpression,
      evidence: {
        ...createRollRecord(restRollId).evidence,
        terms: [{ count: 1, die: hitDie.die, rolls: [5], subtotal: 5 }],
        modifier: constitution.modifier,
        subtotal: 5,
        total: 5 + constitution.modifier
      }
    })
    let rollNumber = 0
    const convexClient = new ConvexReactClient('https://sheet-test.convex.cloud')
    const readSlice = mockSheetSliceReads(convexClient, sheet)
    const mutation = vi
      .spyOn(convexClient, 'mutation')
      .mockImplementation(async (...[reference, _args]) => {
        if (getFunctionName(reference) === getFunctionName(convexApi.rolls.execute)) {
          rollNumber += 1
          return {
            ...roll,
            id:
              rollNumber === 1
                ? '00000000-0000-4000-8000-000000000101'
                : '00000000-0000-4000-8000-000000000102'
          }
        }
        if (getFunctionName(reference) === getFunctionName(convexApi.rolls.discard))
          return { ok: true }
        if (
          getFunctionName(reference) === getFunctionName(convexApi.characters.sheetCommands.execute)
        ) {
          return {
            characterId: sheet.meta.characterId,
            streamVersion: 5,
            sheet
          }
        }
        throw new Error('Unexpected mutation')
      })
    vi.spyOn(convexClient, 'query').mockImplementation(async (...[reference, args]) => {
      if (getFunctionName(reference) === getFunctionName(convexApi.characters.rest.preview)) {
        return createRestPreview(characterRestPreviewInputSchema.parse(args).input)
      }
      return readSlice(reference, args)
    })
    window.localStorage.setItem(
      'artificer:dice-presentation:v1',
      JSON.stringify({
        animate3d: true,
        postProcessing: true,
        shadowQuality: 'MEDIUM'
      })
    )
    try {
      renderWithAppProviders(
        <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={sheet} />,
        { convexClient }
      )
      await user.click(screen.getByRole('button', { name: /^short rest$/i }))
      const dialog = await screen.findByRole('dialog', {
        name: /^short rest$/i
      })
      await user.click(
        within(dialog).getByRole('button', { name: `Add one d${hitDie.die} hit die` })
      )
      const reroll = await within(dialog).findByRole('button', {
        name: `Roll ${restExpression}`
      })
      await waitFor(() => expect(reroll).toBeEnabled())
      await user.click(reroll)
      await waitFor(() =>
        expect(screen.getByTestId('dice-canvas')).toHaveTextContent(
          '00000000-0000-4000-8000-000000000101'
        )
      )
      expect(within(dialog).queryByText(/6 rolled/i)).not.toBeInTheDocument()
      await user.click(screen.getByRole('heading', { name: 'Aria' }))
      await waitFor(() =>
        expect(
          mutation.mock.calls.some(
            ([reference, args]) =>
              getFunctionName(reference) === getFunctionName(convexApi.rolls.discard) &&
              (args as { id: string }).id === '00000000-0000-4000-8000-000000000101'
          )
        ).toBe(true)
      )
      expect(within(dialog).queryByText(/6 rolled/i)).not.toBeInTheDocument()
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: /^short rest$/i })).not.toBeInTheDocument()
      )
      await user.click(screen.getByRole('button', { name: /^short rest$/i }))
      const reopenedDialog = await screen.findByRole('dialog', {
        name: /^short rest$/i
      })
      const addHitDie = within(reopenedDialog).getByRole('button', {
        name: `Add one d${hitDie.die} hit die`
      })
      await waitFor(() => expect(addHitDie).toBeEnabled())
      await user.click(addHitDie)
      const revealedReroll = await within(reopenedDialog).findByRole('button', {
        name: `Roll ${restExpression}`
      })
      await waitFor(() => expect(revealedReroll).toBeEnabled())
      await user.click(revealedReroll)
      await waitFor(() =>
        expect(screen.getByTestId('dice-canvas')).toHaveTextContent(
          '00000000-0000-4000-8000-000000000102'
        )
      )
      await act(async () => diceCanvasMocks.onRollSettled?.('00000000-0000-4000-8000-000000000102'))
      expect((await within(reopenedDialog).findAllByText(/6 rolled/i)).length).toBeGreaterThan(0)
      await user.click(
        within(reopenedDialog).getByRole('button', {
          name: /take short rest/i
        })
      )
      await waitFor(() =>
        expect(
          mutation.mock.calls.some(
            ([reference, args]) =>
              getFunctionName(reference) ===
                getFunctionName(convexApi.characters.sheetCommands.execute) &&
              (args as { command: { rollId?: string } }).command.rollId ===
                '00000000-0000-4000-8000-000000000102'
          )
        ).toBe(true)
      )
    } finally {
      window.localStorage.removeItem('artificer:dice-presentation:v1')
      await convexClient.close()
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

  it('shows the primary Speed and opens the Movement panel listing every speed from it', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    const speed = sheet.overview.facts.find((fact) => fact.label === 'Speed')
    if (!speed) throw new Error('Expected a Speed fact on the Sheet.')
    const movement = createMovementPanel()
    if (movement.kind !== 'MOVEMENT') throw new Error('Expected a Movement panel.')
    const convexClient = new ConvexReactClient('https://sheet-test.convex.cloud')
    mockSheetSliceReads(convexClient, sheet)

    try {
      renderWithAppProviders(
        <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={sheet} />,
        { convexClient }
      )

      await user.click(
        screen.getByRole('button', {
          name: (name) => name.startsWith('Speed') && name.endsWith(speed.value)
        })
      )

      const panel = await screen.findByRole('dialog', { name: 'Movement' })
      expect(movement.speeds.some((entry) => entry.speedKind === 'HELD')).toBe(true)
      expect(movement.speeds.some((entry) => entry.speedKind === 'NOT_HELD')).toBe(true)
      for (const entry of movement.speeds) {
        expect(
          await within(panel).findByText(
            entry.speedKind === 'HELD'
              ? `${entry.label}: ${entry.amount} ${entry.unitLabel}`
              : `${entry.label}: not held. Set a speed to add it.`
          )
        ).toBeInTheDocument()
      }
    } finally {
      await convexClient.close()
    }
  })

  it('submits sheet commands through the native command mutation path', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    const convexClient = new ConvexReactClient('https://sheet-test.convex.cloud')
    mockSheetSliceReads(convexClient, sheet)
    const execute = vi.spyOn(convexClient, 'mutation').mockResolvedValue({
      characterId: sheet.meta.characterId,
      streamVersion: 5,
      sheet
    })

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={sheet} />,
      { convexClient }
    )

    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /^damage$/i }))

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    expect(getFunctionName(execute.mock.calls[0]![0])).toBe(
      getFunctionName(convexApi.characters.sheetCommands.execute)
    )
    expect(execute.mock.calls[0]?.[1]).toMatchObject({
      id: sheet.meta.characterId,
      command: { type: 'ADJUST_HIT_POINTS', expectedVersion: 4 }
    })
    await convexClient.close()
  })

  it('submits a campaign GM HP change through the campaign command mutation', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.meta.campaignId = tabletopCampaignId
    sheet.meta.characterId = liveCharacterId
    const convexClient = new ConvexReactClient('https://sheet-test.convex.cloud')
    mockSheetSliceReads(convexClient, sheet)
    const execute = vi.spyOn(convexClient, 'mutation').mockResolvedValue({
      characterId: sheet.meta.characterId,
      streamVersion: 5,
      sheet
    })
    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={sheet} />,
      { convexClient }
    )
    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /^damage$/i }))
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    expect(getFunctionName(execute.mock.calls[0]![0])).toBe(
      getFunctionName(convexApi.campaigns.characterSheet.execute)
    )
    expect(execute.mock.calls[0]?.[1]).toMatchObject({
      campaignId: tabletopCampaignId,
      characterId: sheet.meta.characterId,
      command: { type: 'ADJUST_HIT_POINTS', expectedVersion: 4 }
    })
    await convexClient.close()
  })

  it('shows sheet command errors from the production command mutation path', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    const convexClient = new ConvexReactClient('https://sheet-test.convex.cloud')
    mockSheetSliceReads(convexClient, sheet)
    vi.spyOn(convexClient, 'mutation').mockRejectedValue(
      new Error('This character changed in another tab. Refresh the sheet, then try again.')
    )

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft sheet={sheet} />,
      { convexClient }
    )

    expect(screen.getByText(/builder draft work/i)).toBeInTheDocument()
    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /^damage$/i }))

    expect(await screen.findByText(/changed in another tab/i)).toBeInTheDocument()
    await convexClient.close()
  })

  it('reacts when the requested initial sheet tab changes', async () => {
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
    expect(await screen.findByRole('heading', { name: /^spells$/i })).toBeInTheDocument()

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
    expect(await screen.findByRole('heading', { name: /^inventory$/i })).toBeInTheDocument()
  })

  it('hides player-private and Builder controls from a Campaign GM viewer', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.meta.viewer = 'CAMPAIGN_OWNER'
    sheet.meta.capabilities = {
      managePlayState: true,
      managePrivateNotes: false,
      manageInventory: false,
      openBuilder: false,
      endActiveEffects: true,
      removeConsequences: true
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
