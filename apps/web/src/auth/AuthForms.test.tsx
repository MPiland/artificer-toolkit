import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { resolver, theme } from '#css/theme'
import { ResetPasswordForm, SignInForm, SignUpForm, UpdatePasswordForm } from './components'
import type { AuthClient, AuthResult } from './authClient'

function renderAuthForm(ui: ReactElement) {
  return render(
    <MantineProvider theme={theme} cssVariablesResolver={resolver} defaultColorScheme='dark'>
      {ui}
    </MantineProvider>
  )
}

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
  it('marks sign-in credentials for safe browser autofill without GET fallback', () => {
    renderAuthForm(<SignInForm authClient={createAuthClient()} />)

    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' })

    expect(emailInput.closest('form')).toHaveAttribute('method', 'post')
    expect(emailInput).toHaveAttribute('autocomplete', 'username')
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
  })

  it('submits login through the auth client', async () => {
    const signIn = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()

    renderAuthForm(
      <SignInForm authClient={createAuthClient({ signIn })} onSuccess={onSuccess} />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'player@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'password123'
    }))
    expect(onSuccess).toHaveBeenCalled()
  })

  it('marks sign-up credentials for account creation autofill', () => {
    renderAuthForm(<SignUpForm authClient={createAuthClient()} />)

    const nameInput = screen.getByRole('textbox', { name: /name/i })
    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' })

    expect(nameInput.closest('form')).toHaveAttribute('method', 'post')
    expect(nameInput).toHaveAttribute('autocomplete', 'name')
    expect(emailInput).toHaveAttribute('autocomplete', 'email')
    expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')
  })

  it('submits signup with the display name', async () => {
    const signUp = vi.fn(async () => ({ ok: true }))

    renderAuthForm(<SignUpForm authClient={createAuthClient({ signUp })} />)

    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'Morgan' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'morgan@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(signUp).toHaveBeenCalledWith({
      name: 'Morgan',
      email: 'morgan@example.com',
      password: 'password123'
    }))
  })

  it('passes auto-confirm signup sessions to the success handler', async () => {
    const session = {
      access_token: 'token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'user-1',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-01-01T00:00:00.000Z'
      }
    } satisfies NonNullable<AuthResult['session']>
    const signUp = vi.fn(async () => ({ ok: true, session }))
    const onSuccess = vi.fn()

    renderAuthForm(
      <SignUpForm authClient={createAuthClient({ signUp })} onSuccess={onSuccess} />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'Morgan' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'morgan@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({
      ok: true,
      session
    }))
  })

  it('marks reset-password email for browser autofill without GET fallback', () => {
    renderAuthForm(<ResetPasswordForm authClient={createAuthClient()} />)

    const emailInput = screen.getByRole('textbox', { name: /email address/i })

    expect(emailInput.closest('form')).toHaveAttribute('method', 'post')
    expect(emailInput).toHaveAttribute('autocomplete', 'email')
  })

  it('requests a password reset', async () => {
    const requestPasswordReset = vi.fn(async () => ({ ok: true }))

    renderAuthForm(
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

  it('shows reset-password submit errors only in the form', async () => {
    const requestPasswordReset = vi.fn(async () => ({
      ok: false,
      message: 'Unable to reach the reset service.'
    }))

    renderAuthForm(
      <ResetPasswordForm authClient={createAuthClient({ requestPasswordReset })} />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'reset@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the reset service.')
    expect(screen.getAllByText('Unable to reach the reset service.')).toHaveLength(1)
    expect(screen.queryByText('Unable to send reset link')).not.toBeInTheDocument()
  })

  it('marks update-password fields as new-password entries without GET fallback', () => {
    renderAuthForm(<UpdatePasswordForm authClient={createAuthClient()} />)

    const newPasswordInput = screen.getByLabelText(/new password/i, { selector: 'input' })
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i, { selector: 'input' })

    expect(newPasswordInput.closest('form')).toHaveAttribute('method', 'post')
    expect(newPasswordInput).toHaveAttribute('autocomplete', 'new-password')
    expect(confirmPasswordInput).toHaveAttribute('autocomplete', 'new-password')
  })

  it('updates the password after a recovery link is accepted', async () => {
    const updatePassword = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()

    renderAuthForm(
      <UpdatePasswordForm
        authClient={createAuthClient({ updatePassword })}
        onSuccess={onSuccess}
      />
    )

    fireEvent.change(screen.getByLabelText(/new password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith({
      password: 'new-password-123'
    }))
    expect(onSuccess).toHaveBeenCalled()
  })
})
