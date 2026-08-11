import { fireEvent, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  requestPasswordReset: vi.fn(),
  updateAuthUser: vi.fn(),
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
  getSocialEligibility: vi.fn(),
  updateSocialContentPreference: vi.fn()
}))

vi.mock('./accountClient', () => ({
  accountClient: mocks
}))
vi.mock('#app/auth/authClient', () => ({
  browserAuthClient: {
    requestPasswordReset: mocks.requestPasswordReset
  }
}))
vi.mock('#supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: { updateUser: mocks.updateAuthUser }
  })
}))
vi.mock('#app/lib/api', () => ({
  api: {
    socialHub: {
      eligibility: { get: mocks.getSocialEligibility },
      preferences: { update: mocks.updateSocialContentPreference }
    }
  }
}))

import { AccountSettingsPage } from './AccountSettingsPage'
import { PreferencesSettingsPage } from './PreferencesSettingsPage'

describe('settings pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateAuthUser.mockResolvedValue({ error: null })
    mocks.getSocialEligibility.mockResolvedValue({
      eligible: false,
      profilePublicId: null,
      adultAttestedAt: null,
      usAttestedAt: null,
      contentPreference: 'STANDARD',
      status: null
    })
    mocks.updateSocialContentPreference.mockResolvedValue({
      eligible: false,
      profilePublicId: '00000000-0000-4000-8000-000000000001',
      adultAttestedAt: '2026-08-10T12:00:00.000Z',
      usAttestedAt: null,
      contentPreference: 'MATURE',
      status: 'ACTIVE'
    })
    window.localStorage.clear()
  })

  it('persists the account authoring experience', async () => {
    renderWithAppProviders(<PreferencesSettingsPage />)

    fireEvent.click(screen.getByText('Advanced'))

    await waitFor(() =>
      expect(mocks.updateAuthUser).toHaveBeenCalledWith({
        data: { authoring_experience: 'advanced' }
      })
    )
  })

  it('keeps the selected authoring experience when persistence fails', async () => {
    mocks.updateAuthUser.mockResolvedValueOnce({ error: new Error('unavailable') })
    renderWithAppProviders(<PreferencesSettingsPage />)

    fireEvent.click(screen.getByText('Advanced'))

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Advanced' })).toBeChecked())
  })

  it('persists appearance changes through Mantine local storage', async () => {
    renderWithAppProviders(<PreferencesSettingsPage />)

    fireEvent.click(screen.getByText('Light'))

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'light')
      expect(window.localStorage.getItem('mantine-color-scheme-value')).toBe('light')
    })
  })

  it('requires age verification before enabling Mature Social text', async () => {
    renderWithAppProviders(<PreferencesSettingsPage />)

    const maturePreference = await screen.findByRole('radio', { name: 'Mature' })
    await waitFor(() => expect(maturePreference).toBeEnabled())
    fireEvent.click(maturePreference)
    const dialog = await screen.findByRole('dialog', { name: 'Verify you are 18 or older' })
    const birthDate = dialog.querySelector<HTMLInputElement>('input[type="date"]')
    expect(birthDate).not.toBeNull()
    fireEvent.change(birthDate!, {
      target: { value: '2000-01-01' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verify age and show mature text' }))

    await waitFor(() =>
      expect(mocks.updateSocialContentPreference).toHaveBeenCalledWith({
        contentPreference: 'MATURE',
        birthDate: '2000-01-01'
      })
    )
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
