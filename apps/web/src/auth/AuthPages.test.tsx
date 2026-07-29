import { screen } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { InviteLinkErrorPage, SignUpPage } from './pages'

describe('SignUpPage', () => {
  it('renders the existing registration form when public sign-up is enabled', () => {
    renderWithAppProviders(<SignUpPage publicSignUpEnabled />, { initialPath: '/sign-up' })

    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('renders an invite-only state instead of the registration form by default', () => {
    renderWithAppProviders(<SignUpPage />, { initialPath: '/sign-up' })

    expect(
      screen.getByRole('heading', { name: 'Access is currently invite-only' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Already have an account? Sign in.' })).toHaveAttribute(
      'href',
      '/sign-in'
    )
  })

  it('renders a recovery state for unavailable invitation links', () => {
    renderWithAppProviders(<InviteLinkErrorPage />, { initialPath: '/auth/confirmed' })

    expect(
      screen.getByRole('heading', { name: 'This invitation link is unavailable' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/sign-in'
    )
  })
})
