import { type MouseEvent, type SubmitEvent, useEffect, useRef, useState } from 'react'
import { Anchor, Button, PasswordInput, TextInput } from '@mantine/core'
import { useHydrated } from '@tanstack/react-router'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordInputSchema,
  usernameInputSchema
} from '@artificer-toolkit/schema/api/auth'
import type {
  AuthInvitationRedeemInput,
  AuthPasswordResetInput
} from '@artificer-toolkit/schema/api/auth'
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
import { usernameFormatMessage, usernameRuleDescription } from '../usernameMessages'
import { AuthDivider } from './AuthDivider'
import { AuthFormFeedback } from './AuthFormFeedback'
import type { AuthFeedback, AuthFormProps } from './authForm.types'
import IArrowLeft from '#assets/icons/IArrowLeft'
import { PasswordMatchFeedback } from './PasswordMatchFeedback'

export function UpdatePasswordForm({
  authClient = browserAuthClient,
  invitation = false,
  invitationCredentials,
  recovery,
  onBackToSignIn,
  onSuccess
}: AuthFormProps & {
  invitation?: boolean
  invitationCredentials?: Pick<AuthInvitationRedeemInput, 'email' | 'token'>
  recovery?: Pick<AuthPasswordResetInput, 'email' | 'token'>
  onBackToSignIn?: () => void | Promise<void>
}) {
  const hydrated = useHydrated()
  const formRef = useRef<HTMLFormElement>(null)
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null)

  useEffect(() => {
    if (!formRef.current) return
    // Preserve native typing/autofill in the SSR form before React attached handlers.
    const values = new FormData(formRef.current)
    setUsername(String(values.get('username') ?? ''))
    setPassword(String(values.get('password') ?? ''))
    setConfirmPassword(String(values.get('confirmPassword') ?? ''))
  }, [])

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
    setUsernameError(null)

    const parsedUsername = invitation ? usernameInputSchema.safeParse(username) : null
    if (parsedUsername && !parsedUsername.success) {
      setUsernameError(usernameFormatMessage)
      return
    }

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
        invitation && parsedUsername?.success && invitationCredentials
          ? await authClient.completeInvitation({
              ...invitationCredentials,
              password: parsedPassword.data,
              username: parsedUsername.data
            })
          : recovery
            ? await authClient.resetPassword({ ...recovery, password: parsedPassword.data })
            : {
                ok: false,
                message: 'Request a new verification code before resetting your password.'
              }

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
    <form ref={formRef} className={authForm} method='post' onSubmit={handleSubmit}>
      {invitation && (
        <TextInput
          label='Username'
          description={usernameRuleDescription}
          classNames={{ input: textInput }}
          autoComplete='username'
          error={usernameError}
          maxLength={30}
          name='username'
          placeholder='morgan_emberfall'
          value={username}
          onChange={(event) => {
            setUsername(event.currentTarget.value)
            setUsernameError(null)
          }}
          disabled={isSubmitting}
          required
        />
      )}
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
        disabled={isSubmitting}
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
        disabled={isSubmitting}
        required
      />
      <PasswordMatchFeedback confirmation={confirmPassword} password={password} />
      <Button
        className={authButton}
        type='submit'
        loading={isSubmitting}
        disabled={!hydrated || (invitation && !invitationCredentials)}
      >
        {invitation ? 'Complete registration' : 'Update password'}
      </Button>
      <AuthFormFeedback feedback={feedback} />
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
