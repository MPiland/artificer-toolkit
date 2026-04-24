import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { ResetPasswordForm, SignInForm, SignUpForm, UpdatePasswordForm } from './components'
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
      <SignInForm authClient={createAuthClient({ signIn })} onSuccess={onSuccess} />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'player@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
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

    renderWithAppProviders(<SignUpForm authClient={createAuthClient({ signUp })} />)

    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'Morgan' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'morgan@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
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

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
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

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'new-password-123' }
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'new-password-123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith({
      password: 'new-password-123'
    }))
    expect(onSuccess).toHaveBeenCalled()
  })
})
