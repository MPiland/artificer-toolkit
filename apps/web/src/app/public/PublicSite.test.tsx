import { screen } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { MarketingPage, PublicSiteHeader } from './PublicSite'

describe('PublicSite', () => {
  it('renders marketing sections with public navigation', () => {
    renderWithAppProviders(<MarketingPage />)

    expect(screen.getByTestId('marketing-page')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Run your table from one toolkit.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'One place for the whole table' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Start free/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login')
  })

  it('renders mobile menu links without client state', () => {
    renderWithAppProviders(<PublicSiteHeader />)

    expect(screen.getByText('Menu')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Get started free' })).toHaveLength(2)
  })
})
