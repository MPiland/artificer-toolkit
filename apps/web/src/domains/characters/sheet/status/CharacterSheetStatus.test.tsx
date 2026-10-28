import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetOverview } from '../overview/CharacterSheetOverview'
import { createSheet } from '../tests/sheetTestHarness'
import { CharacterSheetOverviewVitals } from '../vitals/CharacterSheetOverviewVitals'
import { CharacterSheetOverviewStatusStrip } from './CharacterSheetOverviewStatusStrip'

const poisoned = createSheet().reference.conditionOptions.find(
  (option) => option.label === 'Poisoned'
)
if (!poisoned) throw new Error('Expected the Poisoned condition option on the Sheet.')

describe('Character Sheet status', () => {
  it('locks overview health and status controls while a sheet command is pending', () => {
    const sheet = createSheet()
    sheet.overview.exhaustion.level = 1

    renderWithAppProviders(
      <>
        <CharacterSheetOverviewVitals pending sheet={sheet} submitCommand={vi.fn()} />
        <CharacterSheetOverview sheet={sheet} />
        <CharacterSheetOverviewStatusStrip pending sheet={sheet} submitCommand={vi.fn()} />
      </>
    )

    expect(screen.getByRole('button', { name: /manage (?:hp|hit points)/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /manage exhaustion/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /add condition/i })).toBeDisabled()
  })

  it('adds conditions with notes from the compact status strip', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /add condition/i }))
    await user.click(await screen.findByPlaceholderText(/add condition/i))
    await user.click(await screen.findByText(/poisoned/i))
    expect(screen.getByText(/disadvantage on attack rolls and ability checks/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/condition notes/i), 'Spider venom')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADD_CONDITION',
      conditionTypeId: poisoned.id,
      notes: 'Spider venom',
      expectedVersion: 4
    })
  })

  it('does not offer a levelled condition in the add-condition list', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.reference.conditionOptions.push({
      id: 'condition-weariness',
      code: 'WEARINESS',
      label: 'Weariness',
      levelled: true
    })

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    await user.click(screen.getByRole('button', { name: /add condition/i }))
    await user.click(await screen.findByPlaceholderText(/add condition/i))
    expect(await screen.findByText(/poisoned/i)).toBeInTheDocument()
    expect(screen.queryByText(/weariness/i)).not.toBeInTheDocument()
  })

  it('keeps condition drafts when saving fails', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(false)

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /add condition/i }))
    await user.click(await screen.findByPlaceholderText(/add condition/i))
    await user.click(await screen.findByText(/poisoned/i))
    await user.type(screen.getByLabelText(/condition notes/i), 'Spider venom')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    expect(screen.getByLabelText(/condition notes/i)).toHaveValue('Spider venom')
    expect(screen.getByRole('alert')).toHaveTextContent(/condition could not be saved/i)
  })

  it('locks condition controls while a sheet command is pending', () => {
    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip pending sheet={createSheet()} submitCommand={vi.fn()} />
    )

    expect(screen.getByRole('button', { name: /add condition/i })).toBeDisabled()
  })

  it('opens exhaustion controls through the compact status strip', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /manage exhaustion/i }))
    await user.click(await screen.findByRole('button', { name: /increase exhaustion level/i }))

    expect(submitCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_EXHAUSTION',
        level: 1,
        expectedVersion: 4
      })
    )
  })

  it('exposes immediate exhaustion level controls in the status editor', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.overview.exhaustion.level = 2

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        conditionsOnly
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /increase exhaustion level/i }))
    await user.click(screen.getByRole('button', { name: /decrease exhaustion level/i }))

    expect(submitCommand).toHaveBeenNthCalledWith(1, {
      type: 'SET_EXHAUSTION',
      level: 3,
      expectedVersion: 4
    })
    expect(submitCommand).toHaveBeenNthCalledWith(2, {
      type: 'SET_EXHAUSTION',
      level: 1,
      expectedVersion: 4
    })
    expect(screen.getByText('Effects by level')).toBeVisible()
    expect(screen.queryByText(/commit on blur/i)).not.toBeInTheDocument()
  })

  it('collapses exhaustion details without hiding the heading or level controls', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        conditionsOnly
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    const disclosure = screen.getByRole('button', { name: /collapse exhaustion details/i })
    expect(screen.getByRole('heading', { level: 3 })).toContainElement(disclosure)
    expect(disclosure.querySelector('[data-rotate]')).not.toBeNull()

    disclosure.focus()
    await user.keyboard('{Enter}')

    expect(disclosure).toHaveAccessibleName(/expand exhaustion details/i)
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(within(disclosure).getByText(/^Exhaustion$/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /increase exhaustion level/i })).toBeVisible()
    expect(screen.getByText('Effects by level')).not.toBeVisible()
    expect(disclosure.querySelector('[data-rotate]')).toBeNull()

    await user.click(screen.getByRole('button', { name: /increase exhaustion level/i }))

    expect(submitCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_EXHAUSTION',
        level: 1,
        expectedVersion: 4
      })
    )
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')

    disclosure.focus()
    await user.keyboard(' ')

    expect(disclosure).toHaveAccessibleName(/collapse exhaustion details/i)
    await waitFor(() => expect(screen.getByText('Effects by level')).toBeVisible())
  })

  it('commits exhaustion notes on blur and preserves them when saving fails', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(false)
    const sheet = createSheet()
    sheet.overview.exhaustion.level = 2
    sheet.overview.exhaustion.notes = 'Forced march'

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        conditionsOnly
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    const notes = screen.getByLabelText(/exhaustion notes/i)
    await user.clear(notes)
    await user.type(notes, 'Drowned road')
    await user.tab()

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_EXHAUSTION',
      level: 2,
      notes: 'Drowned road',
      expectedVersion: 4
    })
    expect(notes).toHaveValue('Drowned road')
    expect(screen.getByRole('alert')).toHaveTextContent(/exhaustion could not be updated/i)
  })

  it('updates active condition notes through the compact status strip', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.overview.conditions = [
      {
        conditionTypeId: poisoned.id,
        label: poisoned.label,
        description: poisoned.description,
        notes: 'Spider venom'
      }
    ]

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /poisoned/i }))
    await user.click(await screen.findByRole('button', { name: /edit poisoned notes/i }))
    const notesField = screen.getByLabelText(/condition notes/i)
    expect(notesField).toHaveValue('Spider venom')
    await user.clear(notesField)
    await user.type(notesField, 'Wyvern sting')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADD_CONDITION',
      conditionTypeId: poisoned.id,
      notes: 'Wyvern sting',
      expectedVersion: 4
    })
  })

  it('removes active conditions from the compact status strip', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.overview.conditions = [
      {
        conditionTypeId: poisoned.id,
        label: poisoned.label,
        notes: 'Spider venom'
      }
    ]

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /poisoned/i }))
    await user.click(await screen.findByRole('button', { name: /remove poisoned condition/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'REMOVE_CONDITION',
      conditionTypeId: poisoned.id,
      expectedVersion: 4
    })
  })

  it('lists active grants on the Sheet with their source, and hides a hidden source', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.overview.activeGrants = [
      {
        effectId: '33333333-3333-4333-8333-333333333301',
        label: 'Aid',
        sourceHidden: false,
        sourceActorId: null,
        remainingTicks: 4,
        expiresAtCampaignMinute: null,
        polarity: 'BENEFICIAL'
      },
      {
        effectId: '33333333-3333-4333-8333-333333333302',
        label: null,
        sourceHidden: true,
        sourceActorId: null,
        remainingTicks: null,
        expiresAtCampaignMinute: null,
        polarity: 'NEUTRAL'
      }
    ]

    const { rerender } = renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Aid · 4 rounds left',
      'Hidden source · Until ended'
    ])
    expect(screen.queryByRole('button', { name: /^End / })).not.toBeInTheDocument()

    sheet.meta.capabilities.endActiveEffects = true
    rerender(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )
    await user.click(screen.getByRole('button', { name: 'End Aid' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'END_ACTIVE_EFFECT',
      effectId: '33333333-3333-4333-8333-333333333301',
      expectedVersion: sheet.meta.streamVersion
    })
  })

  it('shows an ended standing effect as ended until its rest, never as a use (SPELLS-31.2)', () => {
    const sheet = createSheet()
    sheet.overview.standingEffects = [
      {
        effectId: '33333333-3333-4333-8333-333333333303',
        label: 'Standing Ward',
        returnsOn: 'LONG_REST',
        held: false
      },
      {
        effectId: '33333333-3333-4333-8333-333333333304',
        label: 'Held Ward',
        returnsOn: 'SHORT_REST',
        held: true
      }
    ]

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    const ended = screen.getByRole('list', { name: 'Ended standing effects' })
    expect(
      within(ended)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['Standing Ward · Ended until long rest'])
    expect(screen.queryByText(/Held Ward/)).not.toBeInTheDocument()
  })

  it('lets the caster end a carried Concentration with no other input (SPELLS-5.11)', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.overview.concentration = { label: 'Bless', sourceHidden: false }
    sheet.meta.capabilities.managePlayState = true

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    expect(screen.getByText('Concentrating on Bless')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'End Concentration' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'END_CONCENTRATION',
      expectedVersion: sheet.meta.streamVersion
    })
  })

  it('offers no Concentration control to a viewer who cannot manage play state', () => {
    const sheet = createSheet()
    sheet.overview.concentration = { label: 'Bless', sourceHidden: false }
    sheet.meta.capabilities.managePlayState = false

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    expect(screen.queryByRole('button', { name: 'End Concentration' })).not.toBeInTheDocument()
  })
})
