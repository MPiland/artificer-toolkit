import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetTextEditor } from './CharacterSheetTextEditor'
import { spellPanelFixture } from './inspector.fixtures'

const editor = spellPanelFixture.textEditors[0]

function textEditor(value: string | null, onCommit = vi.fn().mockResolvedValue(true)) {
  return (
    <CharacterSheetTextEditor editor={{ ...editor, value }} pending={false} onCommit={onCommit} />
  )
}

describe('CharacterSheetTextEditor in-progress edits', () => {
  it('keeps the typed value when the server changes the field and surfaces the new value', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(textEditor('Flame'))

    const input = screen.getByLabelText('Custom name')
    await user.clear(input)
    await user.type(input, 'Ember')
    rerender(textEditor('Cinder'))

    expect(screen.getByLabelText('Custom name')).toHaveValue('Ember')
    expect(screen.getByRole('alert')).toHaveTextContent(/Custom name.*Cinder/)

    await user.click(screen.getByRole('button', { name: 'Use latest' }))
    expect(screen.getByLabelText('Custom name')).toHaveValue('Cinder')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the stored trimmed value after its own save without a conflict notice', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn().mockResolvedValue(true)
    const { rerender } = renderWithAppProviders(textEditor('Flame', onCommit))

    const input = screen.getByLabelText('Custom name')
    await user.clear(input)
    await user.type(input, 'Rusty Sword ')
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith('Rusty Sword')
    expect(screen.getByLabelText('Custom name')).not.toHaveValue('Flame')

    rerender(textEditor('Rusty Sword', onCommit))

    expect(screen.getByLabelText('Custom name')).toHaveValue('Rusty Sword')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('raises no conflict when the stored value arrives before the save resolves', async () => {
    const user = userEvent.setup()
    let finishSave: (saved: boolean) => void = () => undefined
    const onCommit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve
        })
    )
    const { rerender } = renderWithAppProviders(textEditor('Flame', onCommit))

    const input = screen.getByLabelText('Custom name')
    await user.clear(input)
    await user.type(input, 'Rusty Sword ')
    await user.tab()
    rerender(textEditor('Rusty Sword', onCommit))

    expect(screen.getByLabelText('Custom name')).toHaveValue('Rusty Sword')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await act(async () => finishSave(true))

    expect(screen.getByLabelText('Custom name')).toHaveValue('Rusty Sword')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('drops a whitespace-only edit that trims to the server value', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn().mockResolvedValue(true)
    renderWithAppProviders(textEditor('Flame', onCommit))

    await user.type(screen.getByLabelText('Custom name'), ' ')
    await user.tab()

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Custom name')).toHaveValue('Flame')
  })

  it('commits the typed value on blur and shows no error when the save succeeds', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn().mockResolvedValue(true)
    renderWithAppProviders(textEditor('Flame', onCommit))

    await user.type(screen.getByLabelText('Custom name'), 'x')
    await user.tab()

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Flamex')
    expect(screen.getByLabelText('Custom name')).toHaveValue('Flamex')
    expect(screen.queryByText(/server value was restored/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('restores the server value and explains when the save fails', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(textEditor('Flame', vi.fn().mockResolvedValue(false)))

    await user.type(screen.getByLabelText('Custom name'), 'x')
    await user.tab()

    expect(await screen.findByText(/server value was restored/)).toBeInTheDocument()
    expect(screen.getByLabelText('Custom name')).toHaveValue('Flame')
  })

  it('clears the restored-value error when the user edits again', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(textEditor('Flame', vi.fn().mockResolvedValue(false)))

    const input = screen.getByLabelText('Custom name')
    await user.type(input, 'x')
    await user.tab()
    expect(await screen.findByText(/server value was restored/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Custom name'), 'y')

    expect(screen.queryByText(/server value was restored/)).not.toBeInTheDocument()
  })

  it('sends one save when the field is submitted again while the save is pending', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn(() => new Promise<boolean>(() => undefined))
    const { rerender } = renderWithAppProviders(textEditor('Flame', onCommit))

    await user.type(screen.getByLabelText('Custom name'), 'x{Enter}')
    rerender(
      <CharacterSheetTextEditor
        editor={{ ...editor, value: 'Flame' }}
        pending
        onCommit={onCommit}
      />
    )
    await user.click(screen.getByLabelText('Custom name'))
    await user.tab()

    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('shows the server value when it changes and nothing is being edited', () => {
    const { rerender } = renderWithAppProviders(textEditor('Flame'))

    rerender(textEditor('Cinder'))

    expect(screen.getByLabelText('Custom name')).toHaveValue('Cinder')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
