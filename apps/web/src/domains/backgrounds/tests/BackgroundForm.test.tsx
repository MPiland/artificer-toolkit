import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { BackgroundForm } from '../components/BackgroundForm'
import {
  masterBackgroundResponseFixture,
  ownedBackgroundFixture,
  ownedBackgroundResponseFixture
} from '../background.fixtures'

describe('BackgroundForm', () => {
  it('renders locked master view as read-only with duplicate affordance', () => {
    renderWithAppProviders(
      <BackgroundForm
        mode='view'
        systemId='dnd-5e-srd'
        userId='user-1'
        response={masterBackgroundResponseFixture}
        resolveRuntime={false}
        onSubmit={async () => undefined}
        onCopy={() => undefined}
      />
    )

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveAttribute('readonly')
  })

  it('adds and edits a resolved detail group item', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    renderWithAppProviders(
      <BackgroundForm
        mode='edit'
        systemId='dnd-5e-srd'
        userId='user-1'
        response={{
          ...ownedBackgroundResponseFixture,
          item: {
            ...ownedBackgroundFixture,
            details: []
          }
        }}
        resolveRuntime={false}
        onSubmit={onSubmit}
      />
    )

    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /add details/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('heading', { name: /^details$/i }).length).toBeGreaterThan(0)
    await user.type(within(dialog).getByRole('textbox', { name: /name/i }), 'Local Friend')
    await user.type(within(dialog).getByRole('textbox', { name: /description/i }), 'Someone nearby owes you a favor.')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('button', { name: /edit details 1/i })).toBeInTheDocument()
  }, 10000)
})
