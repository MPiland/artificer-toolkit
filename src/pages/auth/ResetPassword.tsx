import { Box, Center, Container, Group, Paper, Text, Title, Alert, Stack, Button, TextInput } from '@mantine/core'
import { ArrowLeft } from 'lucide-react'
import { resetPassword } from '@/apis/auth.api'
import { Info } from 'lucide-react'
import Link from '@/components/Link'
import { auth_container, auth_title, fp_controls, fp_control, fp_arrow, auth_wrapper, auth_subtitle } from './Auth.css'
import { useState } from 'react'
import { useForm } from '@tanstack/react-form'

const ResetPassword = () => {
  const [formMessage, setFormMessage] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      email: '',
    },
    onSubmit: async ({ value: { email } }) => {
      setFormMessage(null)
      await resetPassword({ email })
      return setFormMessage('If an account with this email exists, a confirmation code will be sent.')
    },
  })

  const { handleSubmit, reset, state } = form

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
                <Link size='sm' type='anchor' to='/reset-password/confirm' search={{ email: state.values.email }}>
                  Confirm now
                </Link>
              </Alert>
            )}
            <form.Field
              name='email'
              validators={{
                onChange: ({ value }) => {
                  if (!value) return null
                  return /^\S+@\S+$/.test(value) ? null : 'Enter a valid email address.'
                },
                onSubmit: ({ value }) => (value && /^\S+@\S+$/.test(value) ? null : 'Enter a valid email address.'),
              }}
            >
              {(field) => (
                <TextInput
                  label='Email'
                  placeholder={'user@email.com'}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  error={!field.state.meta.isValid && field.state.meta.errors.join(', ')}
                  autoComplete='username'
                />
              )}
            </form.Field>
            <Group justify='space-between' mt='lg' className={fp_controls}>
              <Link type='anchor' c='dimmed' size='sm' className={fp_control} to='/login' onClick={() => reset()}>
                <Center inline>
                  <ArrowLeft className={fp_arrow} />
                  <Box ml={5}>Back to the login page</Box>
                </Center>
              </Link>
              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <Button className={fp_control} loading={isSubmitting} disabled={!canSubmit}>
                    Reset Password
                  </Button>
                )}
              </form.Subscribe>
            </Group>
          </Paper>
        </Stack>
      </Container>
    </form>
  )
}

export default ResetPassword
