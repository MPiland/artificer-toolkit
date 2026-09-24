import { type SubmitEvent, useRef, useState } from 'react'
import { Anchor, Button, PinInput, TextInput } from '@mantine/core'
import { useHydrated } from '@tanstack/react-router'
import IArrowLeft from '#assets/icons/IArrowLeft'
import { browserAuthClient } from '../authClient'
import {
  authButton,
  authFooterRow,
  authForm,
  authFormMessage,
  authFormMessageError,
  fieldGroup,
  fieldHint,
  fieldLabel,
  inlineLink,
  inlineLinkIcon,
  inlineLinkIconGlyph,
  textInput,
  verificationCodeDigit,
  verificationCodeGroup
} from '../auth.css'
import { AuthDivider } from './AuthDivider'
import { AuthFormProps } from './authForm.types'

export function VerifyPasswordResetForm({
  authClient = browserAuthClient,
  initialEmail = '',
  onVerified,
  onSuccess
}: AuthFormProps & {
  initialEmail?: string
  onVerified?: (recovery: { email: string; token: string }) => void | Promise<void>
}) {
  const hydrated = useHydrated()
  const [email, setEmail] = useState(initialEmail)
  const [token, setToken] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isVerifying = useRef(false)

  async function verifyCode(code: string) {
    if (isVerifying.current || code.length !== 6) return

    if (!email.trim()) {
      setError('Enter the email address that received this verification code.')
      return
    }

    isVerifying.current = true
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await authClient.verifyPasswordRecovery({ email: email.trim(), token: code })
      if (!result.ok) {
        setError(result.message ?? 'That verification code is invalid or has expired.')
        return
      }

      const recovery = { email: email.trim(), token: code }
      await onVerified?.(recovery)
      await onSuccess?.(result)
    } finally {
      isVerifying.current = false
      setIsSubmitting(false)
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    void verifyCode(token)
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
        onChange={(event) => {
          setEmail(event.currentTarget.value)
          setError(null)
        }}
        disabled={!hydrated || isSubmitting}
        required
      />
      <div className={fieldGroup}>
        <span className={fieldLabel} id='verification-code-label'>
          Verification code
        </span>
        <p className={fieldHint}>Enter the six-digit code from your password reset email.</p>
        <PinInput
          aria-labelledby='verification-code-label'
          classNames={{ pinInput: verificationCodeDigit, root: verificationCodeGroup }}
          disabled={!hydrated || isSubmitting}
          error={Boolean(error)}
          getInputProps={(index) => ({
            'aria-label': `Verification code digit ${index + 1}`
          })}
          hiddenInputProps={{ pattern: '[0-9]{6}', required: true }}
          length={6}
          name='token'
          oneTimeCode
          type='number'
          value={token}
          onChange={(value) => {
            setToken(value)
            setError(null)
          }}
          onComplete={(value) => void verifyCode(value)}
        />
      </div>
      <Button
        className={authButton}
        type='submit'
        disabled={!hydrated || token.length !== 6}
        loading={isSubmitting}
      >
        Continue
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
