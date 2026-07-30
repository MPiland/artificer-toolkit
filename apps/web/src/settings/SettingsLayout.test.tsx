import { screen, waitFor, within } from '@testing-library/react'
import { Link } from '@tanstack/react-router'
import userEvent from '@testing-library/user-event'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SettingsLayout } from './SettingsLayout'

describe('SettingsLayout', () => {
  it('keeps the account rail while routing each settings area separately', () => {
    renderWithAppProviders(
      <SettingsLayout email='player@example.com'>
        <div>Profile content</div>
      </SettingsLayout>,
      { initialPath: '/settings/profile' }
    )

    expect(screen.getByText('player@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Preferences' })).toHaveAttribute(
      'href',
      '/settings/preferences'
    )
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute(
      'href',
      '/settings/account'
    )
    expect(screen.getByText('Profile content')).toBeInTheDocument()
  })

  it('opens compact navigation and shows drawer links on compact viewport', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <SettingsLayout email='player@example.com'>
        <Link to='/settings/account'>Account from content</Link>
      </SettingsLayout>,
      { initialPath: '/settings/profile' }
    )

    await user.click(screen.getByRole('button', { name: /open settings navigation/i }))

    const drawer = screen.getByRole('dialog', { name: 'Settings navigation' })
    expect(within(drawer).getByRole('link', { name: 'Profile' })).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: 'Preferences' })).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: 'Account' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Account from content' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Settings navigation' })).not.toBeInTheDocument()
    )
  })
})
