import { type MouseEvent, type SubmitEvent, useState } from 'react'
import { Anchor, Button, PasswordInput } from '@mantine/core'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordInputSchema
} from '@artificer-toolkit/schema/api/auth'
import { browserAuthClient } from '../authClient'
import {
  authButton,
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

export function UpdatePasswordForm({
  authClient = browserAuthClient,
  invitation = false,
  onBackToSignIn,
  onSuccess
}: AuthFormProps & { invitation?: boolean; onBackToSignIn?: () => void | Promise<void> }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(
    null
  )

  async function handleBackToSignIn(event: MouseEvent<HTMLAnchorElement>) {
    if (!onBackToSignIn) return

    event.preventDefault()
    setFeedback(null)

    const result = await authClient.signOut()
    if (!result.ok) {
      setFeedback({
        tone: 'error',
        message: result.message ?? 'Could not return to sign in.'
      })
      return
    }

    await onBackToSignIn()
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    const parsedPassword = passwordInputSchema.safeParse(password)
    if (!parsedPassword.success) {
      setFeedback({
        tone: 'error',
        message: parsedPassword.error.issues[0]?.message ?? 'Enter a valid password.'
      })
      return
    }

    if (password !== confirmPassword) {
      const message = 'Enter the same password in both fields.'
      setFeedback({ tone: 'error', message })
      return
    }

    setIsSubmitting(true)

    try {
      const result =
        invitation
          ? await authClient.completeInvitation({ password: parsedPassword.data })
          : await authClient.updatePassword({ password: parsedPassword.data })

      if (!result.ok) {
        const message = result.message ?? 'Could not complete this account update.'
        setFeedback({ tone: 'error', message })
        return
      }

      const message = invitation
        ? 'Your account is ready.'
        : 'Use your new password the next time you sign in.'
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
        description={`Use ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters. Avoid a password you use at another table or tool.`}
        classNames={{
          input: textInput
        }}
        autoComplete='new-password'
        minLength={PASSWORD_MIN_LENGTH}
        maxLength={PASSWORD_MAX_LENGTH}
        name='password'
        type='password'
        placeholder='********'
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
        required
      />
      <PasswordInput
        label='Confirm password'
        classNames={{
          input: textInput
        }}
        autoComplete='new-password'
        minLength={PASSWORD_MIN_LENGTH}
        maxLength={PASSWORD_MAX_LENGTH}
        name='confirmPassword'
        type='password'
        placeholder='********'
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.currentTarget.value)}
        required
      />
      <Button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting
          ? invitation
            ? 'Completing registration...'
            : 'Updating password...'
          : invitation
            ? 'Complete registration'
            : 'Update password'}
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
        <Anchor className={inlineLink} href='/sign-in' onClick={handleBackToSignIn}>
          <span className={inlineLinkIcon} aria-hidden='true'>
            <IArrowLeft className={inlineLinkIconGlyph} size={14} />
          </span>
          Back to sign in
        </Anchor>
      </div>
    </form>
  )
}
