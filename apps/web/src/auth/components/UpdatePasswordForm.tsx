import { type FormEvent, useState } from 'react'
import { Button, PasswordInput } from '@mantine/core'
import { Link } from '#app/components/Link/Link'
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
import IArrowLeft from '#assets/Icons/IArrowLeft'

export function UpdatePasswordForm({ authClient = browserAuthClient, onSuccess }: AuthFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password !== confirmPassword) {
      showError('Passwords do not match', 'Enter the same password in both fields.')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await authClient.updatePassword({ password })

      if (!result.ok) {
        showError('Unable to update password', result.message ?? 'Please try again.')
        return
      }

      showSuccess('Password updated', 'Use your new password the next time you sign in.')
      await onSuccess?.(result)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={authForm} onSubmit={handleSubmit}>
      <PasswordInput
        label='New password'
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
      <PasswordInput
        label='Confirm password'
        classNames={{
          input: textInput
        }}
        name='confirmPassword'
        type='password'
        placeholder='********'
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.currentTarget.value)}
        required
      />
      <Button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Updating password...' : 'Update password'}
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
