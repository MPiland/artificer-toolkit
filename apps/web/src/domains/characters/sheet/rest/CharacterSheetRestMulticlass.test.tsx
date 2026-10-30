import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import { afterEach, beforeEach, vi } from 'vitest'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { characterRestPreviewInputSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { playerRollDestinationOptions, playerStateRollDestinationOptions } from '../dice/dice.utils'
import {
  CharacterSheetRollContext,
  CharacterSheetRollDestinationContext
} from '../dice/rollContext'
import {
  createMulticlassRestPreview,
  createMulticlassSheet,
  createSheet
} from '../fixtures/playedCharacters.fixture'
import { CharacterSheetOverviewVitals } from '../vitals/CharacterSheetOverviewVitals'

const hitDieRoll = rollRecordDtoSchema.parse({
  id: '00000000-0000-4000-8000-000000000098',
  characterId: 'character-1',
  characterLabel: 'Test Character',
  source: { kind: 'HIT_DIE', label: 'Short rest hit dice' },
  ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
  normalizedExpression: '1d10 + 1d8 + 2',
  evidence: {
    terms: [
      { count: 1, die: 10, rolls: [6], subtotal: 6 },
      { count: 1, die: 8, rolls: [5], subtotal: 5 }
    ],
    modifier: 2,
    mode: 'NORMAL',
    keep: 'FIRST',
    subtotal: 11,
    transform: { kind: 'NONE' },
    total: 13
  },
  createdAt: '2026-07-31T12:00:00.000Z'
})

describe('Character Sheet rests for the played Fighter 2 / Rogue 1', () => {
  afterEach(() => vi.restoreAllMocks())

  beforeEach(() => {
    vi.spyOn(ConvexReactClient.prototype, 'query').mockImplementation(
      async (...[reference, args]) => {
        expect(getFunctionName(reference)).toBe(getFunctionName(api.characters.rest.preview))
        return createMulticlassRestPreview(characterRestPreviewInputSchema.parse(args).input)
      }
    )
  })

  it('offers mixed hit dice and the Max HP adjustment in the short rest', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetRollContext.Provider
        value={{
          clearManualRoll: vi.fn(),
          executeRoll: vi.fn().mockResolvedValue(hitDieRoll),
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
            sheet={createMulticlassSheet()}
            submitCommand={submitCommand}
          />
        </CharacterSheetRollDestinationContext.Provider>
      </CharacterSheetRollContext.Provider>
    )

    await user.click(screen.getByRole('button', { name: /^short rest$/i }))
    const dialog = await screen.findByRole('dialog', { name: /^short rest$/i })
    expect(
      await within(dialog).findByLabelText('Remove the current Max HP adjustment')
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Add one d10 hit die' }))
    const addD8 = within(dialog).getByRole('button', { name: 'Add one d8 hit die' })
    await waitFor(() => expect(addD8).toBeEnabled())
    await user.click(addD8)
    const roll = await within(dialog).findByRole('button', { name: 'Roll 1d10 + 1d8 + 2' })
    await waitFor(() => expect(roll).toBeEnabled())

    await user.click(roll)
    expect(await within(dialog).findByText('13 rolled')).toBeInTheDocument()
    expect(within(dialog).getByText('12 HP selected')).toBeInTheDocument()
  })

  it('previews a long rest to the adjusted maximum', async () => {
    const user = userEvent.setup()
    const sheet = createMulticlassSheet()

    renderWithAppProviders(
      <CharacterSheetOverviewVitals pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    await user.click(screen.getByRole('button', { name: /^long rest$/i }))
    const dialog = await screen.findByRole('dialog', { name: /^long rest$/i })
    const { maxHitPoints } = sheet.overview
    expect(
      await within(dialog).findByText(`Restores to ${maxHitPoints} / ${maxHitPoints}`)
    ).toBeInTheDocument()
  })

  // Story rest previews are routed by Character id, so the two played Characters must not share one.
  it('is a different Character from the played Fighter', () => {
    expect(createMulticlassSheet().meta.characterId).not.toBe(createSheet().meta.characterId)
  })
})
