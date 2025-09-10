import {
  Alert,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  TextInput,
  PasswordInput,
  UnstyledButton,
} from '@mantine/core'
import { useNavigate, useMatches } from '@tanstack/react-router'
import Link from '~/components/Link'
import { auth_container, auth_link, auth_subtitle, auth_title, auth_wrapper, social_icon } from './Auth.css'
import IGoogle from '~/assets/Icons/IGoogle'
import ITwitter from '~/assets/Icons/ITwitter'
import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import { supabase } from '~/supabase'
import { notifications } from '@mantine/notifications'

const AuthForm = () => {
  const matches = useMatches()
  const routeMatch = matches[matches.length - 1]
  const registerPath = routeMatch.pathname === '/register/'
  const navigate = useNavigate()
  const [formMessage, setFormMessage] = useState<{ message: string } | null>(null)

  const AuthHint = ({ message }: { message: string }) => {
    return (
      <Alert variant='light' color='blue' icon={<Info />}>
        <Text size='sm'>{message}</Text>
      </Alert>
    )
  }

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onSubmitAsync: async ({ value: { email, password } }) => {
        if (registerPath) {
          await supabase.auth.signUp({ email, password, options: { emailRedirectTo: 'http://localhost:3000/' } })
          return navigate({ to: '/confirm', search: { email } })
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) {
            switch (error.code) {
              case 'email_not_confirmed':
                return setFormMessage({
                  message:
                    'Email for this account has not been confirmed. Please check your email for a confirmation link.',
                })
              case 'user_not_found':
              case 'invalid_credentials':
                return setFormMessage({
                  message: 'Invalid email and/or password',
                })
              default: {
                // This ensures we don't silently ignore new codes
                throw new Error(`Unhandled Supabase auth error code: ${error.code}`)
              }
            }
          }
          return navigate({ to: '/' })
        }
      },
    },
  })

  const { handleSubmit, reset } = form

  useEffect(() => {
    reset()
  }, [registerPath, reset])

  return (
    <Container
      component='form'
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleSubmit()
      }}
      className={auth_container}
    >
      <Stack className={auth_wrapper}>
        <Title ta='center' className={auth_title}>
          Welcome {!registerPath ? 'back!' : 'to Artificer Toolkit!'}
        </Title>
        <Text className={auth_subtitle}>
          {!registerPath ?
            <>
              {"Don't have an account yet? "}
              <Link type='anchor' to={'/register'} className={auth_link}>
                Create account
              </Link>
            </>
          : <>
              Already have an account?{' '}
              <Link type='anchor' to={'/login'} className={auth_link}>
                Login here
              </Link>
            </>
          }
        </Text>
        <Paper withBorder shadow='md' p={30} radius='md'>
          <Group grow mb='md' mt='md'>
            <Button classNames={{ section: social_icon }} variant='default' leftSection={<IGoogle />} radius='xl'>
              Google
            </Button>

            <Button classNames={{ section: social_icon }} variant='default' leftSection={<ITwitter />} radius='xl'>
              Twitter
            </Button>
          </Group>

          <Divider label='Or continue with email' labelPosition='center' my='lg' />
          <Stack>
            {formMessage && <AuthHint message={formMessage.message} />}
            <form.Field
              name='email'
              validators={{
                onBlur: ({ value }) =>
                  value && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value) ?
                    null
                  : 'Enter a valid email address.',
                onSubmit: ({ value }) => (!value || value === '') && 'Email is required',
              }}
            >
              {(field) => (
                <TextInput
                  label='Email'
                  placeholder='user@email.com'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={!field.state.meta.isValid && field.state.meta.errors.join(', ')}
                  autoComplete='username'
                />
              )}
            </form.Field>
            <form.Field
              name='password'
              validators={{
                onBlur: ({ value }) =>
                  value &&
                  (value.length <= 8 ? 'Password should include at least 8-20 characters'
                  : /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/.test(value) ? null
                  : 'Password should include at least one uppercase letter, one number and one special character'),
                onSubmit: ({ value }) => (!value || value === '') && 'Password is required',
              }}
            >
              {(field) => (
                <PasswordInput
                  label='Password'
                  placeholder='Password...'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  error={!field.state.meta.isValid && field.state.meta.errors.join(', ')}
                />
              )}
            </form.Field>
          </Stack>
          <Group justify='flex-end' mt='xl'>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button loading={isSubmitting} disabled={!canSubmit} radius='xl' type='submit'>
                  {registerPath ? 'Register' : 'Login'}
                </Button>
              )}
            </form.Subscribe>
          </Group>
        </Paper>
        {!registerPath && (
          <Text size='sm' c='dimmed'>
            Need to reset your password?{' '}
            <UnstyledButton
              type='button'
              size='sm'
              color='blue'
              onClick={async () => {
                const { error } = await supabase.auth.resetPasswordForEmail(form.state.values.email, {
                  redirectTo: 'http://localhost:3000/reset-password',
                })
                if (error) {
                  console.error(error.message)
                  return notifications.show({
                    message: 'Something went wrong',
                    color: 'red',
                    position: 'top-center',
                    autoClose: 2500,
                  })
                } else {
                  return notifications.show({
                    message: 'Confirmation link sent!',
                    color: 'green',
                    position: 'top-center',
                    autoClose: 2500,
                  })
                }
              }}
            >
              Click here
            </UnstyledButton>{' '}
            to receive a reset link.
          </Text>
        )}
      </Stack>
    </Container>
  )
}

export default AuthForm
