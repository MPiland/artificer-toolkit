import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { Shell } from './Shell'

describe('Shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('wraps normal authed pages in the scrollable content area', () => {
    renderShell('/home')

    expect(screen.getByTestId('app-shell-main')).toContainElement(screen.getByTestId('normal-page'))
    expect(screen.getByTestId('app-shell-content')).toContainElement(
      screen.getByTestId('normal-page')
    )
  })

  it('leaves authoring routes out of the padded page content wrapper', () => {
    renderShell('/classes/new')

    expect(screen.getByTestId('app-shell-main')).toContainElement(screen.getByTestId('normal-page'))
    expect(screen.queryByTestId('app-shell-content')).not.toBeInTheDocument()
  })

  it('hides public registration from signed-out actions unless enabled', () => {
    const { rerender } = renderWithAppProviders(
      <Shell currentPath='/' isAuthenticated={false} navigation={[]}>
        <div>Page content</div>
      </Shell>
    )

    expect(screen.queryByRole('link', { name: 'Create account' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()

    rerender(
      <Shell currentPath='/' isAuthenticated={false} navigation={[]} publicSignUpEnabled>
        <div>Page content</div>
      </Shell>
    )

    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/sign-up')
  })

  it('links the signed-in account menu to settings', async () => {
    renderShell('/home')

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }))

    expect(await screen.findByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings'
    )
  })

  it('offers system, light, and dark themes before settings', async () => {
    renderShell('/home')

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }))

    const themeSelector = await screen.findByRole('radiogroup', { name: 'Theme preference' })
    const settingsLink = screen.getByText('Settings')

    expect(themeSelector.querySelector('input[value="auto"]')).toBeChecked()
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(themeSelector.compareDocumentPosition(settingsLink) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy()

    fireEvent.click(screen.getByText('Light'))

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'light')
      expect(window.localStorage.getItem('mantine-color-scheme-value')).toBe('light')
    })

    fireEvent.click(screen.getByText('System'))

    await waitFor(() =>
      expect(window.localStorage.getItem('mantine-color-scheme-value')).toBe('auto')
    )
  })
})

function renderShell(currentPath: string) {
  return renderWithAppProviders(
    <Shell currentPath={currentPath} isAuthenticated navigation={[]} userEmail='test@example.com'>
      <div data-testid='normal-page'>Page content</div>
    </Shell>,
    { initialPath: currentPath }
  )
}
