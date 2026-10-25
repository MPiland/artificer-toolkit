import { useHydrated } from '@tanstack/react-router'
import { type SubmitEvent, useState } from 'react'
import { browserAuthClient } from '../authClient'
import type { AuthFeedback, AuthFormProps } from './authForm.types'
import {
  authButton,
  authFooterRow,
  authForm,
  forgotRow,
  inlineLink,
  inlineLinkIcon,
  inlineLinkIconGlyph,
  textInput
} from '../auth.css'
import { AuthDivider } from './AuthDivider'
import { AuthFormFeedback } from './AuthFormFeedback'
import { Anchor, Button, PasswordInput, TextInput } from '@mantine/core'
import IArrowRight from '#assets/icons/IArrowRight'

type SignInFormProps = AuthFormProps & {
  publicSignUpEnabled?: boolean
}

export function SignInForm({
  authClient = browserAuthClient,
  onSuccess,
  publicSignUpEnabled = false
}: SignInFormProps) {
  const hydrated = useHydrated()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const result = await authClient.signIn({ identifier, password })

      if (!result.ok) {
        const message =
          result.message ?? 'Check your email or username and password, then try again.'
        setFeedback({ tone: 'error', message })
        return
      }

      const message = 'Signed in.'
      setFeedback({ tone: 'success', message })
      await onSuccess?.(result)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} method='post' onSubmit={handleSubmit}>
      <TextInput
        label='Email or username'
        classNames={{
          input: textInput
        }}
        autoComplete='username'
        name='identifier'
        type='text'
        placeholder='you@example.com or morgan_emberfall'
        value={identifier}
        onChange={(event) => setIdentifier(event.currentTarget.value)}
        disabled={!hydrated || isSubmitting}
        required
      />
      <PasswordInput
        label='Password'
        classNames={{
          input: textInput
        }}
        autoComplete='current-password'
        name='password'
        type='password'
        placeholder='********'
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
        disabled={!hydrated || isSubmitting}
        required
      />
      <div className={forgotRow}>
        <Anchor className={inlineLink} href='/reset-password'>
          Forgot password?
        </Anchor>
      </div>
      <Button className={authButton} type='submit' disabled={!hydrated} loading={isSubmitting}>
        Sign in
      </Button>
      <AuthFormFeedback feedback={feedback} />
      {publicSignUpEnabled ? (
        <>
          <AuthDivider />
          <div className={authFooterRow}>
            <span>{`Don't have an account?`}</span>
            <Anchor className={inlineLink} href='/sign-up'>
              Sign up
              <span className={inlineLinkIcon} aria-hidden='true'>
                <IArrowRight className={inlineLinkIconGlyph} size={14} />
              </span>
            </Anchor>
          </div>
        </>
      ) : null}
    </form>
  )
}
