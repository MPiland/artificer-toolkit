import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetOverview } from '../overview/CharacterSheetOverview'
import { createSheet } from '../tests/sheetTestHarness'
import { CharacterSheetOverviewVitals } from '../vitals/CharacterSheetOverviewVitals'
import { CharacterSheetOverviewStatusStrip } from './CharacterSheetOverviewStatusStrip'

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
    expect(screen.getByText(/suffers from toxins affecting its body/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/condition notes/i), 'Spider venom')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADD_CONDITION',
      conditionTypeId: 'condition-1',
      notes: 'Spider venom',
      expectedVersion: 4
    })
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
    expect(screen.getByText('Effects by level')).toBeVisible()
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
        conditionTypeId: 'condition-1',
        label: 'Poisoned',
        description: '<p>A poisoned creature suffers from toxins affecting its body.</p>',
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
      conditionTypeId: 'condition-1',
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
        conditionTypeId: 'condition-1',
        label: 'Poisoned',
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
      conditionTypeId: 'condition-1',
      expectedVersion: 4
    })
  })
})
