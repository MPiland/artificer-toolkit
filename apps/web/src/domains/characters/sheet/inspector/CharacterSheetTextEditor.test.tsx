import { screen } from '@testing-library/react'
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

  it('shows the server value when it changes and nothing is being edited', () => {
    const { rerender } = renderWithAppProviders(textEditor('Flame'))

    rerender(textEditor('Cinder'))

    expect(screen.getByLabelText('Custom name')).toHaveValue('Cinder')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
