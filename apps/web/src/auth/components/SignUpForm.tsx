import { type SubmitEvent, useState } from 'react'
import { Anchor, Button, PasswordInput, TextInput } from '@mantine/core'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordInputSchema
} from '@artificer-toolkit/schema/api/auth'
import IArrowRight from '#assets/icons/IArrowRight'
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
import { AuthFormProps } from './authForm.types'
import { AuthDivider } from './AuthDivider'

export function SignUpForm({
  authClient = browserAuthClient,
  onSuccess
}: AuthFormProps) {
  const [email, setEmail] = useState('')
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

    try {
      const result = await authClient.signUp({
        email,
        password: parsedPassword.data
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
