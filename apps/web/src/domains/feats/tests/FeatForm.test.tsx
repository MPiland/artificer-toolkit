import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { spellReferenceFixture } from '#domains/spells/spellAuthoring.fixtures'
import { FeatForm } from '../components/FeatForm'
import {
  masterFeatResponseFixture,
  ownedFeatFixture,
  ownedFeatResponseFixture
} from '../feat.fixtures'

describe('FeatForm', () => {
  it('renders locked master view as read-only with duplicate affordance', () => {
    renderWithAppProviders(
      <FeatForm
        mode='view'
        systemId='dnd-5e-srd'
        userId='user-1'
        references={spellReferenceFixture}
        response={masterFeatResponseFixture}
        resolveRuntime={false}
        onSubmit={async () => undefined}
        onCopy={() => undefined}
      />
    )

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveAttribute('readonly')
  })

  it('adds and edits a feat-owned feature basics item', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    renderWithAppProviders(
      <FeatForm
        mode='edit'
        systemId='dnd-5e-srd'
        userId='user-1'
        references={spellReferenceFixture}
        response={{
          ...ownedFeatResponseFixture,
          item: {
            ...ownedFeatFixture,
            features: []
          }
        }}
        resolveRuntime={false}
        onSubmit={onSubmit}
      />
    )

    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /add feature/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('heading', { name: /^features$/i }).length).toBeGreaterThan(0)
    await user.type(within(dialog).getByRole('textbox', { name: /name/i }), 'Opening Read')
    await user.type(within(dialog).getByRole('textbox', { name: /description/i }), 'You notice the first threat before anyone moves.')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('button', { name: /edit features 1/i })).toBeInTheDocument()
  }, 10000)
})
