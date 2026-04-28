import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { AuthoredListPage } from './AuthoredListPage'
import { spellListFilters, spellListItems } from './spellList.fixtures'

describe('AuthoredListPage', () => {
  it('renders owned and locked master records with permission-aware actions', () => {
    renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
      />
    )

    const masterRow = screen.getByRole('row', { name: /magic missile/i })
    expect(within(masterRow).queryByRole('button', { name: /view/i })).not.toBeInTheDocument()
    expect(within(masterRow).queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(within(masterRow).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(within(masterRow).getByRole('button', { name: /duplicate/i })).toBeEnabled()

    const ownedRow = screen.getByRole('row', { name: /ember lace/i })
    expect(within(ownedRow).getByRole('button', { name: /edit/i })).toBeEnabled()
    expect(within(ownedRow).getByRole('button', { name: /duplicate/i })).toBeEnabled()
    expect(within(ownedRow).getByRole('button', { name: /delete/i })).toBeEnabled()
  })

  it('uses the row itself as the view action', async () => {
    const user = userEvent.setup()
    const onView = vi.fn()

    renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
        onView={onView}
      />
    )

    await user.click(screen.getByRole('row', { name: /magic missile/i }))

    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: 'magic-missile' }))
  })

  it('filters records by search text', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
      />
    )

    await user.type(screen.getByRole('textbox', { name: /search spells/i }), 'ember')

    expect(screen.getByText('Ember Lace')).toBeInTheDocument()
    expect(screen.queryByText('Magic Missile')).not.toBeInTheDocument()
  })

  it('calls create when the primary action is selected', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()

    renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
        onCreate={onCreate}
      />
    )

    await user.click(screen.getByRole('button', { name: /create spell/i }))

    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('renders card view with the same permission-aware actions', () => {
    renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
        initialViewMode='cards'
      />
    )

    const masterCard = screen.getByLabelText(/view magic missile/i)
    expect(within(masterCard).queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(within(masterCard).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(within(masterCard).getByRole('button', { name: /duplicate/i })).toBeEnabled()

    const ownedCard = screen.getByLabelText(/view ember lace/i)
    expect(within(ownedCard).getByRole('button', { name: /edit/i })).toBeEnabled()
    expect(within(ownedCard).getByRole('button', { name: /duplicate/i })).toBeEnabled()
    expect(within(ownedCard).getByRole('button', { name: /delete/i })).toBeEnabled()
  })

  it('filters card view records by search text', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
        initialViewMode='cards'
      />
    )

    await user.type(screen.getByRole('textbox', { name: /search spells/i }), 'ember')

    expect(screen.getByText('Ember Lace')).toBeInTheDocument()
    expect(screen.queryByText('Magic Missile')).not.toBeInTheDocument()
  })

  it('switches between table and card views from icon actions', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
      />
    )

    expect(screen.getByRole('button', { name: /table view/i })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /card view/i }))

    expect(screen.getByRole('button', { name: /card view/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/view magic missile/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /table view/i }))

    expect(screen.getByRole('button', { name: /table view/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('row', { name: /magic missile/i })).toBeInTheDocument()
  })
})
