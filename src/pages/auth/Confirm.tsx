import { Container, Paper, Text, Title, Alert, Group, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { auth_container, auth_title, auth_wrapper } from './Auth.css'
import { confirmSignUp, resendConfirmationCode, confirmForgotPassword } from '@/apis/authApi'
import { useForm } from '@/hooks'
import type {
  ConfirmForgotPasswordCommandOutput,
  ConfirmSignUpCommandOutput,
  ResendConfirmationCodeCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider'
import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { useMatches } from '@tanstack/react-router'

type ConfirmMeta = {
  submitAction: 'resend' | null
}

const defaultMeta: ConfirmMeta = {
  submitAction: null,
}

const ConfirmStep = () => {
  const matches = useMatches()
  const routeMatch = matches[matches.length - 1]
  const registerPath = routeMatch.routeId === '/_auth/register/confirm'
  const userEmail = routeMatch && 'email' in routeMatch.search ? routeMatch.search.email : ''

  const navigate = useNavigate()
  const { useAppForm } = useForm()
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<'confirmed' | 'reset' | null>(null)

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        console.log('redirecting')
        navigate({ to: '/login' })
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [success, navigate])

  const isConfirmCodeResponse = (
    response: ConfirmSignUpCommandOutput | { error: number; message: string }
  ): response is ConfirmSignUpCommandOutput => {
    return !('error' in response)
  }

  const isConfirmForgotResponse = (
    response: ConfirmForgotPasswordCommandOutput | { error: number; message: string }
  ): response is ConfirmForgotPasswordCommandOutput => {
    return !('error' in response)
  }

  const isResendCodeResponse = (
    response: ResendConfirmationCodeCommandOutput | { error: number; message: string }
  ): response is ResendConfirmationCodeCommandOutput => {
    return !('error' in response)
  }

  const form = useAppForm({
    defaultValues: {
      email: userEmail || '',
      password: '',
      confirmationCode: '',
    },
    onSubmitMeta: defaultMeta,
    onSubmit: async ({ value: { confirmationCode, email, password }, formApi, meta: { submitAction } }) => {
      if (submitAction === 'resend') {
        const result = await resendConfirmationCode({ email })
        if (isResendCodeResponse(result)) {
          return setFormMessage('Check your inbox for the new code.')
        } else {
          return formApi.setErrorMap({
            onSubmit: {
              form: {
                error: result.error,
                message: result.message,
              },
              fields: {
                email: null,
                password: null,
                confirmationCode: null,
              },
            },
          })
        }
      } else if (registerPath) {
        const result = await confirmSignUp({ email, code: confirmationCode })
        if (isConfirmCodeResponse(result)) {
          if (result.$metadata.httpStatusCode === 200) {
            formApi.reset()
            setFormMessage('Your email is confirmed! Redirecting to login...')
            setSuccess('confirmed')
            return
          }
        } else {
          return formApi.setErrorMap({
            onSubmit: {
              form: {
                error: result.error,
                message: result.message,
              },
              fields: {
                email: null,
                password: null,
                confirmationCode: null,
              },
            },
          })
        }
      } else if (!registerPath) {
        const result = await confirmForgotPassword({ email, code: confirmationCode, newPassword: password })
        if (isConfirmForgotResponse(result)) {
          formApi.reset()
          setFormMessage('Your password is reset! Redirecting to login...')
          setSuccess('reset')
          return
        } else {
          return formApi.setErrorMap({
            onSubmit: {
              form: {
                error: result.error,
                message: result.message,
              },
              fields: {
                email: null,
                password: null,
                confirmationCode: null,
              },
            },
          })
        }
      }
    },
  })

  const { AppForm, AppField, SubscribeSubmit, SubscribeAlert, handleSubmit } = form

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
            {registerPath ? 'Confirm Registration' : 'Reset Password'}
          </Title>
          <Paper withBorder shadow='md' p={30} radius='md'>
            <Stack>
              <SubscribeAlert variant='light' color='red' />
              {formMessage && (
                <Alert variant='light' color='blue' icon={<Info />} mb='sm'>
                  {formMessage}
                </Alert>
              )}
              <AppField name='confirmationCode'>
                {({ TextField }) => <TextField label='Confirmation code' placeholder='Confirmation code...' />}
              </AppField>
              {!registerPath && (
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
                    <PasswordField type='password' autoComplete='new-password' label='New password' required />
                  )}
                </AppField>
              )}
            </Stack>
            <SubscribeSubmit label='Submit code' fullWidth mt='lg' />
          </Paper>
          <Group gap={4} px='md'>
            <Text size='xs'>
              {"Didn't recieve a code or need a new one? "}
              to request a new code.
            </Text>
            <Text
              size='xs'
              c='blue'
              style={{ cursor: 'pointer' }}
              onClick={() => handleSubmit({ submitAction: 'resend' })}
            >
              Click here
            </Text>
            <Text size='xs'>to request a new code.</Text>
          </Group>
        </Stack>
      </Container>
    </AppForm>
  )
}

export default ConfirmStep
