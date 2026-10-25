import { type SubmitEvent, useState } from 'react'
import { Anchor, Button, TextInput } from '@mantine/core'
import { useHydrated } from '@tanstack/react-router'
import IArrowLeft from '#assets/icons/IArrowLeft'
import { browserAuthClient } from '../authClient'
import {
  authButton,
  authFooterRow,
  authForm,
  inlineLink,
  inlineLinkIcon,
  inlineLinkIconGlyph,
  textInput
} from '../auth.css'
import { AuthDivider } from './AuthDivider'
import { AuthFormFeedback } from './AuthFormFeedback'
import type { AuthFeedback, AuthFormProps } from './authForm.types'

export function ResetPasswordForm({
  authClient = browserAuthClient,
  onCodeSent,
  onSuccess
}: AuthFormProps & { onCodeSent?: (email: string) => void | Promise<void> }) {
  const hydrated = useHydrated()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const result = await authClient.requestPasswordReset({ email })

      if (!result.ok) {
        const message = result.message ?? 'Check the email address and try again.'
        setFeedback({ tone: 'error', message })
        return
      }

      const message =
        "If an account exists for that email, we'll send a verification code. Check your inbox."
      setFeedback({ tone: 'success', message })
      await onSuccess?.(result)
      await onCodeSent?.(email.trim())
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} method='post' onSubmit={handleSubmit}>
      <TextInput
        label='Email address'
        classNames={{
          input: textInput
        }}
        autoComplete='email'
        name='email'
        type='email'
        placeholder='you@example.com'
        value={email}
        onChange={(event) => setEmail(event.currentTarget.value)}
        disabled={!hydrated || isSubmitting}
        required
      />
      <Button className={authButton} type='submit' disabled={!hydrated} loading={isSubmitting}>
        Send verification code
      </Button>
      <AuthFormFeedback feedback={feedback} />
      <AuthDivider />
      <div className={authFooterRow}>
        <Anchor className={inlineLink} href='/verify-password-reset'>
          Enter verification code
        </Anchor>
        <Anchor className={inlineLink} href='/sign-in'>
          <span className={inlineLinkIcon} aria-hidden='true'>
            <IArrowLeft className={inlineLinkIconGlyph} size={14} />
          </span>
          Back to sign in
        </Anchor>
      </div>
    </form>
  )
}
