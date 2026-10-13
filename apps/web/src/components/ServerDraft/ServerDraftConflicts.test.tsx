import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { ServerDraftConflicts } from './ServerDraftConflicts'
import { useServerDraft } from './useServerDraft'

function Harness({ notes }: { notes: string }) {
  const draft = useServerDraft({ notes })
  return (
    <>
      <button onClick={() => draft.setValue('notes', 'my note')}>edit notes</button>
      <ServerDraftConflicts draft={draft} labels={{ notes: 'GM notes' }} />
    </>
  )
}

describe('ServerDraftConflicts copy', () => {
  it('shortens a long server value instead of dumping it', async () => {
    const user = userEvent.setup()
    const note = 'Ambush from the north. '.repeat(20)
    const { rerender } = renderWithAppProviders(<Harness notes='' />)

    await user.click(screen.getByRole('button', { name: 'edit notes' }))
    rerender(<Harness notes={note} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/^GM notes changed to Ambush from the north\./)
    expect(alert).toHaveTextContent('…')
    expect(alert.textContent?.length).toBeLessThan(note.length / 2)
  })

  it('says a field was cleared when the server value is empty', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(<Harness notes='Flanked' />)

    await user.click(screen.getByRole('button', { name: 'edit notes' }))
    rerender(<Harness notes='' />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'GM notes was cleared elsewhere. Your edit is kept.'
    )
  })
})
