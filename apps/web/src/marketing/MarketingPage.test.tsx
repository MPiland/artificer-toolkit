import { MantineProvider } from '@mantine/core'
import { fireEvent, screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import { resolver, theme } from '#css/theme'
import { MarketingHeader } from './components'
import { getMarketingNavigation, isMarketingSectionEnabled } from './data/marketingContent'
import { MarketingPage } from './pages'

function renderMarketing(ui: ReactElement) {
  return render(
    <MantineProvider theme={theme} cssVariablesResolver={resolver} defaultColorScheme='dark'>
      {ui}
    </MantineProvider>
  )
}

describe('MarketingPage', () => {
  it('renders marketing sections with public navigation', () => {
    renderMarketing(<MarketingPage publicSignUpEnabled />)

    expect(screen.getByTestId('marketing-page')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Build characters and homebrew you can use at the table.'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'One place for preparation and play'
      })
    ).toBeInTheDocument()
    if (isMarketingSectionEnabled('#pricing')) {
      expect(screen.getByRole('heading', { name: /Start free/ })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'View pricing' })).toBeInTheDocument()
    } else {
      expect(screen.queryByRole('heading', { name: /Start free/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'View pricing' })).not.toBeInTheDocument()
    }
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/sign-in')
  })

  it('renders mobile guest header actions without client state', () => {
    renderMarketing(<MarketingHeader publicSignUpEnabled />)

    const signInLinks = screen.getAllByRole('link', { name: 'Sign in' })

    expect(screen.queryByText('Menu')).not.toBeInTheDocument()
    expect(signInLinks).toHaveLength(2)
    expect(signInLinks[1]).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Create free account' })).toHaveLength(1)
  })

  it('removes public registration calls to action when sign-up is disabled', () => {
    const { container } = renderMarketing(<MarketingPage />)

    expect(container.querySelectorAll('a[href="/sign-up"]')).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'Sign in' })).not.toHaveLength(0)
    expect(getMarketingNavigation(false).some((item) => item.href === '#pricing')).toBe(false)
  })

  it('smoothly scrolls enabled in-page marketing anchors with header offset', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    })

    vi.stubGlobal('matchMedia', matchMedia)

    renderMarketing(<MarketingPage publicSignUpEnabled />)

    const marketingPage = screen.getByTestId('marketing-page')
    const scrollTo = vi.fn()
    marketingPage.scrollTop = 120
    marketingPage.scrollTo = scrollTo
    marketingPage.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: 0,
      height: 0,
      toJSON: () => ({})
    }))

    const header = screen.getByTestId('marketing-header')
    Object.defineProperty(header, 'offsetHeight', {
      configurable: true,
      value: 72
    })

    const targetHash = isMarketingSectionEnabled('#pricing') ? '#pricing' : '#features'
    const targetLabel = targetHash === '#pricing' ? 'View pricing' : 'Features'
    const targetId = targetHash.slice(1)
    const targetSection = document.getElementById(targetId)
    const targetScrollTarget = document.querySelector<HTMLElement>(
      `[data-marketing-scroll-target="${targetId}"]`
    )

    expect(targetSection).not.toBeNull()
    expect(targetScrollTarget).not.toBeNull()

    targetScrollTarget!.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 960,
      right: 0,
      bottom: 0,
      left: 0,
      width: 0,
      height: 0,
      toJSON: () => ({})
    }))

    fireEvent.click(screen.getAllByRole('link', { name: targetLabel })[0])

    expect(replaceState).toHaveBeenCalledWith(null, '', targetHash)
    expect(scrollTo).toHaveBeenCalledWith({
      top: 992,
      behavior: 'smooth'
    })
  })
})
