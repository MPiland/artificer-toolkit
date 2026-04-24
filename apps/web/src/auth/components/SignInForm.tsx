import { type SubmitEvent, useState } from 'react'
import { showError, showSuccess } from './authForm.utils'
import { browserAuthClient } from '../authClient'
import { AuthFormProps } from './authForm.types'
import { authButton, authFooterRow, authForm, forgotRow, inlineLink, inlineLinkIcon, textInput } from '../auth.css'
import { Link } from '#app/components/Link/Link'
import { AuthDivider } from './AuthDivider'
import { Button, PasswordInput, TextInput } from '@mantine/core'
import IArrowRight from '#assets/icons/IArrowRight'

export function SignInForm({ authClient = browserAuthClient, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await authClient.signIn({ email, password })

      if (!result.ok) {
        showError('Unable to sign in', result.message ?? 'Please try again.')
        return
      }

      showSuccess('Signed in', 'Your workspace is ready.')
      await onSuccess?.()
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
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
      <AuthDivider />
      <div className={authFooterRow}>
        <span>{`Don't have an account?`}</span>
        <Link className={inlineLink} to='/sign-up' type='anchor'>
          Sign up
          <span className={inlineLinkIcon} aria-hidden='true'>
            <IArrowRight size={14} />
          </span>
        </Link>
      </div>
    </form>
  )
}
