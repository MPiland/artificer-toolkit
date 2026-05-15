import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { AppShellFrame } from './AppShellFrame'
import { platformNavigation } from './navigation'
import { AuthoredListPage } from '#components/AuthoredList'
import { spellListFilters, spellListItems } from '#components/AuthoredList/spellList.fixtures'

describe('AppShellFrame browser', () => {
  it('renders navigation and the main content region in a real browser', async () => {
    await page.viewport(1024, 768)

    const screen = renderWithAppProviders(
      <AppShellFrame
        navigation={platformNavigation}
        currentPath='/home'
        userEmail='creator@example.com'
      >
        <div>MVP workspace home</div>
      </AppShellFrame>
    )

    await expect.element(screen.getByRole('link', { name: 'Spells' })).toBeInTheDocument()
    await expect.element(screen.getByText('MVP workspace home')).toBeInTheDocument()
    await expect.element(screen.getByLabelText('creator@example.com')).toBeInTheDocument()

    const navbar = document.querySelector<HTMLElement>('#workspace-navigation')
    const activeNavItem = document.querySelector<HTMLElement>('nav a[aria-current="page"]')

    if (!navbar || !activeNavItem) {
      throw new Error('Expected shell navigation and active navigation item.')
    }

    const navbarRect = navbar.getBoundingClientRect()
    const activeRect = activeNavItem.getBoundingClientRect()

    expect(activeRect.width).toBeLessThanOrEqual(42)
    expect(activeRect.left).toBeGreaterThanOrEqual(navbarRect.left + 3)
    expect(activeRect.right).toBeLessThanOrEqual(navbarRect.right - 3)

    const header = document.querySelector<HTMLElement>('header')

    expect(header ? getComputedStyle(header).position : null).toBe('fixed')
  })

  it('keeps wide authored list tables scrolling inside the content area', async () => {
    await page.viewport(1024, 768)

    renderWithAppProviders(
      <AppShellFrame
        navigation={platformNavigation}
        currentPath='/spells'
        userEmail='creator@example.com'
      >
        <AuthoredListPage
          title='Spells'
          summary='312 spells / 312 SRD / 0 homebrew'
          createLabel='Create Spell'
          items={spellListItems}
          filters={spellListFilters}
          attributeColumns={[
            { key: 'level', label: 'Level', width: 120 },
            { key: 'school', label: 'School', width: 180 },
            { key: 'classes', label: 'Classes', width: 280 }
          ]}
        />
      </AppShellFrame>
    )

    const table = document.querySelector<HTMLTableElement>('table[aria-label="Authored content table"]')
    const tableScroller = table?.parentElement

    if (!table || !tableScroller) {
      throw new Error('Expected authored list table and scroll container.')
    }

    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1)
    expect(tableScroller.clientWidth).toBeLessThan(table.scrollWidth)
    expect(tableScroller.scrollWidth).toBeGreaterThan(tableScroller.clientWidth)
  })
})
