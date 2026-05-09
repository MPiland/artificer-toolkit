import { type SubmitEvent, useState } from 'react'
import { Button, PasswordInput } from '@mantine/core'
import { Link } from '#ui/primitives/Link'
import { browserAuthClient } from '../authClient'
import {
  authButton,
  authFieldHint,
  authFooterRow,
  authForm,
  authFormMessage,
  authFormMessageError,
  authFormMessageSuccess,
  inlineLink,
  inlineLinkIcon,
  inlineLinkIconGlyph,
  textInput
} from '../auth.css'
import { AuthDivider } from './AuthDivider'
import { AuthFormProps } from './authForm.types'
import IArrowLeft from '#assets/icons/IArrowLeft'

export function UpdatePasswordForm({ authClient = browserAuthClient, onSuccess }: AuthFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success', message: string } | null>(null)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    if (password.length < 8) {
      const message = 'Use at least 8 characters for your new password.'
      setFeedback({ tone: 'error', message })
      return
    }

    if (password !== confirmPassword) {
      const message = 'Enter the same password in both fields.'
      setFeedback({ tone: 'error', message })
      return
    }

    setIsSubmitting(true)

    try {
      const result = await authClient.updatePassword({ password })

      if (!result.ok) {
        const message = result.message ?? 'Try the recovery link again or request a new reset email.'
        setFeedback({ tone: 'error', message })
        return
      }

      const message = 'Use your new password the next time you sign in.'
      setFeedback({ tone: 'success', message })
      await onSuccess?.(result)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} method='post' onSubmit={handleSubmit}>
      <PasswordInput
        label='New password'
        classNames={{
          input: textInput
        }}
        autoComplete='new-password'
        name='password'
        type='password'
        placeholder='********'
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
        required
      />
      <p className={authFieldHint}>Use at least 8 characters. Avoid a password you use at another table or tool.</p>
      <PasswordInput
        label='Confirm password'
        classNames={{
          input: textInput
        }}
        autoComplete='new-password'
        name='confirmPassword'
        type='password'
        placeholder='********'
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.currentTarget.value)}
        required
      />
      <Button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Updating password...' : 'Update password'}
      </Button>
      {feedback && (
        <div
          className={`${authFormMessage} ${
            feedback.tone === 'error' ? authFormMessageError : authFormMessageSuccess
          }`}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
        >
          {feedback.message}
        </div>
      )}
      <AuthDivider />
      <div className={authFooterRow}>
        <Link className={inlineLink} to='/sign-in' type='anchor'>
          <span className={inlineLinkIcon} aria-hidden='true'>
            <IArrowLeft className={inlineLinkIconGlyph} size={14} />
          </span>
          Back to sign in
        </Link>
      </div>
    </form>
  )
}
