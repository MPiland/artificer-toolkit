import { type SubmitEvent, useState } from 'react'
import { Anchor, Button, PasswordInput, TextInput } from '@mantine/core'
import { usernameInputSchema } from '@artificer-toolkit/schema/api/auth'
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
  onSuccess
}: AuthFormProps & { invitation?: boolean }) {
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(
    null
  )

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setUsernameError(null)

    const parsedUsername = invitation ? usernameInputSchema.safeParse(username) : null
    if (parsedUsername && !parsedUsername.success) {
      setUsernameError(
        'Use 3–30 letters, numbers, and single underscores between words. Capitalization is preserved.'
      )
      return
    }

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
      const result =
        invitation && parsedUsername?.success
          ? await authClient.completeInvitation({
              password,
              username: parsedUsername.data
            })
          : await authClient.updatePassword({ password })

      if (!result.ok) {
        const message = result.message ?? 'Could not complete this account update.'
        if (invitation && message.toLowerCase().includes('username')) {
          setUsernameError(message)
        } else {
          setFeedback({ tone: 'error', message })
        }
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
      {invitation && (
        <TextInput
          label='Username'
          description='Use 3–30 letters, numbers, and single underscores between words. Capitalization is preserved.'
          classNames={{
            input: textInput
          }}
          autoComplete='nickname'
          error={usernameError}
          maxLength={30}
          name='username'
          placeholder='morgan_emberfall'
          value={username}
          onChange={(event) => {
            setUsername(event.currentTarget.value)
            setUsernameError(null)
          }}
          required
        />
      )}
      <PasswordInput
        label='New password'
        description='Use at least 8 characters. Avoid a password you use at another table or tool.'
        classNames={{
          input: textInput
        }}
        autoComplete='new-password'
        minLength={8}
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
        minLength={8}
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
