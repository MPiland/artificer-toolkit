import { fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { MarketingHeader } from './components'
import { isMarketingSectionEnabled } from './data/marketingContent'
import { MarketingPage } from './pages'

describe('MarketingPage', () => {
  it('renders marketing sections with public navigation', () => {
    renderWithAppProviders(<MarketingPage />)

    expect(screen.getByTestId('marketing-page')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Create the content you want to run, then bring it straight into play.'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Built for real tabletop workflows, not generic content forms'
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

  it('renders mobile menu links without client state', () => {
    renderWithAppProviders(<MarketingHeader />)

    expect(screen.getByText('Menu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Get started free' })).toHaveLength(2)
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

    renderWithAppProviders(<MarketingPage />)

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
