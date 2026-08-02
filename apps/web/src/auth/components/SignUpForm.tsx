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
import { api } from '#app/lib/api'
import { browserAuthClient } from '../authClient'
import { suggestUsername } from '../usernameSuggestion'
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
import { AuthFormProps } from './authForm.types'
import { AuthDivider } from './AuthDivider'

const usernameRuleMessage =
  'Use 3–30 letters, numbers, and single underscores between words. Capitalization is preserved.'

export function SignUpForm({
  authClient = browserAuthClient,
  getUsernameStatus = (username) => api.account.usernameStatus({ username }),
  onSuccess
}: AuthFormProps & {
  getUsernameStatus?: (username: string) => Promise<AccountUsernameStatusDto>
}) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(
    null
  )

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()

    const parsedPassword = passwordInputSchema.safeParse(password)
    if (!parsedPassword.success) {
      setFeedback({
        tone: 'error',
        message: parsedPassword.error.issues[0]?.message ?? 'Enter a valid password.'
      })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)
    setUsernameError(null)

    try {
      const parsedUsername = usernameInputSchema.safeParse(username)
      if (!parsedUsername.success) {
        setUsernameError(usernameRuleMessage)
        return
      }

      const usernameStatus = await getUsernameStatus(parsedUsername.data)
      if (usernameStatus.status !== 'available') {
        setUsernameError(
          usernameStatus.status === 'taken'
            ? 'That username is already taken.'
            : "That username isn't allowed."
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

      if (result.session) {
        const message = 'Your toolkit is ready.'
        setFeedback({ tone: 'success', message })
      } else {
        const message =
          'If an account can be created for that email, a confirmation email has been sent.'
        setFeedback({ tone: 'success', message })
      }
      await onSuccess?.(result)
    } catch {
      setFeedback({ tone: 'error', message: 'Could not create your account. Try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSuggestUsername() {
    setIsSuggesting(true)
    setUsernameError(null)

    try {
      const suggestion = await suggestUsername(email, getUsernameStatus)
      if (!suggestion) {
        setUsernameError('Could not find an available suggestion. Try another username.')
        return
      }

      setUsername(suggestion)
    } catch {
      setUsernameError('Could not suggest a username right now.')
    } finally {
      setIsSuggesting(false)
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
        required
      />
      <TextInput
        label='Username'
        description={usernameRuleMessage}
        classNames={{
          input: textInput
        }}
        autoComplete='nickname'
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
        required
      />
      <Button loading={isSuggesting} type='button' variant='subtle' onClick={handleSuggestUsername}>
        Suggest username
      </Button>
      <PasswordInput
        label='Password'
        description={`Use ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`}
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
      <Button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
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
