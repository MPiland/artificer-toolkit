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
    completeInvitation: async () => ({ ok: true }),
    signIn: async () => ({ ok: true }),
    signUp: async () => ({ ok: true }),
    requestPasswordReset: async () => ({ ok: true }),
    updatePassword: async () => ({ ok: true }),
    signOut: async () => ({ ok: true }),
    ...overrides
  }
}

const getAvailableUsername = async () => ({ status: 'available' as const })

describe('AuthForms', () => {
  it('marks sign-in credentials for safe browser autofill without GET fallback', () => {
    renderAuthForm(<SignInForm authClient={createAuthClient()} />)

    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' })

    expect(emailInput.closest('form')).toHaveAttribute('method', 'post')
    expect(emailInput).toHaveAttribute('autocomplete', 'username')
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
  })

  it('hides the public sign-up link by default', () => {
    renderAuthForm(<SignInForm authClient={createAuthClient()} />)

    expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument()
  })

  it('shows the public sign-up link when enabled', () => {
    renderAuthForm(<SignInForm authClient={createAuthClient()} publicSignUpEnabled />)

    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/sign-up')
  })

  it('submits login through the auth client', async () => {
    const signIn = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()

    renderAuthForm(<SignInForm authClient={createAuthClient({ signIn })} onSuccess={onSuccess} />)

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'player@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        email: 'player@example.com',
        password: 'password123'
      })
    )
    expect(onSuccess).toHaveBeenCalled()
  })

  it('marks sign-up credentials for account creation autofill', () => {
    renderAuthForm(
      <SignUpForm authClient={createAuthClient()} getUsernameStatus={getAvailableUsername} />
    )

    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    const usernameInput = screen.getByRole('textbox', { name: /^username/i })
    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' })

    expect(emailInput.closest('form')).toHaveAttribute('method', 'post')
    expect(screen.queryByRole('textbox', { name: /^name/i })).not.toBeInTheDocument()
    expect(emailInput).toHaveAttribute('autocomplete', 'email')
    expect(usernameInput).toHaveAttribute('autocomplete', 'nickname')
    expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')
    expect(passwordInput).toHaveAttribute('minlength', '12')
    expect(passwordInput).toHaveAttribute('maxlength', '128')
    expect(screen.getByText('Use 12-128 characters.')).toBeInTheDocument()
  })

  it('submits the required signup fields and shows neutral confirmation copy', async () => {
    const signUp = vi.fn(async () => ({ ok: true }))

    renderAuthForm(
      <SignUpForm
        authClient={createAuthClient({ signUp })}
        getUsernameStatus={getAvailableUsername}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'morgan@example.com' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^username/i }), {
      target: { value: 'Morgan' }
    })
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'password1234' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        email: 'morgan@example.com',
        password: 'password1234',
        username: 'Morgan'
      })
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account can be created for that email, a confirmation email has been sent.'
    )
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
      <SignUpForm
        authClient={createAuthClient({ signUp })}
        getUsernameStatus={getAvailableUsername}
        onSuccess={onSuccess}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'morgan@example.com' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^username/i }), {
      target: { value: 'morgan' }
    })
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'password1234' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({
        ok: true,
        session
      })
    )
  })

  it('marks reset-password email for browser autofill without GET fallback', () => {
    renderAuthForm(<ResetPasswordForm authClient={createAuthClient()} />)

    const emailInput = screen.getByRole('textbox', { name: /email address/i })

    expect(emailInput.closest('form')).toHaveAttribute('method', 'post')
    expect(emailInput).toHaveAttribute('autocomplete', 'email')
  })

  it('requests a password reset', async () => {
    const requestPasswordReset = vi.fn(async () => ({ ok: true }))

    renderAuthForm(<ResetPasswordForm authClient={createAuthClient({ requestPasswordReset })} />)

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'reset@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() =>
      expect(requestPasswordReset).toHaveBeenCalledWith({
        email: 'reset@example.com'
      })
    )
  })

  it('shows reset-password submit errors only in the form', async () => {
    const requestPasswordReset = vi.fn(async () => ({
      ok: false,
      message: 'Unable to reach the reset service.'
    }))

    renderAuthForm(<ResetPasswordForm authClient={createAuthClient({ requestPasswordReset })} />)

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
    expect(newPasswordInput).toHaveAttribute('minlength', '12')
    expect(newPasswordInput).toHaveAttribute('maxlength', '128')
    expect(confirmPasswordInput).toHaveAttribute('autocomplete', 'new-password')
    expect(confirmPasswordInput).toHaveAttribute('minlength', '12')
    expect(confirmPasswordInput).toHaveAttribute('maxlength', '128')
  })

  it('updates the password after a recovery link is accepted', async () => {
    const updatePassword = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()

    renderAuthForm(
      <UpdatePasswordForm authClient={createAuthClient({ updatePassword })} onSuccess={onSuccess} />
    )

    fireEvent.change(screen.getByLabelText(/new password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() =>
      expect(updatePassword).toHaveBeenCalledWith({
        password: 'new-password-123'
      })
    )
    expect(onSuccess).toHaveBeenCalled()
  })

  it('collects a username only when completing an invitation', async () => {
    const completeInvitation = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()

    renderAuthForm(
      <UpdatePasswordForm
        authClient={createAuthClient({ completeInvitation })}
        invitation
        onSuccess={onSuccess}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /^username/i }), {
      target: { value: 'Morgan_Emberfall' }
    })
    fireEvent.change(screen.getByLabelText(/new password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Complete registration' }))

    await waitFor(() =>
      expect(completeInvitation).toHaveBeenCalledWith({
        password: 'new-password-123',
        username: 'Morgan_Emberfall'
      })
    )
    expect(onSuccess).toHaveBeenCalled()
  })

  it('keeps invitation fields open when profile creation loses a username race', async () => {
    const completeInvitation = vi.fn(async () => ({
      ok: false,
      message: 'That username is already taken.'
    }))
    const onSuccess = vi.fn()

    renderAuthForm(
      <UpdatePasswordForm
        authClient={createAuthClient({ completeInvitation })}
        invitation
        onSuccess={onSuccess}
      />
    )

    const usernameInput = screen.getByRole('textbox', { name: /^username/i })
    fireEvent.change(usernameInput, { target: { value: 'raced_name' } })
    fireEvent.change(screen.getByLabelText(/new password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Complete registration' }))

    expect(await screen.findByText('That username is already taken.')).toBeInTheDocument()
    expect(usernameInput).toHaveValue('raced_name')
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
