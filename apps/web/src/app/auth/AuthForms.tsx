import {
  Anchor,
  Button,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { getSupabaseBrowserClient } from '../../supabase/client'

function showError(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: 'red'
  })
}

function showSuccess(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: 'green'
  })
}

export function LoginForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        showError('Unable to sign in', error.message)
        return
      }

      showSuccess('Signed in', 'Your workspace is ready.')
      await navigate({ to: '/home' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap='md'>
        <TextInput
          label='Email'
          name='email'
          type='email'
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
        />
        <PasswordInput
          label='Password'
          name='password'
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          required
        />
        <Button type='submit' loading={isSubmitting}>
          Sign in
        </Button>
        <Group justify='space-between'>
          <Anchor component={Link} to='/reset-password' size='sm'>
            Forgot password?
          </Anchor>
          <Anchor component={Link} to='/signup' size='sm'>
            Create account
          </Anchor>
        </Group>
      </Stack>
    </form>
  )
}

export function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signUp({
        email,
        password
      })

      if (error) {
        showError('Unable to create account', error.message)
        return
      }

      showSuccess('Check your email', 'Confirmation instructions were sent.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap='md'>
        <TextInput
          label='Email'
          name='email'
          type='email'
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
        />
        <PasswordInput
          label='Password'
          name='password'
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          required
        />
        <Button type='submit' loading={isSubmitting}>
          Create account
        </Button>
        <Text size='sm' c='dimmed'>
          Already have an account?{' '}
          <Anchor component={Link} to='/login'>
            Sign in
          </Anchor>
        </Text>
      </Stack>
    </form>
  )
}

export function ResetPasswordForm() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const redirectTo = typeof window === 'undefined'
        ? undefined
        : `${window.location.origin}/auth/confirmed`

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      })

      if (error) {
        showError('Unable to send reset link', error.message)
        return
      }

      showSuccess('Reset link sent', 'Check your inbox for the secure link.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap='md'>
        <TextInput
          label='Email'
          name='email'
          type='email'
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
        />
        <Button type='submit' loading={isSubmitting}>
          Send reset link
        </Button>
        <Text size='sm' c='dimmed'>
          Return to{' '}
          <Anchor component={Link} to='/login'>
            sign in
          </Anchor>
          .
        </Text>
      </Stack>
    </form>
  )
}
