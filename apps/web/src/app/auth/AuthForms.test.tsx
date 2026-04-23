import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { LoginForm, ResetPasswordForm, SignupForm, UpdatePasswordForm } from './AuthForms'
import type { AuthClient } from './authClient'

function createAuthClient(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    signIn: async () => ({ ok: true }),
    signUp: async () => ({ ok: true }),
    requestPasswordReset: async () => ({ ok: true }),
    updatePassword: async () => ({ ok: true }),
    signOut: async () => ({ ok: true }),
    ...overrides
  }
}

describe('AuthForms', () => {
  it('submits login through the auth client', async () => {
    const signIn = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()

    renderWithAppProviders(
      <LoginForm authClient={createAuthClient({ signIn })} onSuccess={onSuccess} />
    )

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'player@example.com' }
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'password123'
    }))
    expect(onSuccess).toHaveBeenCalled()
  })

  it('submits signup with the display name', async () => {
    const signUp = vi.fn(async () => ({ ok: true }))

    renderWithAppProviders(<SignupForm authClient={createAuthClient({ signUp })} />)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Morgan' }
    })
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'morgan@example.com' }
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(signUp).toHaveBeenCalledWith({
      name: 'Morgan',
      email: 'morgan@example.com',
      password: 'password123'
    }))
  })

  it('requests a password reset', async () => {
    const requestPasswordReset = vi.fn(async () => ({ ok: true }))

    renderWithAppProviders(
      <ResetPasswordForm authClient={createAuthClient({ requestPasswordReset })} />
    )

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'reset@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith({
      email: 'reset@example.com'
    }))
  })

  it('updates the password after a recovery link is accepted', async () => {
    const updatePassword = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()

    renderWithAppProviders(
      <UpdatePasswordForm
        authClient={createAuthClient({ updatePassword })}
        onSuccess={onSuccess}
      />
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-password-123' }
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'new-password-123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith({
      password: 'new-password-123'
    }))
    expect(onSuccess).toHaveBeenCalled()
  })
})
