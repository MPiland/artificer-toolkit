import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { AuthoredListPage } from './AuthoredListPage'
import type { AuthoredListItem } from './AuthoredList.types'
import { spellListFilters, spellListItems } from './spellList.fixtures'

function renderSpellList() {
  return renderWithAppProviders(
    <AuthoredListPage
      title='Spells'
      summary='312 spells / 312 SRD / 0 homebrew'
      createLabel='Create Spell'
      items={spellListItems}
      filters={spellListFilters}
    />
  )
}

describe('AuthoredListPage', () => {
  it('always exposes active and draft panels with a clear empty draft state', async () => {
    const user = userEvent.setup()

    renderSpellList()

    expect(screen.getByText(`Active (${spellListItems.length})`)).toBeInTheDocument()
    expect(screen.getByText('Drafts (0)')).toBeInTheDocument()

    await user.click(screen.getByText('Drafts (0)'))

    expect(screen.getByText('There are currently no draft spells.')).toBeInTheDocument()
  })

  it('only reserves accent column space for lists with semantic accents', () => {
    const itemsWithoutAccents: AuthoredListItem[] = spellListItems.map((item) => {
      const itemWithoutAccent = { ...item }
      delete itemWithoutAccent.accentColor
      delete itemWithoutAccent.accentLabel

      return itemWithoutAccent
    })

    const { rerender } = renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
      />
    )

    expect(screen.getByRole('columnheader', { name: /accent/i })).toBeInTheDocument()

    rerender(
      <AuthoredListPage
        title='Feats'
        summary='5 feats / 3 SRD / 2 homebrew'
        createLabel='Create Feat'
        items={itemsWithoutAccents}
        filters={spellListFilters}
      />
    )

    expect(screen.queryByRole('columnheader', { name: /accent/i })).not.toBeInTheDocument()
  })

  it('renders lifecycle status separately from domain attributes', () => {
    renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
        attributeColumns={[{ key: 'classes', label: 'Classes', width: 240 }]}
      />
    )

    expect(screen.getByRole('columnheader', { name: /classes/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /tags/i })).not.toBeInTheDocument()

    const row = screen.getByRole('row', { name: /magic missile/i })
    expect(within(row).getByText('Wizard')).toBeInTheDocument()
    expect(within(row).getByText('Active')).toBeInTheDocument()
  })

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

  it('preloads view data when a viewable row receives pointer intent', async () => {
    const user = userEvent.setup()
    const onViewIntent = vi.fn()

    renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
        onViewIntent={onViewIntent}
      />
    )

    await user.hover(screen.getByRole('row', { name: /magic missile/i }))

    expect(onViewIntent).toHaveBeenCalledWith(expect.objectContaining({ id: 'magic-missile' }))
  })

  it('does not open table rows or cards when view permission is false', async () => {
    const user = userEvent.setup()
    const onView = vi.fn()
    const nonViewableItems = [
      {
        ...spellListItems[0],
        permissions: {
          ...spellListItems[0].permissions,
          canView: false
        }
      }
    ]

    const { rerender } = renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={nonViewableItems}
        filters={spellListFilters}
        onView={onView}
      />
    )

    await user.click(screen.getByRole('row', { name: /magic missile/i }))

    expect(onView).not.toHaveBeenCalled()

    rerender(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={nonViewableItems}
        filters={spellListFilters}
        initialViewMode='cards'
        onView={onView}
      />
    )

    await user.click(screen.getByLabelText(/view magic missile/i))

    expect(onView).not.toHaveBeenCalled()
  })

  it('filters records by search text', async () => {
    const user = userEvent.setup()

    renderSpellList()

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

  it('places spell card level in the header and source/actions in the footer', () => {
    renderWithAppProviders(
      <AuthoredListPage
        title='Spells'
        summary='312 spells / 312 SRD / 0 homebrew'
        createLabel='Create Spell'
        items={spellListItems}
        filters={spellListFilters}
        attributeColumns={[{ key: 'level', label: 'Lvl', width: 76 }, { key: 'school', label: 'School' }]}
        initialViewMode='cards'
      />
    )

    const card = screen.getByLabelText(/view magic missile/i)
    const [header, featureRow, footer] = Array.from(card.children)

    expect(header).toHaveTextContent('1')
    expect(header).not.toHaveTextContent('SRD')
    expect(featureRow).not.toHaveTextContent('1')
    expect(footer).toHaveTextContent('SRD')
    expect(within(footer as HTMLElement).getByRole('button', { name: /duplicate magic missile/i })).toBeEnabled()
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
