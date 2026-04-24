import { type FormEvent, useState } from 'react'
import { Button, TextInput } from '@mantine/core'
import { Link } from '#app/components/Link/Link'
import IArrowLeft from '#assets/Icons/IArrowLeft'
import { browserAuthClient } from '../authClient'
import {
  authButton,
  authForm,
  inlineLink,
  inlineLinkIcon,
  textInput
} from '../auth.css'
import { AuthDivider } from './AuthDivider'
import { showError, showSuccess } from './authForm.utils'
import { AuthFormProps } from './authForm.types'

export function ResetPasswordForm({ authClient = browserAuthClient, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await authClient.requestPasswordReset({ email })

      if (!result.ok) {
        showError('Unable to send reset link', result.message ?? 'Please try again.')
        return
      }

      showSuccess('Reset link sent', 'Check your inbox for the secure link.')
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
      <Button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Sending link...' : 'Send reset link'}
      </Button>
      <AuthDivider />
      <Link className={inlineLink} to='/sign-in' type='anchor'>
        <span className={inlineLinkIcon} aria-hidden='true'>
          <IArrowLeft size={14} />
        </span>
        Back to sign in
      </Link>
    </form>
  )
}
