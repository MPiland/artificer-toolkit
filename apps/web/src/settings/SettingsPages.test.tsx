import { fireEvent, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  requestPasswordReset: vi.fn(),
  updateEmail: vi.fn(),
  updatePassword: vi.fn()
}))

vi.mock('./accountClient', () => ({
  accountClient: mocks
}))
vi.mock('#app/auth/authClient', () => ({
  browserAuthClient: {
    requestPasswordReset: mocks.requestPasswordReset
  }
}))

import { AccountSettingsPage } from './AccountSettingsPage'
import { PreferencesSettingsPage } from './PreferencesSettingsPage'

describe('settings pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('persists appearance changes through Mantine local storage', async () => {
    renderWithAppProviders(<PreferencesSettingsPage />)

    fireEvent.click(screen.getByText('Light'))

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'light')
      expect(window.localStorage.getItem('mantine-color-scheme-value')).toBe('light')
    })
  })

  it('requests a confirmed email change', async () => {
    mocks.updateEmail.mockResolvedValue({ ok: true })
    renderWithAppProviders(<AccountSettingsPage email='player@example.com' />)

    expect(screen.queryByRole('textbox', { name: 'New email' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change email' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'New email' }), {
      target: { value: 'new@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update email' }))

    await waitFor(() =>
      expect(mocks.updateEmail).toHaveBeenCalledWith({ email: 'new@example.com' })
    )
  })

  it('shows a neutral status after an email confirmation redirect', () => {
    renderWithAppProviders(<AccountSettingsPage email='player@example.com' emailChanged />)

    expect(screen.getByText('Email confirmation received')).toBeInTheDocument()
    expect(
      screen.getByText(/may still be waiting for confirmation from the other address/i)
    ).toBeInTheDocument()
  })

  it('does not submit mismatched new passwords', async () => {
    const { container } = renderWithAppProviders(<AccountSettingsPage email='player@example.com' />)
    expect(container.querySelector('input[name="currentPassword"]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    const currentPasswordInput = container.querySelector<HTMLInputElement>(
      'input[name="currentPassword"]'
    )
    const newPasswordInput = container.querySelector<HTMLInputElement>('input[name="password"]')
    const confirmPasswordInput = container.querySelector<HTMLInputElement>(
      'input[name="confirmPassword"]'
    )

    expect(currentPasswordInput).not.toBeNull()
    expect(newPasswordInput).not.toBeNull()
    expect(confirmPasswordInput).not.toBeNull()

    fireEvent.change(currentPasswordInput!, {
      target: { value: 'current-password' }
    })
    fireEvent.change(newPasswordInput!, {
      target: { value: 'new-password' }
    })
    fireEvent.change(confirmPasswordInput!, {
      target: { value: 'different-password' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(mocks.updatePassword).not.toHaveBeenCalled()
    expect(await screen.findByText('The new passwords do not match.')).toBeInTheDocument()
  })

  it('sends the existing recovery email from account settings', async () => {
    mocks.requestPasswordReset.mockResolvedValue({ ok: true })
    renderWithAppProviders(<AccountSettingsPage email='player@example.com' />)

    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }))

    await waitFor(() =>
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith({ email: 'player@example.com' })
    )
  })
})
