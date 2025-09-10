import { Container, Text, Title, Stack, UnstyledButton } from '@mantine/core'
import { auth_container, auth_wrapper } from './Auth.css'
import { supabase } from '~/supabase'
import { Route } from '~/routes/_auth/confirm'
import { notifications } from '@mantine/notifications'

const ConfirmStep = () => {
  const { email } = Route.useSearch()

  return (
    <Container
      component='form'
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      className={auth_container}
    >
      <Stack className={auth_wrapper}>
        <Title ta='center'>Email Sent!</Title>
        <Text>If an account with that email exists, a confirmation link will be sent.</Text>
      </Stack>
      <Text size='sm'>
        Need a new link?{' '}
        <UnstyledButton
          type='button'
          color='blue'
          size='sm'
          onClick={async () => {
            if (!email) return
            const { error } = await supabase.auth.resend({ email, type: 'signup' })
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
        to resend the confirmation link.
      </Text>
    </Container>
  )
}

export default ConfirmStep
