import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { IconArrowLeft, IconAlertCircle, IconMapOff } from '@tabler/icons-react'

export function RouteNotFound() {
  return (
    <Stack align='center' justify='center' mih='100dvh' p='xl'>
      <IconMapOff size={48} />
      <Title order={1}>Route not found</Title>
      <Text c='dimmed' ta='center' maw={420}>
        The Phase 9 app shell is active, so some provisional legacy routes are intentionally offline while
        we rebuild the frontend foundation.
      </Text>
      <Button component={Link} to='/' leftSection={<IconArrowLeft size={16} />}>
        Return home
      </Button>
    </Stack>
  )
}

export function RouteErrorState({ error, reset }: ErrorComponentProps) {
  return (
    <Stack align='center' justify='center' mih='100dvh' p='xl'>
      <Alert
        icon={<IconAlertCircle size={18} />}
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
        <Button component={Link} to='/' leftSection={<IconArrowLeft size={16} />}>
          Go to homepage
        </Button>
      </Group>
    </Stack>
  )
}
