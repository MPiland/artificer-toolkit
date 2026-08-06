import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSelectionModal } from './CharacterSelectionModal'

describe('CharacterSelectionModal', () => {
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
