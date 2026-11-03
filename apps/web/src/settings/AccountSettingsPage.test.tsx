import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

// Only the Better Auth HTTP transport is faked; the page and accountClient run for real.
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))

vi.mock('#app/auth/betterAuthClient', () => ({
  betterAuthClient: { $fetch: mocks.fetch }
}))

import { AccountSettingsPage } from './AccountSettingsPage'

function fillPasswordForm(container: HTMLElement, currentPassword: string, password: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
  for (const [name, value] of [
    ['currentPassword', currentPassword],
    ['password', password],
    ['confirmPassword', password]
  ])
    fireEvent.change(container.querySelector(`input[name="${name}"]`)!, { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
}

describe('AccountSettingsPage credential changes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the password form open with a refusal when the current password is wrong', async () => {
    mocks.fetch.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_PASSWORD', message: 'Invalid password' }
    })
    const { container } = renderWithAppProviders(<AccountSettingsPage email='player@example.com' />)

    fillPasswordForm(container, 'Wrong-current-password-1!', 'New-account-password-2!')

    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument()
    expect(mocks.fetch).toHaveBeenCalledWith('/account/password', {
      method: 'POST',
      body: {
        email: 'player@example.com',
        currentPassword: 'Wrong-current-password-1!',
        password: 'New-account-password-2!'
      }
    })
    expect(container.querySelector('input[name="currentPassword"]')).toHaveValue(
      'Wrong-current-password-1!'
    )
    expect(screen.queryByText('Password updated.')).not.toBeInTheDocument()
  })

  it('updates the password and closes the form', async () => {
    mocks.fetch.mockResolvedValue({ data: null, error: null })
    const { container } = renderWithAppProviders(<AccountSettingsPage email='player@example.com' />)

    fillPasswordForm(container, 'Current-account-password-1!', 'New-account-password-2!')

    expect(await screen.findByText('Password updated.')).toBeInTheDocument()
    expect(container.querySelector('input[name="currentPassword"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument()
  })

  it('requests an email change and keeps showing the current address until it is confirmed', async () => {
    mocks.fetch.mockResolvedValue({ data: { status: true }, error: null })
    renderWithAppProviders(<AccountSettingsPage email='player@example.com' />)

    fireEvent.click(screen.getByRole('button', { name: 'Change email' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'New email' }), {
      target: { value: 'new@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update email' }))

    expect(
      await screen.findByText('Check both email addresses to confirm the change.')
    ).toBeInTheDocument()
    expect(mocks.fetch).toHaveBeenCalledWith('/change-email', {
      method: 'POST',
      body: {
        newEmail: 'new@example.com',
        callbackURL: `${window.location.origin}/settings/account?emailChanged=1`
      }
    })
    expect(screen.getByText('player@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'New email' })).not.toBeInTheDocument()
  })
})
