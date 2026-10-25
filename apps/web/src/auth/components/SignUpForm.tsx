import { type SubmitEvent, useState } from 'react'
import { Anchor, Button, PasswordInput, TextInput } from '@mantine/core'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordInputSchema,
  usernameInputSchema
} from '@artificer-toolkit/schema/api/auth'
import type { AccountUsernameStatusDto } from '@artificer-toolkit/schema/api/account'
import IArrowRight from '#assets/icons/IArrowRight'
import { getUsernameStatus as readUsernameStatus } from '../usernameStatus'
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
import {
  usernameFormatMessage,
  usernameNotAllowedMessage,
  usernameRuleDescription,
  usernameTakenMessage
} from '../usernameMessages'
import type { AuthFeedback, AuthFormProps } from './authForm.types'
import { AuthDivider } from './AuthDivider'
import { AuthFormFeedback } from './AuthFormFeedback'
import { PasswordMatchFeedback } from './PasswordMatchFeedback'

export function SignUpForm({
  authClient = browserAuthClient,
  getUsernameStatus = readUsernameStatus,
  onSuccess
}: AuthFormProps & {
  getUsernameStatus?: (username: string) => Promise<AccountUsernameStatusDto>
}) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()

    const parsedUsername = usernameInputSchema.safeParse(username)
    if (!parsedUsername.success) {
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
      setFeedback({ tone: 'error', message: 'Enter the same password in both fields.' })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)
    setUsernameError(null)

    try {
      const usernameStatus = await getUsernameStatus(parsedUsername.data)
      if (usernameStatus.status !== 'available') {
        setUsernameError(
          usernameStatus.status === 'taken' ? usernameTakenMessage : usernameNotAllowedMessage
        )
        return
      }

      const result = await authClient.signUp({
        email,
        password: parsedPassword.data,
        username: parsedUsername.data
      })

      if (!result.ok) {
        const message = result.message ?? 'Check the form and try again.'
        setFeedback({ tone: 'error', message })
        return
      }

      const message =
        "If we can create an account with that email, we'll send a confirmation link. Check your inbox."
      setFeedback({ tone: 'success', message })
      await onSuccess?.(result)
    } catch {
      setFeedback({ tone: 'error', message: 'Could not create your account. Try again.' })
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
        disabled={isSubmitting}
        required
      />
      <TextInput
        label='Username'
        description={usernameRuleDescription}
        classNames={{
          input: textInput
        }}
        autoComplete='username'
        error={usernameError}
        maxLength={30}
        name='username'
        type='text'
        placeholder='morgan_emberfall'
        value={username}
        onChange={(event) => {
          setUsername(event.currentTarget.value)
          setUsernameError(null)
        }}
        disabled={isSubmitting}
        required
      />
      <PasswordInput
        label='Password'
        description={`Use ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.`}
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
        classNames={{ input: textInput }}
        autoComplete='new-password'
        minLength={PASSWORD_MIN_LENGTH}
        maxLength={PASSWORD_MAX_LENGTH}
        name='confirmPassword'
        placeholder='********'
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.currentTarget.value)}
        disabled={isSubmitting}
        required
      />
      <PasswordMatchFeedback confirmation={confirmPassword} password={password} />
      <Button className={authButton} type='submit' loading={isSubmitting}>
        Create account
      </Button>
      <AuthFormFeedback feedback={feedback} />
      <AuthDivider />
      <div className={authFooterRow}>
        <span>Already have an account?</span>
        <Anchor className={inlineLink} href='/sign-in'>
          Sign in
          <span className={inlineLinkIcon} aria-hidden='true'>
            <IArrowRight className={inlineLinkIconGlyph} size={14} />
          </span>
        </Anchor>
      </div>
    </form>
  )
}
