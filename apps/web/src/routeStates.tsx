import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import IAlertCircle from '#assets/Icons/IAlertCircle'
import IArrowLeft from '#assets/Icons/IArrowLeft'
import IMapOff from '#assets/Icons/IMapOff'

export function RouteNotFound() {
  return (
    <Stack align='center' justify='center' mih='100dvh' p='xl'>
      <IMapOff size={48} />
      <Title order={1}>Route not found</Title>
      <Text c='dimmed' ta='center' maw={420}>
        The Phase 9 app shell is active, so some provisional legacy routes are intentionally offline while
        we rebuild the frontend foundation.
      </Text>
      <Button component={Link} to='/' leftSection={<IArrowLeft size={16} />}>
        Return home
      </Button>
    </Stack>
  )
}

export function RouteErrorState({ error, reset }: ErrorComponentProps) {
  return (
    <Stack align='center' justify='center' mih='100dvh' p='xl'>
      <Alert
        icon={<IAlertCircle size={18} />}
        title='Route error'
        color='red'
        maw={560}
      >
        {error instanceof Error ? error.message : 'An unexpected route error occurred.'}
      </Alert>
      <Group>
        <Button variant='default' onClick={reset}>
          Try again
        </Button>
        <Button component={Link} to='/' leftSection={<IArrowLeft size={16} />}>
          Go to homepage
        </Button>
      </Group>
    </Stack>
  )
}
