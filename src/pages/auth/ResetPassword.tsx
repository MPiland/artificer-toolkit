import { Box, Center, Container, Group, Paper, Text, Title, Stack, Button, PasswordInput } from '@mantine/core'
import { ArrowLeft } from 'lucide-react'
import Link from '~/components/Link'
import { auth_container, auth_title, fp_controls, fp_control, fp_arrow, auth_wrapper, auth_subtitle } from './Auth.css'
import { useForm } from '@tanstack/react-form'
import { supabase } from '~/supabase'
import { notifications } from '@mantine/notifications'
import { useNavigate } from '@tanstack/react-router'

const ResetPassword = () => {
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      password: '',
    },
    onSubmit: async ({ value: { password } }) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        console.error(error.message)
        return notifications.show({
          message: 'Something went wrong',
          color: 'red',
          position: 'top-center',
          autoClose: 2500,
        })
      } else {
        navigate({ to: '/' })
        return notifications.show({
          message: 'Password reset successfully!',
          color: 'green',
          position: 'top-center',
          autoClose: 2500,
        })
      }
    },
  })

  const { handleSubmit, reset } = form

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
        <Title className={auth_title} ta='center'>
          Reset Password
        </Title>
        <Text c='dimmed' fz='sm' ta='center' className={auth_subtitle}>
          Enter your new password
        </Text>
        <Paper withBorder shadow='md' p={30} radius='md'>
          <form.Field
            name='password'
            validators={{
              onBlur: ({ value }) =>
                value &&
                (value.length <= 8 || value.length >= 20 ? 'Password should include at least 8-20 characters'
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
  )
}

export default ResetPassword
