import { type SubmitEvent, useState } from 'react'
import { Anchor, Button, TextInput } from '@mantine/core'
import IArrowLeft from '#assets/icons/IArrowLeft'
import { browserAuthClient } from '../authClient'
import {
  authButton,
  authFooterRow,
  authForm,
  authFormMessage,
  authFormMessageError,
  inlineLink,
  inlineLinkIcon,
  inlineLinkIconGlyph,
  textInput
} from '../auth.css'
import { AuthDivider } from './AuthDivider'
import { AuthFormProps } from './authForm.types'

export function VerifyPasswordResetForm({
  authClient = browserAuthClient,
  onSuccess
}: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await authClient.verifyPasswordRecovery({ email, token })
      if (!result.ok) {
        setError(result.message ?? 'That verification code is invalid or has expired.')
        return
      }

      await onSuccess?.(result)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} method='post' onSubmit={handleSubmit}>
      <TextInput
        label='Email address'
        classNames={{ input: textInput }}
        autoComplete='email'
        name='email'
        type='email'
        placeholder='you@example.com'
        value={email}
        onChange={(event) => setEmail(event.currentTarget.value)}
        required
      />
      <TextInput
        label='Verification code'
        description='Enter the six-digit code from your password reset email.'
        classNames={{ input: textInput }}
        autoComplete='one-time-code'
        inputMode='numeric'
        maxLength={6}
        minLength={6}
        name='token'
        pattern='[0-9]{6}'
        placeholder='123456'
        value={token}
        onChange={(event) => setToken(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
        required
      />
      <Button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Verifying code...' : 'Continue'}
      </Button>
      {error && (
        <div
          className={`${authFormMessage} ${authFormMessageError}`}
          role='alert'
          aria-live='assertive'
        >
          {error}
        </div>
      )}
      <AuthDivider />
      <div className={authFooterRow}>
        <Anchor className={inlineLink} href='/reset-password'>
          <span className={inlineLinkIcon} aria-hidden='true'>
            <IArrowLeft className={inlineLinkIconGlyph} size={14} />
          </span>
          Request another code
        </Anchor>
      </div>
    </form>
  )
}
