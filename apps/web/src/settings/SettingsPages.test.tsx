import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { TestRouterProvider } from '#test/TestRouterProvider'

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  requestPasswordReset: vi.fn(),
  setAutoRollDice: vi.fn(),
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
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
vi.mock('@convex-dev/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@convex-dev/react-query')>()
  return {
    ...actual,
    convexQuery: (reference: Parameters<typeof actual.convexQuery>[0], args: unknown) => {
      const options = actual.convexQuery(reference, args)
      if (getFunctionName(reference) === 'account:rollPreferences')
        return { ...options, queryFn: async () => ({ autoRollDice: true }) }
      if (getFunctionName(reference) !== 'social/profiles:getEligibility') return options
      return {
        ...options,
        queryFn: async () => ({
          eligible: false,
          profilePublicId: null,
          adultAttestedAt: null,
          contentPreference: 'STANDARD' as const,
          status: null
        })
      }
    }
  }
})
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useMutation: (reference: Parameters<typeof actual.useMutation>[0]) => {
      const name = getFunctionName(reference)
      if (name === 'social/profiles:updatePreference') return mocks.updateSocialContentPreference
      if (name === 'account:setAutoRollDice') return mocks.setAutoRollDice
      return actual.useMutation(reference)
    }
  }
})

import { AccountSettingsPage } from './AccountSettingsPage'
import { PreferencesSettingsPage } from './PreferencesSettingsPage'

const authoringUser: AuthSessionUserDto = {
  userId: '13c13d4a-1a19-4cdc-8dc8-a9cac3492b1e',
  role: 'user',
  email: 'author@example.invalid',
  username: 'advanced_author',
  registrationCompleted: true,
  authoringExperience: 'guided'
}

describe('settings pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateSocialContentPreference.mockResolvedValue({
      eligible: false,
      profilePublicId: '00000000-0000-4000-8000-000000000001',
      adultAttestedAt: '2026-08-10T12:00:00.000Z',
      contentPreference: 'MATURE',
      status: 'ACTIVE'
    })
    window.localStorage.clear()
  })

  it('persists the account authoring experience', async () => {
    const client = new ConvexReactClient('https://settings-test.convex.cloud', { logger: false })
    const mutation = vi.spyOn(client, 'mutation').mockResolvedValue(null)
    render(
      <TestRouterProvider convexClient={client} user={authoringUser}>
        <PreferencesSettingsPage />
      </TestRouterProvider>
    )

    fireEvent.click(screen.getByText('Advanced'))

    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith(api.account.setAuthoringExperience, {
        experience: 'advanced'
      })
    )
    await client.close()
  })

  it('keeps the selected authoring experience when persistence fails', async () => {
    const client = new ConvexReactClient('https://settings-test.convex.cloud', { logger: false })
    const mutation = vi.spyOn(client, 'mutation').mockRejectedValueOnce(new Error('unavailable'))
    render(
      <TestRouterProvider convexClient={client} user={authoringUser}>
        <PreferencesSettingsPage />
      </TestRouterProvider>
    )

    fireEvent.click(screen.getByText('Advanced'))

    await waitFor(() => {
      expect(mutation).toHaveBeenCalledWith(api.account.setAuthoringExperience, {
        experience: 'advanced'
      })
      expect(screen.getByRole('radio', { name: 'Advanced' })).toBeChecked()
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Your choice works for now, but it could not be saved for next time.'
      )
    })
    await client.close()
  })

  it('persists appearance changes through Mantine local storage', async () => {
    renderWithAppProviders(<PreferencesSettingsPage />)

    fireEvent.click(screen.getByText('Light'))

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'light')
      expect(window.localStorage.getItem('mantine-color-scheme-value')).toBe('light')
    })
  })

  it('requires adult self-attestation before enabling Mature Social text', async () => {
    renderWithAppProviders(<PreferencesSettingsPage />)

    const maturePreference = await screen.findByRole('radio', { name: 'Mature' })
    await waitFor(() => expect(maturePreference).toBeEnabled())
    fireEvent.click(maturePreference)
    const dialog = await screen.findByRole('dialog', { name: 'Confirm you are 18 or older' })
    const birthDate = dialog.querySelector<HTMLInputElement>('input[type="date"]')
    expect(birthDate).not.toBeNull()
    fireEvent.change(birthDate!, {
      target: { value: '2000-01-01' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm age and show mature text' }))

    await waitFor(() =>
      expect(mocks.updateSocialContentPreference).toHaveBeenCalledWith({
        input: {
          contentPreference: 'MATURE',
          birthDate: '2000-01-01'
        }
      })
    )
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Mature' })).toBeChecked()
      expect(
        screen.queryByRole('dialog', { name: 'Confirm you are 18 or older' })
      ).not.toBeInTheDocument()
    })
  })

  it('persists the automatic dice rolling preference', async () => {
    mocks.setAutoRollDice.mockResolvedValue(null)
    renderWithAppProviders(<PreferencesSettingsPage />)

    const autoRoll = await screen.findByRole('switch', { name: 'Roll my dice automatically' })
    await waitFor(() => {
      expect(autoRoll).toBeEnabled()
      expect(autoRoll).toBeChecked()
    })
    fireEvent.click(autoRoll)

    await waitFor(() => expect(mocks.setAutoRollDice).toHaveBeenCalledWith({ autoRollDice: false }))
    await waitFor(() => expect(autoRoll).not.toBeChecked())
  })

  it('keeps the saved dice rolling preference when the update fails', async () => {
    mocks.setAutoRollDice.mockRejectedValue(new Error('Dice preference could not be saved.'))
    renderWithAppProviders(<PreferencesSettingsPage />)

    const autoRoll = await screen.findByRole('switch', { name: 'Roll my dice automatically' })
    await waitFor(() => expect(autoRoll).toBeEnabled())
    fireEvent.click(autoRoll)

    expect(await screen.findByText('Dice preference could not be saved.')).toBeInTheDocument()
    expect(autoRoll).toBeChecked()
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

  it('shows a fixed failure status instead of the neutral email confirmation status', () => {
    renderWithAppProviders(
      <AccountSettingsPage email='player@example.com' emailChanged emailConfirmationFailed />
    )

    expect(screen.getByText('Email confirmation failed')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This confirmation link could not be used. Request another email change from your account settings.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Email confirmation received')).not.toBeInTheDocument()
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
