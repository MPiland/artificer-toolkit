import { Alert, Button, Container, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { useNavigate, useMatches } from '@tanstack/react-router'
import Link from '@/components/Link'
import { auth_container, auth_link, auth_subtitle, auth_title, auth_wrapper, social_icon } from './Auth.css'
import { signUp, signIn } from '@/apis/authApi'
import IGoogle from '@/assets/Icons/IGoogle'
import ITwitter from '@/assets/Icons/ITwitter'
import { useForm } from '@/hooks'
import type { InitiateAuthCommandOutput, SignUpCommandOutput } from '@aws-sdk/client-cognito-identity-provider'
import { useEffect } from 'react'
import { Info } from 'lucide-react'
import { Hub } from 'aws-amplify/utils'

const AUTH_ERRORS = {
  USER_NOT_CONFIRMED: 4,
  USER_ALREADY_EXISTS: 1,
} as const

const AuthForm = () => {
  const matches = useMatches()
  const routeMatch = matches[matches.length - 1]
  const registerPath = routeMatch.pathname === '/register/'
  const navigate = useNavigate()
  const { useAppForm } = useForm()

  const isSignUpResponse = (
    response: SignUpCommandOutput | { error: number; message: string }
  ): response is SignUpCommandOutput => {
    return !('error' in response)
  }

  const isSignInResponse = (
    response: InitiateAuthCommandOutput | { error: number; message: string }
  ): response is InitiateAuthCommandOutput => {
    return !('error' in response)
  }

  const AuthErrorHint = ({ errorCode, email }: { errorCode?: number; email?: string }) => {
    switch (errorCode) {
      case AUTH_ERRORS.USER_NOT_CONFIRMED:
        return (
          <Alert variant='light' color='red' icon={<Info />}>
            <Text size='sm'>
              Account not confirmed.{' '}
              <Link type='anchor' size='sm' to='/register/confirm' search={{ email }}>
                Confirm now
              </Link>
            </Text>
          </Alert>
        )
      case AUTH_ERRORS.USER_ALREADY_EXISTS:
        return (
          <Alert variant='light' color='blue' icon={<Info />}>
            <Text size='sm'>
              Account already exists.{' '}
              <Link type='anchor' size='sm' to='/login'>
                Login now
              </Link>
            </Text>
          </Alert>
        )
      default:
        return null
    }
  }

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
      persist: false,
    },
    validators: {
      onSubmitAsync: async ({ value: { email, password, persist }, formApi }) => {
        if (registerPath) {
          const result = await signUp({ email, password, persist })
          if (isSignUpResponse(result)) {
            if (result.UserConfirmed === false) {
              navigate({ to: '/register/confirm', search: { email } })
            }
          } else {
            return {
              form: {
                error: result.error,
                message: result.message,
              },
            }
          }
        } else {
          const result = await signIn({ email, password, persist })
          if (isSignInResponse(result)) {
            Hub.dispatch('auth', {
              event: 'signedIn',
            })
            if (!formApi.state.isSubmitting) {
              return navigate({ to: '/home' })
            }
          } else {
            return {
              form: {
                error: result.error,
                message: result.message,
              },
            }
          }
        }
      },
    },
  })

  const { AppForm, AppField, SubscribeSubmit, SubscribeAlert, handleSubmit, state, reset } = form

  useEffect(() => {
    reset()
  }, [routeMatch, reset])

  const formError = state.errorMap?.onSubmit?.form
  const errorCode = formError?.error

  return (
    <AppForm>
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
              <SubscribeAlert variant='light' color='red' />
              {errorCode && <AuthErrorHint errorCode={errorCode} email={state.values.email} />}
              <AppField
                name='email'
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return null
                    return /^\S+@\S+$/.test(value) ? null : 'Enter a valid email address.'
                  },
                  onSubmit: ({ value }) => (value && /^\S+@\S+$/.test(value) ? null : 'Enter a valid email address.'),
                }}
              >
                {({ TextField }) => (
                  <TextField
                    type='email'
                    autoComplete='username'
                    placeholder='user@example.com'
                    label='Email'
                    required
                  />
                )}
              </AppField>
              <AppField
                name='password'
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return null
                    return (
                      value.length <= 8 ? 'Password should include at least 8-20 characters'
                      : /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/.test(value) ? null
                      : 'Password should include at least one uppercase letter, one number and one special character'
                    )
                  },
                  onSubmit: ({ value }) =>
                    value &&
                    (value.length <= 8 ? 'Password should include at least 8-20 characters'
                    : /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/.test(value) ? null
                    : 'Password should include at least one uppercase letter, one number and one special character'),
                }}
              >
                {({ PasswordField }) => (
                  <PasswordField
                    type='password'
                    autoComplete={!registerPath ? 'current-password' : 'new-password'}
                    label='Password'
                    required
                  />
                )}
              </AppField>
              <Group justify='space-between'>
                <AppField name='persist'>{({ CheckboxField }) => <CheckboxField label='Remember me' />}</AppField>
                {!registerPath && (
                  <Link type='anchor' size='sm' to='/login/forgot-password'>
                    Forgot password?
                  </Link>
                )}
              </Group>
            </Stack>
            <Group justify='flex-end' mt='xl'>
              <SubscribeSubmit label={registerPath ? 'Register' : 'Login'} radius='xl' />
            </Group>
          </Paper>
        </Stack>
      </Container>
    </AppForm>
  )
}

export default AuthForm
