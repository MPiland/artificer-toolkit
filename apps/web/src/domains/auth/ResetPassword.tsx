import { Box, Center, Container, Group, Paper, Text, Title, Stack, Button, PasswordInput } from '@mantine/core'
import { ArrowLeft } from 'lucide-react'
import Link from '~components/Link'
import { auth_container, auth_title, fp_controls, fp_control, fp_arrow, auth_wrapper, auth_subtitle } from './Auth.css'
import { useFormField } from '~hooks'

export function ResetPassword({
  status,
  onSubmit,
}: {
  status: 'pending' | 'idle' | 'success' | 'error'
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}) {
  const { AppField } = useFormField()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onSubmit(e)
      }}
    >
      <Container className={auth_container}>
        <Stack className={auth_wrapper}>
          <Title className={auth_title} ta='center'>
            Reset Password
          </Title>
          <Text c='dimmed' fz='sm' ta='center' className={auth_subtitle}>
            Enter your new password
          </Text>
          <Paper withBorder shadow='md' p={30} radius='md'>
            <AppField
              name='password'
              validators={{
                onBlur: ({ value }) => {
                  const v = value as string
                  return (
                    v ?
                      v.length <= 8 || v.length >= 20 ? 'Password should include at least 8-20 characters'
                      : /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/.test(v) ? null
                      : 'Password should include at least one uppercase letter, one number and one special character'
                    : null
                  )
                },
                onSubmit: ({ value }) => {
                  const v = value as string
                  return !v || v === '' ? 'Password is required' : null
                },
              }}
            >
              {(field) => (
                <PasswordInput
                  label='Password'
                  placeholder='Password...'
                  value={field.state.value as string}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  error={!field.state.meta.isValid && field.state.meta.errors?.join(', ')}
                />
              )}
            </AppField>
            <Group justify='space-between' mt='lg' className={fp_controls}>
              <Link type='anchor' c='dimmed' size='sm' className={fp_control} to='/login'>
                <Center inline>
                  <ArrowLeft className={fp_arrow} />
                  <Box ml={5}>Back to the login page</Box>
                </Center>
              </Link>
              <Button
                className={fp_control}
                loading={status === 'pending'}
                disabled={status === 'pending'}
                type='submit'
              >
                Reset Password
              </Button>
            </Group>
          </Paper>
        </Stack>
      </Container>
    </form>
  )
}
