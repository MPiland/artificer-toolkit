import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { resolver, theme } from '#css/theme'
import {
  ResetPasswordForm,
  SignInForm,
  SignUpForm,
  UpdatePasswordForm,
  VerifyPasswordResetForm
} from './components'
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
    verifyPasswordRecovery: async () => ({ ok: true }),
    resetPassword: async () => ({ ok: true }),
    signOut: async () => ({ ok: true }),
    ...overrides
  }
}

describe('AuthForms', () => {
  it('blocks recovery controls before hydration can attach their API handlers', () => {
    for (const form of [
      <ResetPasswordForm />,
      <VerifyPasswordResetForm />,
      <UpdatePasswordForm />
    ]) {
      const container = document.createElement('div')
      container.innerHTML = renderToString(
        <MantineProvider theme={theme} cssVariablesResolver={resolver} defaultColorScheme='dark'>
          {form}
        </MantineProvider>
      )
      expect(container.querySelector('button[type="submit"]')).toBeDisabled()
      for (const input of container.querySelectorAll(
        'input[name="email"], input[name="token"]:not([type="hidden"])'
      )) {
        expect(input).toBeDisabled()
      }
    }
  })

  it('preserves fields typed before hydration and blocks registration until credentials are read', async () => {
    const completeInvitation = vi.fn(async () => ({ ok: true }))
    const authClient = createAuthClient({ completeInvitation })
    const credentials = { email: 'player@example.com', token: 'a'.repeat(64) }
    const form = (ready = false) => (
      <MantineProvider theme={theme} cssVariablesResolver={resolver} defaultColorScheme='dark'>
        <UpdatePasswordForm
          authClient={authClient}
          invitation
          invitationCredentials={ready ? credentials : undefined}
        />
      </MantineProvider>
    )
    const container = document.createElement('div')
    container.innerHTML = renderToString(form())
    document.body.append(container)
    const username = container.querySelector<HTMLInputElement>('input[name="username"]')!
    const password = container.querySelector<HTMLInputElement>('input[name="password"]')!
    const confirmation = container.querySelector<HTMLInputElement>('input[name="confirmPassword"]')!
    expect(username).toBeEnabled()
    expect(container.querySelector('button[type="submit"]')).toBeDisabled()
    // Native DOM edits before React has attached any event handlers.
    username.value = 'early_player'
    password.value = 'early-password-123'
    confirmation.value = 'early-password-123'
    const { rerender } = render(form(), { container, hydrate: true })
    expect(completeInvitation).not.toHaveBeenCalled()
    rerender(form(true))
    expect(username).toHaveValue('early_player')
    expect(password).toHaveValue('early-password-123')
    expect(confirmation).toHaveValue('early-password-123')
    fireEvent.click(screen.getByRole('button', { name: 'Complete registration' }))
    await waitFor(() =>
      expect(completeInvitation).toHaveBeenCalledWith({
        ...credentials,
        username: 'early_player',
        password: 'early-password-123'
      })
    )
  })

  it('marks sign-in credentials for safe browser autofill without GET fallback', () => {
    renderAuthForm(<SignInForm authClient={createAuthClient()} />)

    const identifierInput = screen.getByRole('textbox', { name: /email or username/i })
    const passwordInput = screen.getByLabelText(/^password/i, { selector: 'input' })

    expect(identifierInput.closest('form')).toHaveAttribute('method', 'post')
    expect(identifierInput).toHaveAttribute('autocomplete', 'username')
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

    fireEvent.change(screen.getByRole('textbox', { name: /email or username/i }), {
      target: { value: 'player@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        identifier: 'player@example.com',
        password: 'password123'
      })
    )
    expect(onSuccess).toHaveBeenCalled()
  })

  it('keeps the sign-in action visible while its button shows progress', async () => {
    let resolveSignIn: ((result: AuthResult) => void) | undefined
    const signIn = vi.fn(
      () =>
        new Promise<AuthResult>((resolve) => {
          resolveSignIn = resolve
        })
    )

    renderAuthForm(<SignInForm authClient={createAuthClient({ signIn })} />)

    fireEvent.change(screen.getByRole('textbox', { name: /email or username/i }), {
      target: { value: 'player@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    const button = screen.getByRole('button', { name: 'Sign in' })
    await waitFor(() => expect(button).toHaveAttribute('data-loading', 'true'))
    expect(button).toBeDisabled()
    expect(screen.queryByText('Signing in...')).not.toBeInTheDocument()

    resolveSignIn?.({ ok: false })
    await waitFor(() => expect(button).not.toHaveAttribute('data-loading'))
  })

  it('marks sign-up credentials for account creation autofill', () => {
    renderAuthForm(<SignUpForm authClient={createAuthClient()} />)

    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    const passwordInput = screen.getByLabelText(/^password/i, { selector: 'input' })
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i, {
      selector: 'input'
    })

    expect(emailInput.closest('form')).toHaveAttribute('method', 'post')
    expect(screen.queryByRole('textbox', { name: /^name/i })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^username/i })).toHaveAttribute(
      'autocomplete',
      'username'
    )
    expect(emailInput).toHaveAttribute('autocomplete', 'email')
    expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')
    expect(passwordInput).toHaveAttribute('minlength', '12')
    expect(passwordInput).toHaveAttribute('maxlength', '128')
    expect(confirmPasswordInput).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByText('Use 12 to 128 characters.')).toBeInTheDocument()
  })

  it('submits the required signup fields and shows neutral confirmation copy', async () => {
    const signUp = vi.fn(async () => ({ ok: true }))

    renderAuthForm(
      <SignUpForm
        authClient={createAuthClient({ signUp })}
        getUsernameStatus={async () => ({ status: 'available' })}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'morgan@example.com' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^username/i }), {
      target: { value: 'morgan' }
    })
    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), {
      target: { value: 'password1234' }
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'password1234' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        email: 'morgan@example.com',
        password: 'password1234',
        username: 'morgan'
      })
    )
    expect(
      await screen.findByText(
        "If we can create an account with that email, we'll send a confirmation link. Check your inbox."
      )
    ).toBeInTheDocument()
  })

  it('requires email verification after successful signup', async () => {
    const signUp = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()

    renderAuthForm(
      <SignUpForm
        authClient={createAuthClient({ signUp })}
        getUsernameStatus={async () => ({ status: 'available' })}
        onSuccess={onSuccess}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'morgan@example.com' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^username/i }), {
      target: { value: 'morgan' }
    })
    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), {
      target: { value: 'password1234' }
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'password1234' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ ok: true }))
    expect(await screen.findByText(/send a confirmation link/i)).toBeInTheDocument()
  })

  it('marks reset-password email for browser autofill without GET fallback', () => {
    renderAuthForm(<ResetPasswordForm authClient={createAuthClient()} />)

    const emailInput = screen.getByRole('textbox', { name: /email address/i })

    expect(emailInput.closest('form')).toHaveAttribute('method', 'post')
    expect(emailInput).toHaveAttribute('autocomplete', 'email')
  })

  it('requests a password reset', async () => {
    const requestPasswordReset = vi.fn(async () => ({ ok: true }))
    const onCodeSent = vi.fn()

    renderAuthForm(
      <ResetPasswordForm
        authClient={createAuthClient({ requestPasswordReset })}
        onCodeSent={onCodeSent}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'reset@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }))

    await waitFor(() =>
      expect(requestPasswordReset).toHaveBeenCalledWith({
        email: 'reset@example.com'
      })
    )
    expect(onCodeSent).toHaveBeenCalledWith('reset@example.com')
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
    fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the reset service.')
    expect(screen.getAllByText('Unable to reach the reset service.')).toHaveLength(1)
    expect(screen.queryByText('Unable to send reset link')).not.toBeInTheDocument()
  })

  it('prefills the email and automatically verifies a complete recovery code', async () => {
    const verifyPasswordRecovery = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()
    const onVerified = vi.fn()

    renderAuthForm(
      <VerifyPasswordResetForm
        authClient={createAuthClient({ verifyPasswordRecovery })}
        initialEmail='reset@example.com'
        onVerified={onVerified}
        onSuccess={onSuccess}
      />
    )

    expect(screen.getByRole('textbox', { name: /email address/i })).toHaveValue('reset@example.com')
    fireEvent.change(screen.getByRole('textbox', { name: 'Verification code digit 1' }), {
      target: { value: '123456' }
    })

    await waitFor(() =>
      expect(verifyPasswordRecovery).toHaveBeenCalledWith({
        email: 'reset@example.com',
        token: '123456'
      })
    )
    expect(onVerified).toHaveBeenCalledWith({ email: 'reset@example.com', token: '123456' })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('shows live password confirmation feedback during sign-up', () => {
    renderAuthForm(<SignUpForm authClient={createAuthClient()} />)

    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), {
      target: { value: 'password1234' }
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'password123' }
    })
    expect(screen.getByRole('status')).toHaveTextContent('Passwords do not match.')

    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'password1234' }
    })
    expect(screen.getByRole('status')).toHaveTextContent('Passwords match.')
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
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/sign-in'
    )
  })

  it('clears password-setup authentication before returning to sign in', async () => {
    const calls: string[] = []
    const signOut = vi.fn(async () => {
      calls.push('sign-out')
      return { ok: true }
    })
    const onBackToSignIn = vi.fn(async () => {
      calls.push('navigate')
    })

    renderAuthForm(
      <UpdatePasswordForm
        authClient={createAuthClient({ signOut })}
        onBackToSignIn={onBackToSignIn}
      />
    )

    fireEvent.click(screen.getByRole('link', { name: 'Back to sign in' }))

    await waitFor(() => expect(onBackToSignIn).toHaveBeenCalled())
    expect(calls).toEqual(['sign-out', 'navigate'])
  })

  it('resets the password only with a verified recovery code', async () => {
    const resetPassword = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()

    renderAuthForm(
      <UpdatePasswordForm
        authClient={createAuthClient({ resetPassword })}
        recovery={{ email: 'reset@example.com', token: '123456' }}
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

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({
        email: 'reset@example.com',
        password: 'new-password-123',
        token: '123456'
      })
    )
    expect(onSuccess).toHaveBeenCalled()
  })

  it('does not reset a password without a verified recovery code', async () => {
    const resetPassword = vi.fn(async () => ({ ok: true }))
    renderAuthForm(<UpdatePasswordForm authClient={createAuthClient({ resetPassword })} />)

    fireEvent.change(screen.getByLabelText(/new password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Request a new verification code')
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('shows live password confirmation feedback during password updates', () => {
    renderAuthForm(<UpdatePasswordForm authClient={createAuthClient()} />)

    fireEvent.change(screen.getByLabelText(/new password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'new-password-12' }
    })
    expect(screen.getByRole('status')).toHaveTextContent('Passwords do not match.')

    fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
      target: { value: 'new-password-123' }
    })
    expect(screen.getByRole('status')).toHaveTextContent('Passwords match.')
  })

  it('completes an invitation with a username and new password', async () => {
    const completeInvitation = vi.fn(async () => ({ ok: true }))
    const onSuccess = vi.fn()

    renderAuthForm(
      <UpdatePasswordForm
        authClient={createAuthClient({ completeInvitation })}
        invitation
        invitationCredentials={{
          email: 'player@example.com',
          token: 'a'.repeat(64)
        }}
        onSuccess={onSuccess}
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: /^username/i }), {
      target: { value: 'player_one' }
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
        email: 'player@example.com',
        password: 'new-password-123',
        token: 'a'.repeat(64),
        username: 'player_one'
      })
    )
    expect(onSuccess).toHaveBeenCalled()
  })
})
