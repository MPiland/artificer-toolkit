import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSelectionModal } from './CharacterSelectionModal'

function raceModal(opened: boolean) {
  return (
    <CharacterSelectionModal
      actionLabel='Choose race'
      currentId={null}
      description='Choose a playable race.'
      groups={[
        {
          id: 'races',
          options: [
            { id: 'half-elf', label: 'Half-Elf', details: [] },
            { id: 'dwarf', label: 'Dwarf', details: [] }
          ]
        }
      ]}
      opened={opened}
      selectedId={null}
      title='Choose a race'
      onClose={vi.fn()}
      onCommit={vi.fn()}
      onSelectedIdChange={vi.fn()}
    />
  )
}

describe('CharacterSelectionModal', () => {
  it('starts every opening with an empty search', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithAppProviders(raceModal(true))

    await user.type(screen.getByLabelText('Search'), 'dwarf')
    expect(screen.queryByRole('radio', { name: /Half-Elf/i })).not.toBeInTheDocument()

    rerender(raceModal(false))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    rerender(raceModal(true))

    expect(await screen.findByLabelText('Search')).toHaveValue('')
    expect(screen.getByRole('radio', { name: /Half-Elf/i })).toBeInTheDocument()
  })

  it('selects an enabled option when its card surface is clicked', async () => {
    const user = userEvent.setup()
    const onSelectedIdChange = vi.fn()

    renderWithAppProviders(
      <CharacterSelectionModal
        actionLabel='Choose race'
        currentId={null}
        description='Choose a playable race.'
        groups={[
          {
            id: 'races',
            options: [
              {
                id: 'half-elf',
                label: 'Half-Elf',
                description: 'Your half-elf character has qualities from both ancestries.',
                details: []
              }
            ]
          }
        ]}
        opened
        selectedId={null}
        title='Choose a race'
        onClose={vi.fn()}
        onCommit={vi.fn()}
        onSelectedIdChange={onSelectedIdChange}
      />
    )

    const card = screen.getByRole('radio', { name: /Half-Elf/i }).parentElement
    if (!card) throw new Error('Expected the selection card to contain its radio input.')

    await user.click(card)

    expect(onSelectedIdChange).toHaveBeenCalledOnce()
    expect(onSelectedIdChange).toHaveBeenCalledWith('half-elf')
  })
})
