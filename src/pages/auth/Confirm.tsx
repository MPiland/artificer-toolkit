import { Container, Paper, Text, Title, Alert, Group, Stack, TextInput, PasswordInput, Button } from '@mantine/core'
import { useNavigate, type ToOptions } from '@tanstack/react-router'
import { auth_container, auth_title, auth_wrapper } from './Auth.css'
import { confirmSignUp, resendSignUpCode, confirmResetPassword } from '@/apis/auth.api'
import { useState } from 'react'
import { Info } from 'lucide-react'
import { useMatches } from '@tanstack/react-router'
import { notifications } from '@mantine/notifications'
import { useForm } from '@tanstack/react-form'


type ConfirmMeta = {
  submitAction: 'resend' | null
}

const defaultMeta: ConfirmMeta = {
  submitAction: null,
}

const ConfirmStep = () => {
  const navigate = useNavigate()
  const matches = useMatches()
  const routeMatch = matches[matches.length - 1]
  const registerPath = routeMatch.routeId === '/_auth/register/confirm'
  const userEmail =
    routeMatch.search && typeof routeMatch.search === 'object' && 'email' in routeMatch.search ?
      routeMatch.search.email
    : ''

  const [formMessage, setFormMessage] = useState<string | null>(null)

  const isConfirmCodeResponse = (
    response: { success: number; link: ToOptions['to'] } | { error: number; message: string }
  ): response is { success: number; link: ToOptions['to'] } => {
    return !('error' in response)
  }

  const isConfirmForgotResponse = (
    response: { success: number; link: ToOptions['to'] } | { error: number; message: string }
  ): response is { success: number; link: ToOptions['to'] } => {
    return !('error' in response)
  }

  const isResendCodeResponse = (
    response: { success: number; link: ToOptions['to'] } | { error: number; message: string }
  ): response is { success: number; link: ToOptions['to'] } => {
    return !('error' in response)
  }

  const form = useForm({
    defaultValues: {
      email: userEmail || '',
      password: '',
      confirmationCode: '',
    },
    onSubmitMeta: defaultMeta,
    onSubmit: async ({ value: { confirmationCode, email, password }, formApi, meta: { submitAction } }) => {
      if (submitAction === 'resend') {
        const result = await resendSignUpCode({ email })
        if (isResendCodeResponse(result)) {
          return setFormMessage('If an account with this email exists, a confirmation code will be sent.')
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
        const result = await confirmSignUp({ email, confirmationCode })
        if (isConfirmCodeResponse(result)) {
          if (result.success === 4) {
            formApi.reset()
            notifications.show({
              id: 'confirm-success',
              position: 'bottom-center',
              message: 'Your account is confirmed!',
              autoClose: 4000,
              withBorder: true,
            })
            return navigate({ to: '/home' })
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
        const result = await confirmResetPassword({ email, confirmationCode, password })
        if (isConfirmForgotResponse(result)) {
          formApi.reset()
          notifications.show({
            id: 'confirm-success',
            position: 'bottom-center',
            message: 'Your password is reset!',
            autoClose: 4000,
            withBorder: true,
          })
          return navigate({ to: '/login' })
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

  const { handleSubmit } = form

  return (
    <form>
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
              <form.Subscribe selector={(state) => [state.errorMap as any]}>
                {([errorMap]) => {
                  let errorMessage = ''
                  if (errorMap?.onSubmit?.form?.message) {
                    errorMessage = errorMap.onSubmit.form.message
                  } else if (errorMap.onSubmit && 'message' in errorMap.onSubmit) {
                    errorMessage = errorMap.onSubmit.message as string
                  }
                  return (
                    errorMessage && (
                      <Alert variant='light' color='red' icon={<Info />}>
                        {errorMessage}
                      </Alert>
                    )
                  )
                }}
              </form.Subscribe>
              {formMessage && (
                <Alert variant='light' color='blue' icon={<Info />} mb='sm'>
                  {formMessage}
                </Alert>
              )}
              <form.Field name='confirmationCode'>
                {(field) => (
                  <TextInput
                    label='Confirmation code'
                    placeholder='Confirmation code...'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    error={!field.state.meta.isValid && field.state.meta.errors.join(', ')}
                  />
                )}
              </form.Field>
              {!registerPath && (
                <form.Field
                  name='password'
                  validators={{
                    onSubmit: ({ value }) =>
                      value &&
                      (value.length <= 8 ? 'Password should include at least 8-20 characters'
                      : /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/.test(value) ? null
                      : 'Password should include at least one uppercase letter, one number and one special character'),
                  }}
                >
                  {(field) => (
                    <PasswordInput
                      label='Password'
                      placeholder='Password...'
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      error={!field.state.meta.isValid && field.state.meta.errors.join(', ')}
                    />
                  )}
                </form.Field>
              )}
            </Stack>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button loading={isSubmitting} disabled={!canSubmit} type='submit' fullWidth mt='lg'>
                  Submit code
                </Button>
              )}
            </form.Subscribe>
          </Paper>
          <Group gap={4} px='md'>
            <Text size='xs'>{"Didn't recieve a code or need a new one? "} </Text>
            <Text
              size='xs'
              c='blue'
              style={{ cursor: 'pointer' }}
              onClick={() => handleSubmit({ submitAction: 'resend' })}
            >
              {'Click here '}
            </Text>
          </Group>
        </Stack>
      </Container>
    </form>
  )
}

export default ConfirmStep
