import { Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useFormField } from '#hooks'
import {
  authFieldError,
  authFieldInput,
  authFieldLabel,
  authForgotLink,
  authForgotRow,
  authForm,
  authHint,
  authHintError,
  authHintInfo,
  authLink,
  submitButton,
} from './Auth.css'
import { AuthFrame } from './AuthFrame'

export type AuthMode = 'login' | 'signup' | 'reset-request' | 'reset-confirm'
export type AuthStatus = 'idle' | 'pending' | 'success' | 'error'

const modeConfig: Record<AuthMode, { title: string; subtitle: ReactNode; submitLabel: string }> = {
  login: {
    title: 'Welcome back',
    subtitle: (
      <>
        Sign in to continue your work. New here?{' '}
        <Link to='/signup' className={authLink}>
          Create an account
        </Link>
        .
      </>
    ),
    submitLabel: 'Sign in',
  },
  signup: {
    title: 'Create your account',
    subtitle: (
      <>
        Set up your workspace and start building. Already have one?{' '}
        <Link to='/login' className={authLink}>
          Sign in
        </Link>
        .
      </>
    ),
    submitLabel: 'Create account',
  },
  'reset-request': {
    title: 'Reset password',
    subtitle: "Enter your email and we will send a recovery link.",
    submitLabel: 'Send reset link',
  },
  'reset-confirm': {
    title: 'Choose a new password',
    subtitle: 'Make it strong, then get back to work.',
    submitLabel: 'Set new password',
  },
}

const fieldClassNames = {
  input: authFieldInput,
  label: authFieldLabel,
  error: authFieldError,
}

interface AuthProps {
  mode: AuthMode
  status: AuthStatus
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  hint?: ReactNode
  hintVariant?: 'error' | 'info'
}

export function Auth({ mode, status, onSubmit, hint, hintVariant = 'error' }: AuthProps) {
  const { AppField } = useFormField()
  const config = modeConfig[mode]
  const showEmail = mode !== 'reset-confirm'
  const showPassword = mode === 'login' || mode === 'signup' || mode === 'reset-confirm'

  return (
    <AuthFrame title={config.title} subtitle={config.subtitle}>
      <form
        className={authForm}
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(e)
        }}
      >
        <Stack gap='md'>
          {showEmail && (
            <AppField
              name='email'
              validators={{
                onBlur: ({ value }) => {
                  const v = value as string
                  if (!v) return null
                  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)
                    ? null
                    : 'Enter a valid email address.'
                },
                onSubmit: ({ value }) => {
                  const v = value as string
                  return !v ? 'Email is required.' : null
                },
              }}
            >
              {(field) => (
                <TextInput
                  classNames={fieldClassNames}
                  label='Email'
                  placeholder='you@example.com'
                  type='email'
                  autoComplete='username'
                  value={(field.state.value as string) ?? ''}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={
                    !field.state.meta.isValid && field.state.meta.isTouched
                      ? field.state.meta.errors?.join(', ')
                      : undefined
                  }
                />
              )}
            </AppField>
          )}

          {showPassword && (
            <>
              <AppField
                name='password'
                validators={{
                  onBlur: ({ value }) => {
                    const v = value as string
                    if (!v) return null
                    if (v.length < 8) return 'At least 8 characters required.'
                    if (mode === 'signup' || mode === 'reset-confirm') {
                      return /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[#?!@$%^&*\-])/.test(v)
                        ? null
                        : 'Include uppercase, number, and special character.'
                    }
                    return null
                  },
                  onSubmit: ({ value }) => {
                    const v = value as string
                    return !v ? 'Password is required.' : null
                  },
                }}
              >
                {(field) => (
                  <PasswordInput
                    classNames={fieldClassNames}
                    label={mode === 'reset-confirm' ? 'New password' : 'Password'}
                    placeholder='Enter your password'
                    autoComplete={
                      mode === 'signup' || mode === 'reset-confirm' ? 'new-password' : 'current-password'
                    }
                    value={(field.state.value as string) ?? ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={
                      !field.state.meta.isValid && field.state.meta.isTouched
                        ? field.state.meta.errors?.join(', ')
                        : undefined
                    }
                  />
                )}
              </AppField>

              {mode === 'login' && (
                <div className={authForgotRow}>
                  <Link to='/reset-password' className={authForgotLink}>
                    Forgot password?
                  </Link>
                </div>
              )}
            </>
          )}
        </Stack>

        {hint && (
          <div className={`${authHint} ${hintVariant === 'info' ? authHintInfo : authHintError}`}>{hint}</div>
        )}

        <Button
          type='submit'
          fullWidth
          className={submitButton}
          loading={status === 'pending'}
          disabled={status === 'pending'}
        >
          {config.submitLabel}
        </Button>
      </form>
    </AuthFrame>
  )
}
