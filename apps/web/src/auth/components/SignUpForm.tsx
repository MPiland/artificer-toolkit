import { type SubmitEvent, useState } from 'react'
import { Button, PasswordInput, TextInput } from '@mantine/core'
import { Link } from '#app/components/Link/Link'
import IArrowRight from '#assets/Icons/IArrowRight'
import { browserAuthClient } from '../authClient'
import {
  authButton,
  authFooterRow,
  authForm,
  inlineLink,
  inlineLinkIcon,
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

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await authClient.signUp({ name, email, password })

      if (!result.ok) {
        showError('Unable to create account', result.message ?? 'Please try again.')
        return
      }

      if (result.session) {
        showSuccess('Account created', 'Your workspace is ready.')
      } else {
        showSuccess('Check your email', 'Confirmation instructions were sent.')
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
      <Button className={authButton} type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </Button>
      <AuthDivider />
      <div className={authFooterRow}>
        <span>Already have an account?</span>
        <Link className={inlineLink} to='/sign-in' type='anchor'>
          Sign in
          <span className={inlineLinkIcon} aria-hidden='true'>
            <IArrowRight size={14} />
          </span>
        </Link>
      </div>
    </form>
  )
}
