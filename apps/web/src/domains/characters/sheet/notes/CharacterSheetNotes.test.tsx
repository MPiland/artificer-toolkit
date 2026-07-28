import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createSheet } from '../tests/sheetTestHarness'
import { CharacterSheetNotes } from './CharacterSheetNotes'

describe('Character Sheet notes', () => {
  it('resyncs the selected note when refreshed sheet data changes', async () => {
    const sheet = createSheet()
    sheet.notes.groups = [{ id: 'session', label: 'Session Notes', kind: 'SESSION', sortOrder: 0 }]
    sheet.notes.items = [
      {
        id: 'note-1',
        title: 'Session One',
        body: '<p>Old notes</p>',
        groupId: 'session',
        pinned: false,
        createdAt: '2026-07-10T12:00:00.000Z',
        updatedAt: '2026-07-10T12:00:00.000Z'
      }
    ]
    const refreshedSheet = createSheet()
    refreshedSheet.meta.streamVersion = 5
    refreshedSheet.notes.groups = sheet.notes.groups
    refreshedSheet.notes.items = [
      {
        id: 'note-1',
        title: 'Session One',
        body: '<p>Updated notes</p>',
        groupId: 'session',
        pinned: true,
        createdAt: '2026-07-10T12:00:00.000Z',
        updatedAt: '2026-07-11T12:00:00.000Z'
      }
    ]

    const { rerender } = renderWithAppProviders(
      <CharacterSheetNotes pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    rerender(<CharacterSheetNotes pending={false} sheet={refreshedSheet} submitCommand={vi.fn()} />)

    expect(await screen.findByText(/updated notes/i)).toBeInTheDocument()
    expect(screen.getByText(/pinned/i)).toBeInTheDocument()
    expect(screen.getByText(/edited/i)).toBeInTheDocument()
  })

  it('locks note content and submission while a sheet command is pending', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.notes.groups = [{ id: 'session', label: 'Session Notes', kind: 'SESSION', sortOrder: 0 }]

    renderWithAppProviders(<CharacterSheetNotes pending sheet={sheet} submitCommand={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /new note/i }))
    const editor = await screen.findByRole('dialog', { name: /new note/i })
    expect(within(editor).getByLabelText(/^note$/i)).toHaveAttribute('contenteditable', 'false')
    expect(within(editor).getByRole('button', { name: /create note/i })).toBeDisabled()
  })

  it('renders Builder-owned backstory as read-only rich text without exposing markup', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.notes.alignment = 'Chaotic Good'
    sheet.notes.lifestyle = 'Modest'
    sheet.notes.faith = 'Oghma'
    sheet.notes.gender = 'Nonbinary'
    sheet.notes.age = '32'
    sheet.notes.appearance = '<p>Ink-stained sleeves and a weathered blue cloak.</p>'
    sheet.notes.personalityTraits = '<p>Asks one question too many.</p>'
    sheet.notes.ideals = '<p>Knowledge should help people.</p>'
    sheet.notes.bonds = '<p>Protects a missing mentor.</p>'
    sheet.notes.flaws = '<p>Cannot leave a sealed door alone.</p>'
    sheet.notes.organizations = '<p>Member of the Archive Lanterns.</p>'
    sheet.notes.allies = '<p>Trusts Captain Merrow.</p>'
    sheet.notes.enemies = '<p>Hunted by the Sable Index.</p>'
    sheet.notes.backstory = '<p>Raised among dangerous archives.</p>'

    renderWithAppProviders(
      <CharacterSheetNotes pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    await user.click(screen.getByText(/character backstory/i))
    expect(screen.getByText(/raised among dangerous archives/i)).toBeInTheDocument()
    expect(screen.queryByText(/<p>raised among dangerous archives/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit backstory/i })).not.toBeInTheDocument()
  })
})
