import { notifications } from '@mantine/notifications'
import { useState, type FormEvent } from 'react'
import { browserAuthClient, type AuthClient } from './authClient'
import {
  authButton,
  authDivider,
  authDividerLine,
  authFooterRow,
  authForm,
  fieldGroup,
  fieldLabel,
  forgotRow,
  inlineLink,
  textInput
} from './auth.css'

export interface AuthFormProps {
  authClient?: AuthClient
  onSuccess?: () => void | Promise<void>
}

function showError(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: 'red'
  })
}

function showSuccess(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: 'green'
  })
}

export function LoginForm({ authClient = browserAuthClient, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await authClient.signIn({ email, password })

      if (!result.ok) {
        showError('Unable to sign in', result.message ?? 'Please try again.')
        return
      }

      showSuccess('Signed in', 'Your workspace is ready.')
      await onSuccess?.()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} onSubmit={handleSubmit}>
      <label className={fieldGroup}>
        <span className={fieldLabel}>Email address</span>
        <input
          className={textInput}
          name='email'
          type='email'
          placeholder='you@example.com'
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
        />
      </label>
      <div className={fieldGroup}>
        <label className={fieldGroup}>
          <span className={fieldLabel}>Password</span>
          <input
            className={textInput}
            name='password'
            type='password'
            placeholder='********'
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
          />
        </label>
        <div className={forgotRow}>
          <a className={inlineLink} href='/reset-password'>
            Forgot password?
          </a>
        </div>
      </div>
      <button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </button>
      <AuthDivider />
      <div className={authFooterRow}>
        <span>{`Don't have an account?`}</span>
        <a className={inlineLink} href='/signup'>
          Sign up -&gt;
        </a>
      </div>
    </form>
  )
}

export function SignupForm({ authClient = browserAuthClient, onSuccess }: AuthFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await authClient.signUp({ name, email, password })

      if (!result.ok) {
        showError('Unable to create account', result.message ?? 'Please try again.')
        return
      }

      showSuccess('Check your email', 'Confirmation instructions were sent.')
      await onSuccess?.()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} onSubmit={handleSubmit}>
      <label className={fieldGroup}>
        <span className={fieldLabel}>Name</span>
        <input
          className={textInput}
          name='name'
          type='text'
          placeholder='Morgan Emberfall'
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          required
        />
      </label>
      <label className={fieldGroup}>
        <span className={fieldLabel}>Email address</span>
        <input
          className={textInput}
          name='email'
          type='email'
          placeholder='you@example.com'
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
        />
      </label>
      <label className={fieldGroup}>
        <span className={fieldLabel}>Password</span>
        <input
          className={textInput}
          name='password'
          type='password'
          placeholder='********'
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          required
        />
      </label>
      <button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>
      <AuthDivider />
      <div className={authFooterRow}>
        <span>Already have an account?</span>
        <a className={inlineLink} href='/login'>
          Sign in -&gt;
        </a>
      </div>
    </form>
  )
}

export function ResetPasswordForm({ authClient = browserAuthClient, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await authClient.requestPasswordReset({ email })

      if (!result.ok) {
        showError('Unable to send reset link', result.message ?? 'Please try again.')
        return
      }

      showSuccess('Reset link sent', 'Check your inbox for the secure link.')
      await onSuccess?.()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} onSubmit={handleSubmit}>
      <label className={fieldGroup}>
        <span className={fieldLabel}>Email address</span>
        <input
          className={textInput}
          name='email'
          type='email'
          placeholder='you@example.com'
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
        />
      </label>
      <button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Sending link...' : 'Send reset link'}
      </button>
      <AuthDivider />
      <a className={inlineLink} href='/login'>
        &lt;- Back to sign in
      </a>
    </form>
  )
}

export function UpdatePasswordForm({ authClient = browserAuthClient, onSuccess }: AuthFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password !== confirmPassword) {
      showError('Passwords do not match', 'Enter the same password in both fields.')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await authClient.updatePassword({ password })

      if (!result.ok) {
        showError('Unable to update password', result.message ?? 'Please try again.')
        return
      }

      showSuccess('Password updated', 'Use your new password the next time you sign in.')
      await onSuccess?.()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} onSubmit={handleSubmit}>
      <label className={fieldGroup}>
        <span className={fieldLabel}>New password</span>
        <input
          className={textInput}
          name='password'
          type='password'
          placeholder='********'
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          required
        />
      </label>
      <label className={fieldGroup}>
        <span className={fieldLabel}>Confirm password</span>
        <input
          className={textInput}
          name='confirmPassword'
          type='password'
          placeholder='********'
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.currentTarget.value)}
          required
        />
      </label>
      <button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Updating password...' : 'Update password'}
      </button>
      <AuthDivider />
      <a className={inlineLink} href='/login'>
        Back to sign in
      </a>
    </form>
  )
}

function AuthDivider() {
  return (
    <div className={authDivider} aria-hidden='true'>
      <span className={authDividerLine} />
      <span>or</span>
      <span className={authDividerLine} />
    </div>
  )
}
