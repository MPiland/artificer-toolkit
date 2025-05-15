import { Box, Center, Container, Group, Paper, Text, Title, Alert, Stack } from '@mantine/core'
import { ArrowLeft } from 'lucide-react'
import { forgotPassword } from '@/apis/authApi'
import { Info } from 'lucide-react'
import Link from '@/components/Link'
import { auth_container, auth_title, fp_controls, fp_control, fp_arrow, auth_wrapper, auth_subtitle } from './Auth.css'
import { useState } from 'react'
import { useForm } from '@/hooks'

const ForgotPassword = () => {
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const { useAppForm } = useForm()

  const form = useAppForm({
    defaultValues: {
      email: '',
    },
    onSubmit: async ({ value: { email } }) => {
      setFormMessage(null)
      await forgotPassword(email)
      return setFormMessage("Check your inbox. If your email is registered, you'll receive a confirmation code.")
    },
  })

  const { AppForm, AppField, SubscribeSubmit, handleSubmit, reset, state } = form

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
          <Title className={auth_title} ta='center'>
            Forgot your password?
          </Title>
          <Text c='dimmed' fz='sm' ta='center' className={auth_subtitle}>
            Enter your email to get a reset confirmation code email
          </Text>
          <Paper withBorder shadow='md' p={30} radius='md'>
            {formMessage && (
              <Alert variant='light' color='blue' icon={<Info />} mb='sm'>
                {formMessage}{' '}
                <Link
                  to='/login/forgot-password/confirm'
                  search={{ email: state.values.email }}
                  type='anchor'
                  size='sm'
                >
                  Enter your confirmation code
                </Link>
              </Alert>
            )}
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
                <TextField type='email' autoComplete='username' placeholder='user@example.com' label='Email' required />
              )}
            </AppField>
            <Group justify='space-between' mt='lg' className={fp_controls}>
              <Link type='anchor' c='dimmed' size='sm' className={fp_control} to='/login' onClick={() => reset()}>
                <Center inline>
                  <ArrowLeft className={fp_arrow} />
                  <Box ml={5}>Back to the login page</Box>
                </Center>
              </Link>
              <SubscribeSubmit label='Reset password' className={fp_control} />
            </Group>
          </Paper>
        </Stack>
      </Container>
    </AppForm>
  )
}

export default ForgotPassword
