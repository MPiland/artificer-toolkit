import {
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
  Alert,
} from '@mantine/core'
import Link from '~components/Link'
import { auth_container, auth_link, auth_subtitle, auth_title, auth_wrapper, social_icon } from './Auth.css'
import IGoogle from '~assets/Icons/IGoogle'
import ITwitter from '~assets/Icons/ITwitter'
import type { ReactNode } from 'react'
import { useFormField } from '~hooks'
import { Info } from 'lucide-react'

function AuthHint({ message }: { message: ReactNode }) {
  return (
    <Alert variant='light' color='blue' icon={<Info />}>
      <Text size='sm'>{message}</Text>
    </Alert>
  )
}

export function Auth({
  actionText,
  onSubmit,
  afterSubmit,
  addon,
  status,
}: {
  actionText: 'Login' | 'Sign Up'
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  status: 'pending' | 'idle' | 'success' | 'error'
  afterSubmit?: ReactNode
  addon?: ReactNode
}) {
  const { AppField } = useFormField()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(e)
      }}
    >
      <Container className={auth_container}>
        <Stack className={auth_wrapper}>
          <Title ta='center' className={auth_title}>
            Welcome {actionText !== 'Sign Up' ? 'back!' : 'to Artificer Toolkit!'}
          </Title>
          <Text className={auth_subtitle}>
            {actionText !== 'Sign Up' ?
              <>
                {"Don't have an account yet? "}
                <Link type='anchor' to={'/signup'} className={auth_link}>
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
              {afterSubmit && <AuthHint message={afterSubmit} />}
              <AppField
                name='email'
                validators={{
                  onBlur: ({ value }) => {
                    const v = value as string
                    return value && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v) ?
                        null
                      : 'Enter a valid email address.'
                  },
                  onSubmit: ({ value }) => {
                    const v = value as string
                    return !v || v === '' ? 'Email is required' : null
                  },
                }}
              >
                {(field) => (
                  <TextInput
                    label='Email'
                    placeholder='user@email.com'
                    value={field.state.value as string}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={!field.state.meta.isValid && field.state.meta.errors?.join(', ')}
                    autoComplete='username'
                  />
                )}
              </AppField>
              <AppField
                name='password'
                validators={{
                  onBlur: ({ value }) => {
                    const v = value as string
                    return (
                      v ?
                        v.length <= 8 ? 'Password should include at least 8-20 characters'
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
                    autoComplete={actionText === 'Sign Up' ? 'new-password' : 'current-password'}
                    value={field.state.value as string}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    error={!field.state.meta.isValid && field.state.meta.errors?.join(', ')}
                  />
                )}
              </AppField>
            </Stack>
            <Group justify='flex-end' mt='xl'>
              <Button loading={status === 'pending'} disabled={status === 'pending'} radius='xl' type='submit'>
                {actionText}
              </Button>
            </Group>
          </Paper>
          {addon ? addon : null}
        </Stack>
      </Container>
    </form>
  )
}
