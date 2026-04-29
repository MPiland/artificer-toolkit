import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { BackgroundForm } from './BackgroundForm'
import {
  masterBackgroundResponseFixture,
  ownedBackgroundFixture,
  ownedBackgroundResponseFixture
} from './background.fixtures'

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

  it('adds and edits a suggested characteristic collection item', async () => {
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
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /add characteristic/i }))

    await screen.findByRole('heading', { name: /edit characteristic/i })
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Local Friend')
    await user.type(screen.getByRole('textbox', { name: /description/i }), 'Someone nearby owes you a favor.')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByText('Local Friend')).toBeInTheDocument()
  })
})
