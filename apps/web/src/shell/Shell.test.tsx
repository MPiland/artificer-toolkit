import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { Shell } from './Shell'
import { buildPlatformNavigation, contentKindOrder } from './navigation'
import { useShellReturnHref } from './returnLocation'

vi.mock('#app/data/media', () => ({
  useMediaImage: () => ({ data: null })
}))

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

  it('retains the last non-authoring URL while an authoring route is open', () => {
    const { rerender } = renderWithAppProviders(
      <Shell
        currentHref='/characters/7mcwy/dice-roll-test-fighter?tab=actions'
        currentPath='/characters/7mcwy/dice-roll-test-fighter'
        isAuthenticated
        navigation={[]}
      >
        <ReturnHrefProbe />
      </Shell>
    )

    rerender(
      <Shell
        currentHref='/characters/7mcwy/dice-roll-test-fighter/edit?step=abilities'
        currentPath='/characters/7mcwy/dice-roll-test-fighter/edit'
        isAuthenticated
        navigation={[]}
      >
        <ReturnHrefProbe />
      </Shell>
    )

    expect(screen.getByTestId('return-href')).toHaveTextContent(
      '/characters/7mcwy/dice-roll-test-fighter?tab=actions'
    )
  })

  it('follows the current URL across non-authoring routes', () => {
    const { rerender } = renderWithAppProviders(shellAt('/spells', '/spells'))
    expect(screen.getByTestId('return-href')).toHaveTextContent('/spells')

    rerender(shellAt('/classes?page=2', '/classes'))
    expect(screen.getByTestId('return-href')).toHaveTextContent('/classes?page=2')
  })

  it('has no return URL when the first route is an authoring route, then keeps the last page after leaving it', () => {
    const { rerender } = renderWithAppProviders(shellAt('/spells/new', '/spells/new'))
    expect(screen.getByTestId('return-href')).toBeEmptyDOMElement()

    rerender(shellAt('/home', '/home'))
    expect(screen.getByTestId('return-href')).toHaveTextContent('/home')

    rerender(shellAt('/spells/new?step=basics', '/spells/new'))
    expect(screen.getByTestId('return-href')).toHaveTextContent('/home')
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

  it('does not offer a script-only account menu before hydration', () => {
    const shell = (
      <Shell currentPath='/home' isAuthenticated navigation={[]}>
        <div>Home</div>
      </Shell>
    )
    const serverMarkup = document.createElement('div')
    serverMarkup.innerHTML = renderToString(<TestRouterProvider>{shell}</TestRouterProvider>)
    expect(serverMarkup.querySelector('button[aria-label="Open account menu"]')).toBeDisabled()
    renderWithAppProviders(shell)
    expect(screen.getByRole('button', { name: 'Open account menu' })).toBeEnabled()
  })

  it('exposes Social Hub directly without adding it to the Create menu', async () => {
    renderWithAppProviders(
      <Shell
        currentPath='/social'
        isAuthenticated
        navigation={buildPlatformNavigation(contentKindOrder)}
        userEmail='test@example.com'
      >
        <div>Page content</div>
      </Shell>,
      { initialPath: '/social' }
    )

    expect(screen.getByRole('link', { name: 'Social Hub' })).toHaveAttribute('href', '/social')
    expect(screen.getByRole('link', { name: 'Social Hub' })).toHaveAttribute('aria-current', 'page')

    fireEvent.mouseEnter(screen.getByRole('button', { name: /create/i }))
    await screen.findByRole('menu')
    expect(screen.queryByRole('menuitem', { name: 'Social listing' })).not.toBeInTheDocument()
  })

  it('lists only the content kinds the System publishes in the Library menu', async () => {
    renderWithAppProviders(
      <Shell
        currentPath='/home'
        isAuthenticated
        navigation={buildPlatformNavigation(['CREATURE', 'SPELL'])}
      >
        <div>Page content</div>
      </Shell>
    )
    fireEvent.mouseEnter(screen.getByRole('button', { name: /library/i }))

    expect(await screen.findByRole('menuitem', { name: 'Spells' })).toHaveAttribute(
      'href',
      '/spells'
    )
    expect(screen.getByRole('menuitem', { name: 'Creatures' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Classes' })).not.toBeInTheDocument()
    expect(screen.queryByText('No Game System content available')).not.toBeInTheDocument()
  })

  it('shows an explicit empty state and no Content entries when no System publishes content', async () => {
    renderWithAppProviders(
      <Shell currentPath='/home' isAuthenticated navigation={buildPlatformNavigation([])}>
        <div>Page content</div>
      </Shell>
    )
    fireEvent.mouseEnter(screen.getByRole('button', { name: /library/i }))

    expect(await screen.findByText('No Game System content available')).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Spells' })).not.toBeInTheDocument()
  })

  it('hides the Library importer unless its feature flag is enabled', async () => {
    const navigation = [
      { label: 'Workspace', items: [{ label: 'Home', href: '/home', icon: () => null }] }
    ]
    const { rerender } = renderWithAppProviders(
      <Shell currentPath='/home' isAuthenticated navigation={navigation}>
        <div>Page content</div>
      </Shell>
    )
    fireEvent.mouseEnter(screen.getByRole('button', { name: /library/i }))
    expect(screen.queryByRole('menuitem', { name: 'Import' })).not.toBeInTheDocument()

    rerender(
      <Shell currentPath='/home' isAuthenticated libraryImportEnabled navigation={navigation}>
        <div>Page content</div>
      </Shell>
    )
    fireEvent.mouseEnter(screen.getByRole('button', { name: /library/i }))
    expect(await screen.findAllByRole('menuitem', { name: 'Import' })).toHaveLength(1)
  })

  it('offers system, light, and dark themes before settings', async () => {
    renderShell('/home')

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }))

    const themeSelector = await screen.findByRole('radiogroup', { name: 'Theme preference' })
    const settingsLink = screen.getByText('Settings')
    const systemOption = themeSelector.querySelector('input[value="auto"]')
    const lightOption = themeSelector.querySelector('input[value="light"]')
    const darkOption = themeSelector.querySelector('input[value="dark"]')

    expect(systemOption).toBeChecked()
    expect(lightOption).toBeInTheDocument()
    expect(darkOption).toBeInTheDocument()
    expect(
      themeSelector.compareDocumentPosition(settingsLink) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    fireEvent.click(lightOption!)

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'light')
      expect(window.localStorage.getItem('mantine-color-scheme-value')).toBe('light')
    })

    fireEvent.click(systemOption!)

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

function ReturnHrefProbe() {
  return <output data-testid='return-href'>{useShellReturnHref()}</output>
}

function shellAt(currentHref: string, currentPath: string) {
  return (
    <Shell currentHref={currentHref} currentPath={currentPath} isAuthenticated navigation={[]}>
      <ReturnHrefProbe />
    </Shell>
  )
}
