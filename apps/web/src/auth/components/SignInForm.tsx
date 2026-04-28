import { type SubmitEvent, useState } from 'react'
import { showError, showSuccess } from './authForm.utils'
import { browserAuthClient } from '../authClient'
import { AuthFormProps } from './authForm.types'
import {
  authButton,
  authFooterRow,
  authForm,
  authFormMessage,
  authFormMessageError,
  authFormMessageSuccess,
  forgotRow,
  inlineLink,
  inlineLinkIcon,
  inlineLinkIconGlyph,
  textInput
} from '../auth.css'
import { Link } from '#app/components/Link/Link'
import { AuthDivider } from './AuthDivider'
import { Button, PasswordInput, TextInput } from '@mantine/core'
import IArrowRight from '#assets/icons/IArrowRight'

export function SignInForm({ authClient = browserAuthClient, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const result = await authClient.signIn({ email, password })

      if (!result.ok) {
        const message = result.message ?? 'Check your email and password, then try again.'
        setFeedback({ tone: 'error', message })
        showError('Unable to sign in', message)
        return
      }

      const message = 'Your toolkit is ready.'
      setFeedback({ tone: 'success', message })
      showSuccess('Signed in', message)
      await onSuccess?.(result)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} onSubmit={handleSubmit}>
      <TextInput
        label='Email address'
        classNames={{
          input: textInput
        }}
        name='email'
        type='email'
        placeholder='you@example.com'
        value={email}
        onChange={(event) => setEmail(event.currentTarget.value)}
        required
      />
      <PasswordInput
        label='Password'
        classNames={{
          input: textInput
        }}
        name='password'
        type='password'
        placeholder='********'
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
        required
      />
      <div className={forgotRow}>
        <Link className={inlineLink} to='/reset-password' type='anchor'>
          Forgot password?
        </Link>
      </div>
      <Button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Opening toolkit...' : 'Sign in'}
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
        <span>{`Don't have an account?`}</span>
        <Link className={inlineLink} to='/sign-up' type='anchor'>
          Sign up
          <span className={inlineLinkIcon} aria-hidden='true'>
            <IArrowRight className={inlineLinkIconGlyph} size={14} />
          </span>
        </Link>
      </div>
    </form>
  )
}
