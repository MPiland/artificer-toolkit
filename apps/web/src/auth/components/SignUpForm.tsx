import { type SubmitEvent, useState } from 'react'
import { Button, PasswordInput, TextInput } from '@mantine/core'
import { Link } from '#app/ui/primitives/Link/Link'
import IArrowRight from '#assets/icons/IArrowRight'
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
import { AuthFormProps } from './authForm.types'
import { showError, showSuccess } from './authForm.utils'
import { AuthDivider } from './AuthDivider'

export function SignUpForm({ authClient = browserAuthClient, onSuccess }: AuthFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()

    if (password.length < 8) {
      const message = 'Use at least 8 characters for your password.'
      setFeedback({ tone: 'error', message })
      showError('Password is too short', message)
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const result = await authClient.signUp({ name, email, password })

      if (!result.ok) {
        const message = result.message ?? 'Check the form and try again.'
        setFeedback({ tone: 'error', message })
        showError('Unable to create account', message)
        return
      }

      if (result.session) {
        const message = 'Your toolkit is ready.'
        setFeedback({ tone: 'success', message })
        showSuccess('Account created', message)
      } else {
        const message = 'Confirmation instructions were sent if email is enabled for this project.'
        setFeedback({ tone: 'success', message })
        showSuccess('Check your email', message)
      }
      await onSuccess?.(result)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} onSubmit={handleSubmit}>
      <TextInput
        label='Name'
        classNames={{
          input: textInput
        }}
        name='name'
        type='text'
        placeholder='Morgan Emberfall'
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        required
      />
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
      <p className={authFieldHint}>Use at least 8 characters. A mix of letters and numbers is easier to keep secure.</p>
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
        <Link className={inlineLink} to='/sign-in' type='anchor'>
          Sign in
          <span className={inlineLinkIcon} aria-hidden='true'>
            <IArrowRight className={inlineLinkIconGlyph} size={14} />
          </span>
        </Link>
      </div>
    </form>
  )
}
